import { getKv, Kv } from "./redis";

const RECENT_MSG_CAP = 50;
const WH_DEDUPE_TTL_SEC = 900;
const MSG_DEDUPE_TTL_SEC = 60 * 60 * 24 * 7;

export interface ChatMessageRecord {
  id?: string;
  direction: "inbound" | "outbound";
  senderJid?: string;
  body: string;
  msgType?: string;
  createdAt?: string;
}

export interface ActiveChat {
  jid: string;
  recipientName?: string;
  outreachId?: string;
  lastActivityAt: number;
  lastMsg?: string;
  unreadInbound?: number;
}

function chatKey(jid: string) {
  return `wa:chat:${jid}`;
}

function msgsKey(jid: string) {
  return `wa:msgs:${jid}`;
}

export function jidToDigits(jid: string): string {
  if (!jid || typeof jid !== "string") return "";
  const beforeAt = jid.split("@")[0] || "";
  return beforeAt.replace(/[^\d]/g, "");
}

export function normalizeChatKey(phoneOrJid: string): string {
  return jidToDigits(phoneOrJid);
}

export async function markWebhookProcessed(idempotencyKey: string): Promise<boolean> {
  if (!idempotencyKey) return false;
  const kv = await getKv();
  return kv.setnx(`wa:dedupe:wh:${idempotencyKey}`, "1", WH_DEDUPE_TTL_SEC);
}

export async function isWebhookProcessed(idempotencyKey: string): Promise<boolean> {
  if (!idempotencyKey) return false;
  const kv = await getKv();
  return kv.exists(`wa:dedupe:wh:${idempotencyKey}`);
}

export async function markMessageProcessed(waMessageId: string): Promise<boolean> {
  if (!waMessageId) return false;
  const kv = await getKv();
  return kv.setnx(`wa:dedupe:msg:${waMessageId}`, "1", MSG_DEDUPE_TTL_SEC);
}

export async function isMessageProcessed(waMessageId: string): Promise<boolean> {
  if (!waMessageId) return false;
  const kv = await getKv();
  return kv.exists(`wa:dedupe:msg:${waMessageId}`);
}

export async function recordChatMessage(
  jid: string,
  record: ChatMessageRecord,
  meta?: { recipientName?: string; outreachId?: string }
): Promise<void> {
  const key = normalizeChatKey(jid);
  if (!key) return;
  const kv: Kv = await getKv();
  const now = Date.now();
  const createdAt = record.createdAt || new Date(now).toISOString();

  const msg: ChatMessageRecord = {
    ...record,
    direction: record.direction,
    body: record.body,
    msgType: record.msgType || "text",
    createdAt,
  };

  const lastRawList = await kv.lrange(msgsKey(key), -1, -1);
  if (lastRawList && lastRawList.length > 0) {
    try {
      const lastMsg = JSON.parse(lastRawList[0]) as ChatMessageRecord;
      if (
        lastMsg.direction === msg.direction &&
        lastMsg.body === msg.body
      ) {
        const chat = chatKey(key);
        if (meta?.recipientName) await kv.hset(chat, "recipientName", meta.recipientName);
        if (meta?.outreachId) await kv.hset(chat, "outreachId", meta.outreachId);
        return;
      }
    } catch {}
  }

  await kv.rpush(msgsKey(key), JSON.stringify(msg));
  await kv.ltrim(msgsKey(key), -RECENT_MSG_CAP, -1);

  const chat = chatKey(key);
  const existing = await kv.hget(chat, "lastActivityAt");
  const lastActivityAt = existing ? Math.max(Number(existing) || 0, now) : now;

  await kv.hset(chat, "lastActivityAt", String(lastActivityAt));
  await kv.hset(chat, "lastMsg", record.body);
  if (meta?.recipientName) await kv.hset(chat, "recipientName", meta.recipientName);
  if (meta?.outreachId) await kv.hset(chat, "outreachId", meta.outreachId);
  if (record.direction === "inbound") {
    const prev = Number(await kv.hget(chat, "unreadInbound")) || 0;
    await kv.hset(chat, "unreadInbound", String(prev + 1));
  }
  await kv.zadd("wa:chats:index", lastActivityAt, key);
}

export async function getChatMeta(jid: string): Promise<Record<string, string> | null> {
  const kv = await getKv();
  const key = normalizeChatKey(jid);
  const hash = await kv.hgetall(chatKey(key));
  if (!hash || !hash.lastActivityAt) return null;
  return hash;
}

export async function getRecentMessages(jid: string, limit = 30): Promise<ChatMessageRecord[]> {
  const kv = await getKv();
  const key = normalizeChatKey(jid);
  const raw = await kv.lrange(msgsKey(key), -limit, -1);
  return raw
    .map((line) => {
      try {
        return JSON.parse(line) as ChatMessageRecord;
      } catch {
        return null;
      }
    })
    .filter((m): m is ChatMessageRecord => m !== null);
}

export async function listActiveChats(limit = 100): Promise<ActiveChat[]> {
  const kv = await getKv();
  const members = await kv.zrevrange("wa:chats:index", 0, limit - 1);
  const chats: ActiveChat[] = [];
  for (const key of members) {
    const hash = await kv.hgetall(chatKey(key));
    if (!hash.lastActivityAt) continue;
    chats.push({
      jid: key,
      recipientName: hash.recipientName,
      outreachId: hash.outreachId,
      lastActivityAt: Number(hash.lastActivityAt) || 0,
      lastMsg: hash.lastMsg,
      unreadInbound: Number(hash.unreadInbound) || 0,
    });
  }
  return chats;
}

export async function markChatRead(jid: string): Promise<void> {
  const kv = await getKv();
  const key = normalizeChatKey(jid);
  await kv.hset(chatKey(key), "unreadInbound", "0");
}

export async function getLastSentAt(jid: string): Promise<number> {
  const kv = await getKv();
  const raw = await kv.get(`wa:last-sent:${normalizeChatKey(jid)}`);
  return raw ? Number(raw) || 0 : 0;
}

export async function setLastSentAt(jid: string, at: number = Date.now()): Promise<void> {
  const kv = await getKv();
  await kv.set(`wa:last-sent:${normalizeChatKey(jid)}`, String(at));
}
