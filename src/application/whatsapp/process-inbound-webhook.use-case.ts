import { prisma } from "@/lib/prisma";
import {
  getChatMeta,
  jidToDigits,
  markMessageProcessed,
  markWebhookProcessed,
  recordChatMessage,
} from "@/lib/chat-store";
import { enqueueSend, startSendWorker } from "@/services/send-queue";
import { WhatsAppAiAgent } from "@/domain/whatsapp/ai-agent";
import { VoiceTranscriptionService } from "@/services/voice-transcription-service";
import { applyLeadScore } from "@/services/whatsapp-lead-qualifier";

export interface ProcessInboundPayload {
  payload: any;
  idempotencyKey?: string;
}

export interface ProcessInboundResult {
  success: boolean;
  status: string;
  outreachId?: string;
  error?: string;
}

export class ProcessInboundWebhookUseCase {
  public static async execute(input: ProcessInboundPayload): Promise<ProcessInboundResult> {
    void (async () => { try { await startSendWorker(); } catch { /* background worker */ } })();

    const { payload, idempotencyKey } = input;
    const event: string = payload.event || payload.type || "message";

    if (event && !event.includes("message") && event !== "chat") {
      return { success: true, status: "ignored_event" };
    }

    const data = payload.data || payload.message || payload;
    if (!data) {
      return { success: true, status: "no_data" };
    }

    if (data.fromMe === true || data.key?.fromMe === true) {
      return { success: true, status: "ignored_outbound" };
    }
    if (data.isGroup === true || data.isGroupMsg === true || data.participant) {
      return { success: true, status: "ignored_group" };
    }

    const candidates = [
      data.phoneNumber,
      data.sender?.phoneNumber,
      data.sender?.id,
      data.chatId,
      data.key?.remoteJid,
      data.from,
      data.author,
      payload.from,
    ].filter((val): val is string => typeof val === "string" && val.trim().length > 0);

    const nonLidCandidate = candidates.find((c) => {
      const d = c.replace(/[^\d]/g, "");
      return d.length > 5 && d.length < 14 && !d.startsWith("110");
    });

    const fromJid: string = nonLidCandidate || candidates[0] || "";
    const waMessageId: string = String(data.id || data.key?.id || payload.id || "");

    const rawMsgType: string = String(
      data.type || data.msgType || data.message?.type || "text"
    ).toLowerCase();

    let body: string = String(
      data.body ||
        data.text ||
        data.caption ||
        data.message?.conversation ||
        data.message?.extendedTextMessage?.text ||
        payload.body ||
        ""
    ).trim();

    if (VoiceTranscriptionService.isVoiceMessage(rawMsgType) && !body) {
      const mediaUrl: string =
        data.mediaUrl ||
        data.body ||
        data.media?.url ||
        data.message?.audioMessage?.url ||
        data.url ||
        "";

      if (mediaUrl && mediaUrl.startsWith("http")) {
        const mimeType =
          data.mimetype ||
          data.message?.audioMessage?.mimetype ||
          "audio/ogg; codecs=opus";
        const transcription = await VoiceTranscriptionService.transcribeUrl(
          mediaUrl,
          mimeType
        );
        if (transcription) {
          body = `[Voice message transcribed]: ${transcription}`;
          console.log(`[webhook] PTT transcribed for ${fromJid}: ${transcription.slice(0, 60)}`);
        } else {
          console.warn(`[webhook] PTT from ${fromJid} — no transcription provider, skipping AI reply`);
          return { success: true, status: "voice_no_transcription" };
        }
      } else {
        return { success: true, status: "voice_no_media_url" };
      }
    }

    if (!fromJid || !body) {
      return { success: true, status: "ignored_empty_body" };
    }

    if (idempotencyKey && !(await markWebhookProcessed(idempotencyKey))) {
      return { success: true, status: "duplicate_delivery" };
    }

    const processed = await markMessageProcessed(waMessageId);
    if (!processed && waMessageId) {
      const existing = await prisma.whatsAppMessage.findFirst({
        where: { waMessageId },
        select: { id: true },
      });
      if (existing) {
        return { success: true, status: "duplicate_message" };
      }
    }

    const digits = jidToDigits(fromJid);
    if (!digits || digits.length < 5) {
      return { success: true, status: "invalid_digits" };
    }

    let outreach = await prisma.whatsAppOutreach.findFirst({
      where: {
        OR: [
          { contactPhone: { contains: digits } },
          { contactPhone: fromJid },
        ],
      },
      include: { session: true },
    });

    if (!outreach) {
      const activeSession =
        (await prisma.whatsAppSession.findFirst({ where: { status: "WORKING" } })) ||
        (await prisma.whatsAppSession.findFirst({ orderBy: { createdAt: "desc" } }));

      if (activeSession) {
        const contactJid = fromJid.includes("@") ? fromJid : `${digits}@c.us`;
        const pushName = data.notifyName || data.sender?.pushname || data.pushname || `Lead +${digits}`;

        outreach = await prisma.whatsAppOutreach.create({
          data: {
            leadId: `inbound-${digits}`,
            leadType: "inbound",
            contactPhone: contactJid,
            recipientName: pushName,
            status: "replied",
            initialHook: "Inbound inquiry on WhatsApp",
            sessionId: activeSession.id,
          },
          include: { session: true },
        });
      }
    }

    if (!outreach) {
      await recordChatMessage(fromJid, {
        direction: "inbound",
        senderJid: fromJid,
        body,
        msgType: "text",
      });
      return { success: true, status: "no_session" };
    }

    await prisma.whatsAppMessage.create({
      data: {
        outreachId: outreach.id,
        direction: "inbound",
        senderJid: fromJid,
        body,
        msgType: "text",
        waMessageId: waMessageId || undefined,
      },
    });

    const prevMeta = await getChatMeta(outreach.contactPhone);
    await recordChatMessage(
      fromJid,
      { direction: "inbound", senderJid: fromJid, body, msgType: "text" },
      {
        recipientName: outreach.recipientName || prevMeta?.recipientName || undefined,
        outreachId: outreach.id,
      }
    );

    await prisma.whatsAppOutreach.update({
      where: { id: outreach.id },
      data: { status: "replied", updatedAt: new Date() },
    });

    const settings = await prisma.whatsAppSetting.findUnique({ where: { id: "default" } });

    if (outreach.isHumanHandled) {
      console.log(`[webhook] Human takeover active for ${outreach.id} — AI skipped.`);
      return { success: true, status: "human_handled", outreachId: outreach.id };
    }

    if (settings?.autoReply !== false) {
      const decision = await WhatsAppAiAgent.generateReply(outreach.id, body);

      if (decision && decision.response) {
        await prisma.whatsAppMessage.create({
          data: {
            outreachId: outreach.id,
            direction: "outbound",
            senderJid: "ai_sales_agent",
            body: decision.response,
            msgType: "text",
          },
        });

        const targetChatJid = `${digits}@c.us`;

        await enqueueSend({
          outreachId: outreach.id,
          chatId: targetChatJid,
          text: decision.response,
          kind: "reply",
        });

        if (decision.attachmentUrl) {
          await enqueueSend({
            outreachId: outreach.id,
            chatId: targetChatJid,
            text: decision.attachmentUrl,
            kind: "reply",
          });
          console.log(`[webhook] PDF brochure queued for ${outreach.id}: ${decision.attachmentUrl}`);
        }

        if (decision.sentiment) {
          await prisma.whatsAppOutreach.update({
            where: { id: outreach.id },
            data: {
              status: decision.sentiment === "negative" ? "closed" : "replied",
              sentiment: decision.sentiment,
            },
          });
        }

        if (decision.leadScore && decision.leadScore > 0) {
          void applyLeadScore(outreach.id, decision.leadScore).then((q) => {
            if (q.qualified) {
              console.log(
                `[webhook] ⭐ Outreach ${outreach!.id} qualified (score=${q.newScore}) — Zoho sync: ${
                  q.zohoSynced ? "OK" : q.zohoError || "skipped"
                }`
              );
            }
          });
        }
      }
    }

    return { success: true, status: "processed", outreachId: outreach.id };
  }
}

export async function processInboundWebhook(rawPayload: any): Promise<any> {
  const result = await ProcessInboundWebhookUseCase.execute({ payload: rawPayload });
  if (result.status === "ignored_event" || result.status === "no_data") {
    return { success: true, ignored: true };
  }
  return result;
}
