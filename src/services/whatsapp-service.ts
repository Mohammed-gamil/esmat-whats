import { prisma } from "@/lib/prisma";
import { recordChatMessage, setLastSentAt } from "@/lib/chat-store";
import { enqueueSend, drainQueueOnce } from "./send-queue";
import axios from "axios";
import fs from "fs";
import path from "path";

export interface ConnectLeadsInput {
  leadIds: string[];
  leadType: "lead" | "maps_lead" | "icp_prospect" | "csv_lead";
  sessionId?: string;
  customPrompt?: string;
  customName?: string;
  customPhone?: string;
  customCompany?: string;
  customJobTitle?: string;
  customSector?: string;
  customHook?: string;
  autoSend?: boolean;
}

export class WhatsAppService {
  static getOpenWaApiKey(settingsApiKey?: string): string {
    const candidatePaths = [
      path.join(process.cwd(), "openwa", "data", ".api-key"),
      path.join(process.cwd(), "data", ".api-key"),
      path.join(__dirname, "..", "..", "openwa", "data", ".api-key"),
      path.join(__dirname, "..", "..", "..", "openwa", "data", ".api-key"),
      "/home/medochi/whatsapp-agent-standalone/openwa/data/.api-key",
    ];

    for (const keyPath of candidatePaths) {
      try {
        if (fs.existsSync(keyPath)) {
          const key = fs.readFileSync(keyPath, "utf-8").trim();
          if (key) return key;
        }
      } catch (e) {}
    }

    if (process.env.OPENWA_API_KEY && process.env.OPENWA_API_KEY.trim()) {
      return process.env.OPENWA_API_KEY.trim();
    }

    if (process.env.API_MASTER_KEY && process.env.API_MASTER_KEY.trim()) {
      return process.env.API_MASTER_KEY.trim();
    }

    if (settingsApiKey && settingsApiKey.trim()) {
      return settingsApiKey.trim();
    }

    return "esmat_whatsapp_master_key_2026";
  }

  static getHeaders(apiKey?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    const validKey = (apiKey && apiKey.trim()) || this.getOpenWaApiKey();
    if (validKey) {
      headers["X-API-Key"] = validKey;
      headers["Authorization"] = `Bearer ${validKey}`;
    }
    return headers;
  }

  static normalizeGatewayUrl(rawUrl?: string): string {
    const fallback = process.env.OPENWA_URL || "http://localhost:2785";
    let clean = (rawUrl && rawUrl.trim()) || fallback;
    clean = clean.replace(/\/+$/, "");
    if (clean.endsWith("/api")) {
      clean = clean.substring(0, clean.length - 4).replace(/\/+$/, "");
    }
    return clean;
  }

  private static sanitizeSessionId(sessionId: string): string {
    return sessionId.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  }

  static async resolveSessionUuid(sessionId: string, gatewayUrl: string, headers: Record<string, string>): Promise<string> {
    const base = this.normalizeGatewayUrl(gatewayUrl);
    try {
      const listRes = await axios.get(`${base}/api/sessions`, {
        headers,
        timeout: 3000,
      });
      if (Array.isArray(listRes.data) && listRes.data.length > 0) {
        const exact = listRes.data.find(
          (s: any) => s.name === sessionId || s.id === sessionId
        );
        if (exact && exact.id) return exact.id;

        const ready = listRes.data.find((s: any) => {
          const st = (s.status || "").toLowerCase();
          return st === "ready" || st === "working" || st === "connected" || st === "authenticated";
        });
        if (ready && ready.id) return ready.id;

        if (listRes.data[0]?.id) return listRes.data[0].id;
      }
    } catch (e) {}

    try {
      const createRes = await axios.post(
        `${base}/api/sessions`,
        { name: sessionId },
        { headers, timeout: 5000 }
      );
      if (createRes.data && createRes.data.id) {
        return createRes.data.id;
      }
    } catch (e) {}

    return sessionId;
  }

  static async ensureWebhook(sessionIdentifier: string, gatewayUrl: string, headers: Record<string, string>) {
    const base = this.normalizeGatewayUrl(gatewayUrl);
    const sessionUuid = await this.resolveSessionUuid(sessionIdentifier, gatewayUrl, headers);
    const webhookUrl =
      process.env.WHATSAPP_WEBHOOK_URL?.trim() ||
      `http://localhost:${process.env.PORT || 3000}/api/whatsapp/webhook`;
    try {
      const existing = await axios.get(
        `${base}/api/sessions/${sessionUuid}/webhooks`,
        { headers, timeout: 3000 }
      );
      if (Array.isArray(existing.data)) {
        for (const w of existing.data) {
          if (w.url === webhookUrl) {
            await axios.patch(
              `${base}/api/sessions/${sessionUuid}/webhooks/${w.id}`,
              { active: true, events: ["*"] },
              { headers, timeout: 3000 }
            ).catch(() => {});
            return;
          }
        }
      }
    } catch (e) {}

    try {
      await axios.post(
        `${base}/api/sessions/${sessionUuid}/webhooks`,
        { url: webhookUrl, events: ["*"] },
        { headers, timeout: 5000 }
      );
      console.log(`[WhatsAppService] ✅ Webhook registered for session ${sessionUuid} → ${webhookUrl}`);
    } catch (e: any) {
      console.warn(`[WhatsAppService] ⚠️ Could not register webhook: ${e.message}`);
    }
  }

  static async sendTextViaGateway(
    session: { sessionId: string },
    chatId: string,
    text: string
  ): Promise<boolean> {
    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);
    const sessionUuid = await this.resolveSessionUuid(session.sessionId, settings.gatewayUrl, headers);

    const targetChatId = await this.resolveCanonicalChatId(sessionUuid, chatId, settings.gatewayUrl, headers);

    try {
      const res = await axios.post(
        `${settings.gatewayUrl}/api/sessions/${sessionUuid}/messages/send-text`,
        { chatId: targetChatId, text },
        { headers, timeout: 10000 }
      );
      if (!res.data || res.status >= 400) {
        throw new Error(`OpenWA send failed (${res.status})`);
      }
      return true;
    } catch (err: any) {
      const detail = err.response?.data?.message || err.message;
      const statusCode = err.response?.status || 400;
      throw new Error(`OpenWA send failed (${statusCode}): ${Array.isArray(detail) ? detail.join(', ') : detail}`);
    }
  }

  static async sendImageViaGateway(
    session: { sessionId: string },
    chatId: string,
    imageUrl: string,
    caption?: string
  ): Promise<boolean> {
    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);
    const sessionUuid = await this.resolveSessionUuid(session.sessionId, settings.gatewayUrl, headers);

    const targetChatId = await this.resolveCanonicalChatId(sessionUuid, chatId, settings.gatewayUrl, headers);

    // Humanization: add randomized typing simulation delay before image send
    const typingMs = Math.min(Math.max((caption?.length || 10) * 40, 1500), 5000);
    await new Promise((resolve) => setTimeout(resolve, typingMs));

    try {
      const sendPayload: any = {
        chatId: targetChatId,
        image: { url: imageUrl },
      };
      if (caption && caption.trim()) {
        sendPayload.caption = caption.trim();
      }

      const res = await axios.post(
        `${settings.gatewayUrl}/api/sessions/${sessionUuid}/messages/send-image`,
        sendPayload,
        { headers, timeout: 30000 }
      );
      if (!res.data || res.status >= 400) {
        throw new Error(`OpenWA send-image failed (${res.status})`);
      }
      return true;
    } catch (err: any) {
      const detail = err.response?.data?.message || err.message;
      const statusCode = err.response?.status || 400;
      console.warn(`[WhatsAppService] send-image failed (${statusCode}): ${Array.isArray(detail) ? detail.join(', ') : detail}`);
      // Fallback to text-only if image send fails
      if (caption && caption.trim()) {
        console.log(`[WhatsAppService] Falling back to text-only for ${chatId}`);
        return this.sendTextViaGateway(session, chatId, caption);
      }
      throw new Error(`OpenWA send-image failed (${statusCode}): ${Array.isArray(detail) ? detail.join(', ') : detail}`);
    }
  }

  static async resolveCanonicalChatId(
    sessionUuid: string,
    chatId: string,
    gatewayUrl: string,
    headers: Record<string, string>
  ): Promise<string> {
    if (chatId.endsWith('@g.us') || chatId.endsWith('@lid')) return chatId;
    const digits = chatId.replace(/[^\d]/g, '');
    if (!digits) return chatId;

    const isLid = digits.startsWith('110') || digits.startsWith('170') || digits.startsWith('180') || digits.length >= 14;

    try {
      const checkRes = await axios.get(
        `${gatewayUrl}/api/sessions/${sessionUuid}/contacts/check/${digits}`,
        { headers, timeout: 3000 }
      );
      if (checkRes.data?.whatsappId) {
        return checkRes.data.whatsappId;
      }
    } catch (e) {}

    return isLid ? `${digits}@lid` : `${digits}@c.us`;
  }

  static async isSessionReady(session: { sessionId: string }): Promise<boolean> {
    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);
    try {
      const listRes = await axios.get(`${settings.gatewayUrl}/api/sessions`, {
        headers,
        timeout: 3000,
      });
      if (Array.isArray(listRes.data) && listRes.data.length > 0) {
        const matching = listRes.data.find((s: any) => s.name === session.sessionId || s.id === session.sessionId);
        const target = matching || listRes.data[0];
        const status = (target?.status || "").toLowerCase();
        return status === "ready" || status === "working" || status === "connected" || status === "authenticated";
      }
    } catch (e: any) {
      console.warn("[WhatsAppService] isSessionReady API check failed:", e?.message);
    }

    const dbSess = await prisma.whatsAppSession.findFirst({
      where: { status: { in: ["ready", "WORKING", "CONNECTED", "authenticated"] } },
    }).catch(() => null);

    return !!dbSess;
  }

  static readonly MASTER_SYSTEM_PROMPT = `You are an expert AI Solution Specialist & AI Agent for Reference Agency — a premier HR and B2B AI Consulting Agency. Your goal is to introduce yourself transparently as Reference Agency's AI Agent & Solution Consultant, engage potential B2B clients warmly on WhatsApp, understand their operational, HR, and workflow challenges, present our custom consulting solutions with business clarity (focusing on fixing workflows FIRST before automating them), handle objections, and invite them for a Free 30-Minute AI Readiness & Workflow Assessment Meeting before discussing custom pricing.

Core Identity & Positioning:
- Company: Reference Agency (HR & B2B AI Consulting Agency)
- Identity: You are Reference Agency's AI Agent & B2B AI Solution Consultant.
- Core Approach: We re-engineer, optimize, and fix business & HR workflows FIRST, before automating them with custom AI.
- Role: B2B AI Solution Consultant & AI Agent.
- Tone: Professional, direct, articulate, warm, grounded. Zero florid fluff or technical sales jargon.

STRICT PRICING & NEXT STEPS POLICY:
- DO NOT quote specific prices, build fees, monthly retainers, or dollar amounts on WhatsApp.
- If a prospect asks about pricing, reply: "Because all our consulting & AI solutions are custom-engineered to fix your exact workflow and software stack, we evaluate your processes first during a Free 30-Minute AI Readiness & Workflow Assessment Meeting. After the session, we provide a transparent, tailored proposal."
- Primary Call to Action: Invite the client to book a **Free 30-Minute AI Readiness & Workflow Assessment Meeting**.

CRITICAL LANGUAGE & EGYPTIAN/ARABIC RULE:
- If the contact phone number starts with +20, 20, or 01 (Egyptian/Arab number), OR if the lead speaks in Arabic, YOU MUST RESPOND IN NATURAL EGYPTIAN/ARABIC FIRST!`;

  static async getSettings() {
    let settings = await prisma.whatsAppSetting.findUnique({
      where: { id: "default" },
    });

    const fileApiKey = this.getOpenWaApiKey("");

    if (!settings) {
      settings = await prisma.whatsAppSetting.create({
        data: {
          id: "default",
          gatewayUrl: process.env.OPENWA_URL || "http://localhost:2785",
          apiKey: fileApiKey,
          systemPrompt: this.MASTER_SYSTEM_PROMPT,
          delaySeconds: 5,
          autoReply: true,
          slangEnabled: true,
        },
      });
    } else if (!settings.apiKey && fileApiKey) {
      settings = await prisma.whatsAppSetting.update({
        where: { id: "default" },
        data: { apiKey: fileApiKey },
      });
    }

    return settings;
  }

  static async updateSettings(data: {
    gatewayUrl?: string;
    apiKey?: string;
    systemPrompt?: string;
    delaySeconds?: number;
    autoReply?: boolean;
    slangEnabled?: boolean;
  }) {
    return prisma.whatsAppSetting.upsert({
      where: { id: "default" },
      update: data,
      create: {
        id: "default",
        gatewayUrl: data.gatewayUrl || "http://localhost:2785",
        apiKey: data.apiKey || "",
        systemPrompt: data.systemPrompt || this.MASTER_SYSTEM_PROMPT,
        delaySeconds: data.delaySeconds ?? 5,
        autoReply: data.autoReply ?? true,
        slangEnabled: data.slangEnabled ?? true,
      },
    });
  }

  static async getSessions() {
    const sessions = await prisma.whatsAppSession.findMany({
      orderBy: { createdAt: "desc" },
    });

    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);

    for (const session of sessions) {
      try {
        const response = await axios.get(`${settings.gatewayUrl}/api/sessions`, {
          headers,
          timeout: 3000,
        });

        if (Array.isArray(response.data)) {
          const matched = response.data.find(
            (s: any) => s.id === session.sessionId || s.name === session.sessionId
          );

          if (matched) {
            let qrCodeUrl = session.qrCodeUrl;
            let status = matched.status?.toUpperCase() || session.status;

            if (matched.status === "qr_ready" || status === "SCAN_QR_CODE") {
              status = "SCAN_QR_CODE";
              try {
                const qrRes = await axios.get(
                  `${settings.gatewayUrl}/api/sessions/${matched.id}/qr`,
                  { headers, timeout: 3000 }
                );
                if (qrRes.data && (qrRes.data.qrCode || qrRes.data.qr)) {
                  qrCodeUrl = qrRes.data.qrCode || qrRes.data.qr;
                }
              } catch (e) {}
            } else if (
              matched.status === "ready" ||
              matched.status === "working" ||
              matched.status === "connected"
            ) {
              status = "WORKING";
              qrCodeUrl = null;
              this.ensureWebhook(matched.id, settings.gatewayUrl, headers).catch(() => {});
            }

            await prisma.whatsAppSession.update({
              where: { id: session.id },
              data: {
                status,
                qrCodeUrl,
                phoneNumber: matched.phone || session.phoneNumber,
              },
            });
            session.status = status;
            session.qrCodeUrl = qrCodeUrl;
            session.phoneNumber = matched.phone || session.phoneNumber;
          }
        }
      } catch (err) {}
    }

    return sessions;
  }

  static async startSession(rawSessionId: string = "sales-agent-1") {
    const sessionId = this.sanitizeSessionId(rawSessionId);
    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);

    let dbSession = await prisma.whatsAppSession.findUnique({
      where: { sessionId },
    });

    if (!dbSession) {
      dbSession = await prisma.whatsAppSession.create({
        data: {
          sessionId,
          engine: "whatsapp-web.js",
          status: "STARTING",
        },
      });
    }

    const openwaSessionId = await this.resolveSessionUuid(sessionId, settings.gatewayUrl, headers);

    try {
      await axios.post(
        `${settings.gatewayUrl}/api/sessions/${openwaSessionId}/start`,
        {},
        { headers, timeout: 10000 }
      );
    } catch (e: any) {}

    try {
      const statusRes = await axios.get(
        `${settings.gatewayUrl}/api/sessions/${openwaSessionId}`,
        { headers, timeout: 3000 }
      );
      const currentStatus = (statusRes.data?.status || "").toLowerCase();
      if (statusRes.data && (currentStatus === "ready" || currentStatus === "connected" || currentStatus === "working")) {
        this.ensureWebhook(openwaSessionId, settings.gatewayUrl, headers).catch(() => {});
        const updated = await prisma.whatsAppSession.update({
          where: { id: dbSession.id },
          data: {
            status: "WORKING",
            qrCodeUrl: null,
            phoneNumber: statusRes.data.phone || undefined,
          },
        });
        return updated;
      }
    } catch (e) {}

    let qrCodeUrl = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const qrRes = await axios.get(
          `${settings.gatewayUrl}/api/sessions/${openwaSessionId}/qr`,
          { headers, timeout: 4000 }
        );

        if (qrRes.data) {
          const rawQr = qrRes.data.qrCode || qrRes.data.qr;
          if (rawQr) {
            qrCodeUrl = rawQr;
            break;
          }
        }
      } catch (e) {}
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!qrCodeUrl) {
      this.ensureWebhook(openwaSessionId, settings.gatewayUrl, headers).catch(() => {});
    }

    const updated = await prisma.whatsAppSession.update({
      where: { id: dbSession.id },
      data: {
        status: qrCodeUrl ? "SCAN_QR_CODE" : "WORKING",
        qrCodeUrl,
      },
    });

    return updated;
  }

  static async resetSession(rawSessionId: string = "sales-agent-1") {
    const sessionId = this.sanitizeSessionId(rawSessionId);
    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);

    let dbSession = await prisma.whatsAppSession.findUnique({
      where: { sessionId },
    });

    const openwaSessionId = await this.resolveSessionUuid(sessionId, settings.gatewayUrl, headers);

    try {
      await axios.post(
        `${settings.gatewayUrl}/api/sessions/${openwaSessionId}/stop`,
        {},
        { headers, timeout: 5000 }
      );
    } catch (e) {}

    try {
      await axios.delete(
        `${settings.gatewayUrl}/api/sessions/${openwaSessionId}`,
        { headers, timeout: 5000 }
      );
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 800));

    let newOpenwaId = openwaSessionId;
    try {
      const createRes = await axios.post(
        `${settings.gatewayUrl}/api/sessions`,
        { name: sessionId },
        { headers, timeout: 8000 }
      );
      if (createRes.data && createRes.data.id) {
        newOpenwaId = createRes.data.id;
      }
    } catch (e) {}

    try {
      await axios.post(
        `${settings.gatewayUrl}/api/sessions/${newOpenwaId}/start`,
        {},
        { headers, timeout: 10000 }
      );
    } catch (e) {}

    let qrCodeUrl: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const qrRes = await axios.get(
          `${settings.gatewayUrl}/api/sessions/${newOpenwaId}/qr`,
          { headers, timeout: 4000 }
        );

        if (qrRes.data) {
          const rawQr = qrRes.data.qrCode || qrRes.data.qr || (typeof qrRes.data === 'string' ? qrRes.data : null);
          if (rawQr) {
            qrCodeUrl = rawQr.startsWith('data:') ? rawQr : `data:image/png;base64,${rawQr}`;
            break;
          }
        }
      } catch (e) {}
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!dbSession) {
      dbSession = await prisma.whatsAppSession.create({
        data: {
          sessionId,
          engine: "whatsapp-web.js",
          status: qrCodeUrl ? "SCAN_QR_CODE" : "STARTING",
          qrCodeUrl,
        },
      });
    } else {
      dbSession = await prisma.whatsAppSession.update({
        where: { id: dbSession.id },
        data: {
          status: qrCodeUrl ? "SCAN_QR_CODE" : "STARTING",
          qrCodeUrl,
          phoneNumber: null,
          updatedAt: new Date(),
        },
      });
    }

    return dbSession;
  }

  static async requestPairingCode(rawSessionId: string = "sales-agent-1", rawPhone: string) {
    const sessionId = this.sanitizeSessionId(rawSessionId);
    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);

    const phoneNumber = rawPhone.replace(/\D/g, "");
    if (!phoneNumber || phoneNumber.length < 8) {
      throw new Error("Invalid phone number format. Please provide full international number with country code.");
    }

    const openwaSessionId = await this.resolveSessionUuid(sessionId, settings.gatewayUrl, headers);

    try {
      await axios.post(
        `${settings.gatewayUrl}/api/sessions/${openwaSessionId}/start`,
        {},
        { headers, timeout: 8000 }
      );
    } catch (e) {}

    try {
      const res = await axios.post(
        `${settings.gatewayUrl}/api/sessions/${openwaSessionId}/pairing-code`,
        { phoneNumber },
        { headers, timeout: 10000 }
      );

      const pairingCode = res.data?.pairingCode || res.data?.code || res.data;

      if (!pairingCode) {
        throw new Error("OpenWA did not return a pairing code. Please use the QR Code scan mode.");
      }

      const dbSession = await prisma.whatsAppSession.findUnique({ where: { sessionId } });
      if (dbSession) {
        await prisma.whatsAppSession.update({
          where: { id: dbSession.id },
          data: {
            status: "PAIRING_CODE",
            phoneNumber,
          },
        });
      }

      return { success: true, pairingCode: String(pairingCode) };
    } catch (err: any) {
      const detail = err.response?.data?.message || err.message;
      throw new Error(
        `Pairing code API is not supported by current engine state: ${detail}. Please use the QR Code Scan mode instead.`
      );
    }
  }

  static async connectLeads(input: ConnectLeadsInput) {
    const { leadIds, leadType, sessionId = "sales-agent-1" } = input;

    let session = await prisma.whatsAppSession.findUnique({
      where: { sessionId: this.sanitizeSessionId(sessionId) },
    });

    if (!session) {
      session = await this.startSession(sessionId);
    }

    const sessionReady = await this.isSessionReady(session);
    if (!sessionReady) {
      console.warn(`[WhatsAppService] Session ${session.sessionId} is not ready — refusing to queue sends`);
      return {
        success: false,
        error:
          "WhatsApp session is not connected yet. Scan the QR code in the Connection tab first, then reconnect leads.",
        connectedCount: 0,
        outreaches: [],
      };
    }

    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);
    this.resolveSessionUuid(session.sessionId, settings.gatewayUrl, headers)
      .then((uuid) => this.ensureWebhook(uuid, settings.gatewayUrl, headers).catch(() => {}))
      .catch(() => {});

    const createdOutreaches = [];

    for (const id of leadIds) {
      let contactPhone: string | null = input.customPhone || null;
      let recipientName: string | null = input.customName || null;
      let leadData: any = null;

      if (leadType === "lead") {
        leadData = await prisma.lead.findUnique({ where: { id } }).catch(() => null);
        if (leadData) {
          contactPhone = contactPhone || leadData.contactPhone;
          recipientName = recipientName || leadData.companyName || leadData.jobTitle || "Lead";
        }
      } else if (leadType === "maps_lead") {
        leadData = await prisma.mapsLead.findUnique({ where: { id } }).catch(() => null);
        if (leadData) {
          contactPhone = contactPhone || leadData.phone;
          recipientName = recipientName || leadData.businessName;
        }
      } else if (leadType === "icp_prospect") {
        leadData = await prisma.icpProspect.findUnique({ where: { id } }).catch(() => null);
        if (leadData) {
          recipientName = recipientName || leadData.companyName;
          if (leadData.contacts && !contactPhone) {
            try {
              const contacts = JSON.parse(leadData.contacts);
              if (contacts.length > 0 && contacts[0].phone) {
                contactPhone = contacts[0].phone;
              }
            } catch (e) {}
          }
        }
      }

      if (!contactPhone) {
        contactPhone = id;
      }
      if (!recipientName) {
        recipientName = input.customName || `Direct Lead (+${id.replace(/[^\d]/g, "")})`;
      }

      const rawDigits = contactPhone.replace(/[^\d]/g, "");
      const jid = rawDigits.endsWith("@c.us") ? rawDigits : `${rawDigits}@c.us`;

      let initialHook = "";
      if (input.customHook && input.customHook.trim()) {
        initialHook = input.customHook.trim();
      } else if (leadType === "icp_prospect" && leadData?.outreachAngle && leadData.outreachAngle.trim()) {
        initialHook = leadData.outreachAngle.trim();
      } else {
        const leadMock = {
          contactPhone,
          phone: contactPhone,
          recipientName,
          name: recipientName,
          companyName: input.customCompany || leadData?.companyName || recipientName,
          jobTitle: input.customJobTitle || leadData?.jobTitle || leadData?.role,
          sector: input.customSector || leadData?.sector || leadData?.niche,
        };
        initialHook = this.generateInitialHook(leadMock, leadType, settings.slangEnabled);
      }

      const outreach = await prisma.whatsAppOutreach.create({
        data: {
          leadId: id,
          leadType,
          contactPhone: jid,
          recipientName,
          status: "queued",
          initialHook,
          sessionId: session.id,
        },
      });

      if (leadData) {
        try {
          if (leadType === "lead") {
            await prisma.lead.update({ where: { id }, data: { status: "whatsapp_queued" } });
          } else if (leadType === "maps_lead") {
            await prisma.mapsLead.update({ where: { id }, data: { status: "whatsapp_queued" } });
          } else if (leadType === "icp_prospect") {
            await prisma.icpProspect.update({ where: { id }, data: { status: "whatsapp_queued" } });
          }
        } catch (e) {}
      }

      if (input.autoSend !== false) {
        try {
          await enqueueSend({
            outreachId: outreach.id,
            chatId: jid,
            text: initialHook,
            kind: "hook",
          });
          await drainQueueOnce();
          outreach.status = "sent";
        } catch (err: any) {
          console.warn(`[WhatsAppService] Could not auto-send hook for ${jid}:`, err?.message);
        }
      } else {
        try {
          await enqueueSend({
            outreachId: outreach.id,
            chatId: jid,
            text: initialHook,
            kind: "hook",
          });
        } catch (err) {
          console.warn(`[WhatsAppService] Could not enqueue hook for ${jid}: ${err}`);
        }
      }

      createdOutreaches.push(outreach);
    }
    return {
      success: true,
      connectedCount: createdOutreaches.length,
      queuedCount: createdOutreaches.length,
      outreaches: createdOutreaches,
    };
  }

  public static applyAntiBanPersonalization(text: string): string {
    if (!text) return text;

    const spinText = text.replace(/\{([^{}]+)\}/g, (_, choices) => {
      const parts = choices.split("|");
      return parts[Math.floor(Math.random() * parts.length)].trim();
    });

    const zwChars = ["\u200B", "\u200C", "\u200D"];
    const randomZw = Array.from({ length: 1 + Math.floor(Math.random() * 3) })
      .map(() => zwChars[Math.floor(Math.random() * zwChars.length)])
      .join("");

    return spinText + randomZw;
  }

  private static generateInitialHook(lead: any, leadType: string, slangEnabled: Boolean): string {
    const name = lead?.recipientName || lead?.name || lead?.contactName || "";
    const nameGreeting = name && name !== "Lead" && !name.startsWith("Direct Lead") ? ` ${name}` : "";

    if (leadType === "icp_prospect" || leadType === "csv_lead") {
      const company = lead.companyName || "your team";
      const sector = lead.sector || lead.niche || "your sector";
      return this.applyAntiBanPersonalization(
        `{Hi|Hello|Greetings}${nameGreeting}! 👋\n\n` +
        `I'm an AI Agent & Solution Specialist with Reference Agency (HR & B2B AI Consulting).\n\n` +
        `{Noticed|Saw|Following} ${company}'s {expansion|growth|developments} in ${sector}.\n\n` +
        `We {re-engineer and fix manual business & HR workflows first|optimize operational processes first before automating them} with custom AI solutions to eliminate bottlenecks with 100% data privacy.\n\n` +
        `We're offering a Free 30-Min AI Readiness & Workflow Assessment Meeting to evaluate your operations.\n\n` +
        `{Open to a quick free session this week?|Would you be open to booking a quick free session?|Shall we schedule your 30-minute free assessment?}`
      );
    }

    if (leadType === "maps_lead") {
      const biz = lead.businessName || lead.name || "your business";
      const niche = lead.niche || "local services";
      const city = lead.city || "your region";
      return this.applyAntiBanPersonalization(
        `{Hi|Hello}${nameGreeting}! 👋\n\n` +
        `I'm an AI Agent & Solution Specialist with Reference Agency.\n\n` +
        `{Impressive operations|Great presence|Outstanding work} in ${city} for ${niche}.\n\n` +
        `We {help businesses streamline HR & client operations|optimize workflow processes before AI deployment} to handle client inquiries and internal tasks seamlessly.\n\n` +
        `We offer a Free 30-Min AI Readiness & Workflow Assessment Meeting to map your operational requirements.\n\n` +
        `{Would you be open to taking a quick look?|Open to a quick free session?|Shall we coordinate a brief 30-minute free call?}`
      );
    }

    const job = lead.jobTitle || lead.role || "Hiring Manager";
    const company = lead.companyName || "your company";
    return this.applyAntiBanPersonalization(
      `{Hi|Hello}${nameGreeting}! 👋\n\n` +
      `{Saw|Noticed} ${company} is expanding roles for ${job}.\n\n` +
      `At Reference Agency, we {optimize HR & recruitment workflows first|re-engineer candidate screening processes} before deploying custom AI solutions to automate 80% of manual follow-ups.\n\n` +
      `We offer a Free 30-Min AI Readiness & HR Workflow Assessment Meeting to evaluate your bottlenecks.\n\n` +
      `{Open to booking a quick free session?|Would you be open to a 30-minute assessment?|Shall we set up a quick free consultation?}`
    );
  }

  static async getOutreaches() {
    return prisma.whatsAppOutreach.findMany({
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        session: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  static async getRedisChats(limit = 100) {
    const { listActiveChats, getRecentMessages } = await import("@/lib/chat-store");
    const chats = await listActiveChats(limit);
    return Promise.all(
      chats.map(async (chat) => ({
        ...chat,
        recentMessages: await getRecentMessages(chat.jid, 10),
      }))
    );
  }

  static async sendMessage(outreachId: string, text: string) {
    const outreach = await prisma.whatsAppOutreach.findUnique({
      where: { id: outreachId },
      include: { session: true },
    });

    if (!outreach) throw new Error("Outreach conversation not found");

    const ready = await this.isSessionReady(outreach.session);
    if (!ready) {
      throw new Error("WhatsApp session is not connected — please check the Connection tab");
    }

    const settings = await this.getSettings();
    const apiKey = this.getOpenWaApiKey(settings.apiKey);
    const headers = this.getHeaders(apiKey);

    const sessionUuid = await this.resolveSessionUuid(outreach.session.sessionId, settings.gatewayUrl, headers);

    const digits = outreach.contactPhone.replace(/[^\d]/g, "");
    const formattedChatId = outreach.contactPhone.endsWith("@g.us")
      ? outreach.contactPhone
      : `${digits}@c.us`;

    const res = await axios.post(
      `${settings.gatewayUrl}/api/sessions/${sessionUuid}/messages/send-text`,
      { chatId: formattedChatId, text },
      { headers, timeout: 10000 }
    );
    if (res.status >= 400) throw new Error(`OpenWA send failed (${res.status})`);
    await setLastSentAt(outreach.contactPhone);

    const message = await prisma.whatsAppMessage.create({
      data: {
        outreachId: outreach.id,
        direction: "outbound",
        senderJid: "sdr_agent",
        body: text,
        msgType: "text",
      },
    });

    await prisma.whatsAppOutreach.update({
      where: { id: outreachId },
      data: { status: "sent", updatedAt: new Date() },
    });

    await recordChatMessage(
      outreach.contactPhone,
      { direction: "outbound", senderJid: "sdr_agent", body: text, msgType: "text" },
      { recipientName: outreach.recipientName || undefined, outreachId: outreach.id }
    );

    return message;
  }
}
