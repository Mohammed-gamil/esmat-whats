import { prisma } from "@/lib/prisma";
import { getKv } from "@/lib/redis";
import {
  getChatMeta,
  getLastSentAt,
  normalizeChatKey,
  recordChatMessage,
  setLastSentAt,
} from "@/lib/chat-store";
import { WhatsAppService } from "./whatsapp-service";

export interface QueuedSend {
  id: string;
  outreachId: string;
  chatId: string;
  text: string;
  kind: "hook" | "reply";
  createdAt: number;
  attempts: number;
}

const QUEUE_KEY = "wa:send:queue";
const MAX_ATTEMPTS = 5;
const POLL_MS = 2000;

function randomBetween(minMs: number, maxMs: number): number {
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

export async function enqueueSend(item: Omit<QueuedSend, "id" | "createdAt" | "attempts">): Promise<void> {
  const kv = await getKv();
  const full: QueuedSend = {
    ...item,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
    attempts: 0,
  };
  await kv.rpush(QUEUE_KEY, JSON.stringify(full));
}

export async function queueDepth(): Promise<number> {
  const kv = await getKv();
  return kv.llen(QUEUE_KEY);
}

async function computeDelayMs(chatId: string, delaySeconds: number, kind?: string): Promise<number> {
  if (kind === "reply") {
    return randomBetween(500, 1500);
  }

  if (kind === "hook") {
    const antiSpamDelay = randomBetween(8000, 18000);
    const lastSentAt = await getLastSentAt(chatId);
    if (lastSentAt > 0) {
      const elapsed = Date.now() - lastSentAt;
      return Math.max(300, antiSpamDelay - elapsed);
    }
    return antiSpamDelay;
  }

  const kv = await getKv();
  const lastSentRaw = await kv.get("wa:last-sent:global");
  const lastChatId = lastSentRaw || "";
  const lastSentAt = await getLastSentAt(chatId);

  const base = Math.max(2, delaySeconds || 5) * 1000;
  let delayMs: number;
  if (lastChatId && lastChatId === normalizeChatKey(chatId)) {
    delayMs = randomBetween(base * 0.4, base * 1.2);
  } else {
    delayMs = randomBetween(base * 0.8, base * 2.0);
  }

  if (lastSentAt > 0) {
    const elapsed = Date.now() - lastSentAt;
    delayMs = Math.max(delayMs, 1000 - elapsed);
  }
  return Math.max(300, delayMs);
}

async function markSent(chatId: string): Promise<void> {
  const kv = await getKv();
  await kv.set("wa:last-sent:global", normalizeChatKey(chatId));
  await setLastSentAt(chatId);
}

async function processItem(item: QueuedSend): Promise<boolean> {
  const outreach = await prisma.whatsAppOutreach.findUnique({
    where: { id: item.outreachId },
    include: { session: true },
  });
  if (!outreach) {
    console.warn(`[send-queue] outreach ${item.outreachId} not found, dropping`);
    return false;
  }

  let session = outreach.session;
  if (!session || !(await WhatsAppService.isSessionReady(session))) {
    const activeSession =
      (await prisma.whatsAppSession.findFirst({
        where: { status: { in: ["ready", "WORKING", "CONNECTED"] } },
        orderBy: { updatedAt: "desc" },
      })) ||
      (await prisma.whatsAppSession.findFirst({ orderBy: { createdAt: "desc" } }));
      
    if (!activeSession || !(await WhatsAppService.isSessionReady(activeSession))) {
      throw new Error(
        `WhatsApp session is not active/connected (status: ${session?.status || "none"}). Please scan QR code in WhatsApp Agent tab.`
      );
    }
    session = activeSession;
  }

  const settings = await WhatsAppService.getSettings();
  const delayMs = await computeDelayMs(item.chatId, settings.delaySeconds, item.kind);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const sent = await WhatsAppService.sendTextViaGateway(session, item.chatId, item.text);
  if (!sent) {
    throw new Error("Gateway returned non-success status");
  }

  if (item.kind !== "reply") {
    const existing = await prisma.whatsAppMessage.findFirst({
      where: {
        outreachId: item.outreachId,
        direction: "outbound",
        body: item.text,
      },
    });
    if (!existing) {
      await prisma.whatsAppMessage.create({
        data: {
          outreachId: item.outreachId,
          direction: "outbound",
          senderJid: "agent",
          body: item.text,
          msgType: "text",
        },
      });
    }
  }

  await prisma.whatsAppOutreach.update({
    where: { id: item.outreachId },
    data: { status: "sent", updatedAt: new Date() },
  });
  await markSent(item.chatId);

  const meta = await getChatMeta(item.chatId);
  const senderJid = item.kind === "reply" ? "ai_sales_agent" : "agent";
  await recordChatMessage(
    item.chatId,
    { direction: "outbound", senderJid, body: item.text, msgType: "text" },
    {
      recipientName: outreach.recipientName || meta?.recipientName || undefined,
      outreachId: outreach.id,
    }
  );

  return true;
}

async function requeueWithBackoff(item: QueuedSend, error: string): Promise<void> {
  item.attempts += 1;
  if (item.attempts >= MAX_ATTEMPTS) {
    console.error(`[send-queue] giving up on ${item.id} after ${MAX_ATTEMPTS} attempts: ${error}`);
    try {
      await prisma.whatsAppOutreach.update({
        where: { id: item.outreachId },
        data: { status: "failed", updatedAt: new Date() },
      });
    } catch {}
    return;
  }
  const kv = await getKv();
  await kv.rpush(QUEUE_KEY, JSON.stringify(item));
}

export async function drainQueueOnce(): Promise<void> {
  const kv = await getKv();
  for (;;) {
    const raw = await kv.lpop(QUEUE_KEY);
    if (!raw) return;
    let item: QueuedSend;
    try {
      item = JSON.parse(raw);
    } catch {
      continue;
    }
    try {
      const sent = await processItem(item);
      if (sent) {
        console.log(`[send-queue] ✓ sent (${item.kind}) to ${item.chatId}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[send-queue] send to ${item.chatId} failed: ${message}`);
      await requeueWithBackoff(item, message);
    }
  }
}

let workerStarted = false;

export async function startSendWorker(): Promise<void> {
  if (workerStarted) return;
  if (process.env.WHATSAPP_WORKER_DISABLED === "true") return;
  workerStarted = true;
  console.log("[send-queue] WhatsApp send worker started");

  const loop = async () => {
    for (;;) {
      try {
        const kv = await getKv();
        const lockAcquired = await kv.setnx("wa:worker:lock", Date.now().toString(), 30);
        if (lockAcquired) {
          try {
            await drainQueueOnce();
          } finally {
            await kv.del("wa:worker:lock");
          }
        }
      } catch (err) {
        console.error(`[send-queue] worker error: ${err}`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  };
  loop().catch((err) => console.error("[send-queue] worker crashed:", err));
}
