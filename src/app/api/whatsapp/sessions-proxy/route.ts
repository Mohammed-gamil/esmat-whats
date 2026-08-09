import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { WhatsAppService } from "@/services/whatsapp-service";
import { formatWhatsAppPhone } from "@/lib/phone-formatter";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, id, name, phoneNumber, simulateTyping, defaultCountryCode, groupId } = body;

    const rawUrl = process.env.OPENWA_GATEWAY_URL || process.env.OPENWA_URL || "http://localhost:2785";
    let targetUrl = rawUrl.trim().replace(/\/+$/, "");
    if (!targetUrl.endsWith("/api")) {
      targetUrl = `${targetUrl}/api`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    
    const key = WhatsAppService.getOpenWaApiKey();
    if (key) {
      headers["X-API-Key"] = key;
      headers["Authorization"] = `Bearer ${key}`;
    }

    // Increased timeout to 60 seconds (60000ms) to prevent 15000ms timeout aborts
    const HTTP_TIMEOUT = 60000;

    try {
      if (action === "list") {
        const res = await axios.get(`${targetUrl}/sessions`, { headers, timeout: 15000 });
        return NextResponse.json({ success: true, sessions: res.data });
      }

      if (action === "get" && id) {
        const res = await axios.get(`${targetUrl}/sessions/${encodeURIComponent(id)}`, { headers, timeout: 15000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "create" && name) {
        const res = await axios.post(`${targetUrl}/sessions`, { name: name.trim() }, { headers, timeout: 20000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "start" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${encodeURIComponent(id)}/start`, {}, { headers, timeout: 30000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "stop" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${encodeURIComponent(id)}/stop`, {}, { headers, timeout: 20000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "logout" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${encodeURIComponent(id)}/logout`, {}, { headers, timeout: 20000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "force-kill" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${encodeURIComponent(id)}/force-kill`, {}, { headers, timeout: 15000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "delete" && id) {
        await axios.delete(`${targetUrl}/sessions/${encodeURIComponent(id)}`, { headers, timeout: 15000 });
        return NextResponse.json({ success: true });
      }

      if (action === "qr" && id) {
        const res = await axios.get(`${targetUrl}/sessions/${encodeURIComponent(id)}/qr`, { headers, timeout: 15000 });
        return NextResponse.json({ success: true, qr: res.data });
      }

      if (action === "pairing-code" && id) {
        const cleanPhone = formatWhatsAppPhone(phoneNumber || "", defaultCountryCode || "20");
        const res = await axios.post(`${targetUrl}/sessions/${encodeURIComponent(id)}/pairing-code`, { phoneNumber: cleanPhone }, { headers, timeout: HTTP_TIMEOUT });
        return NextResponse.json({ success: true, pairing: res.data });
      }

      if (action === "groups" && id) {
        const res = await axios.get(`${targetUrl}/sessions/${encodeURIComponent(id)}/groups`, { headers, timeout: 20000 });
        return NextResponse.json({ success: true, groups: res.data });
      }

      if (action === "group-info" && id && groupId) {
        const res = await axios.get(`${targetUrl}/sessions/${encodeURIComponent(id)}/groups/${encodeURIComponent(groupId)}`, { headers, timeout: 20000 });
        return NextResponse.json({ success: true, groupInfo: res.data });
      }

      if (action === "send-text") {
        const rawChatId = String(body.chatId || "").trim();
        const text = String(body.text || "").trim();

        if (!rawChatId || !text) {
          return NextResponse.json(
            { success: false, error: "Missing required chatId or text payload" },
            { status: 400 }
          );
        }

        // 1. Resolve active/ready session ID from OpenWA Gateway
        const listRes = await axios.get(`${targetUrl}/sessions`, { headers, timeout: 10000 }).catch(() => null);
        let activeSessionId = id;

        if (!activeSessionId && Array.isArray(listRes?.data) && listRes.data.length > 0) {
          const readySess = listRes.data.find((s: any) => {
            const st = (s.status || "").toLowerCase();
            return st === "ready" || st === "working" || st === "connected" || st === "authenticated";
          });
          activeSessionId = readySess?.id || listRes.data[0]?.id;
        }

        if (!activeSessionId) {
          return NextResponse.json(
            {
              success: false,
              error: "No active WhatsApp session connected. Please connect a WhatsApp session in Step 1 first.",
            },
            { status: 400 }
          );
        }

        // Format phone with +20 Egypt / country code auto-prefix
        let formattedChatId = rawChatId;
        if (!rawChatId.endsWith("@g.us") && !rawChatId.endsWith("@lid")) {
          const cleanPhone = formatWhatsAppPhone(rawChatId, defaultCountryCode || "20");
          formattedChatId = `${cleanPhone}@c.us`;
        }

        // Optional Human Typing Simulation delay
        if (simulateTyping) {
          const typingMs = Math.min(Math.max(text.length * 35, 1200), 4000);
          await new Promise((resolve) => setTimeout(resolve, typingMs));
        }

        const res = await axios.post(
          `${targetUrl}/sessions/${encodeURIComponent(activeSessionId)}/messages/send-text`,
          { chatId: formattedChatId, text },
          { headers, timeout: HTTP_TIMEOUT }
        );

        return NextResponse.json({ success: true, result: res.data });
      }
    } catch (apiError: any) {
      if (apiError.code === "ECONNREFUSED" || apiError.message?.includes("ECONNREFUSED")) {
        return NextResponse.json(
          {
            success: false,
            error: "WhatsApp Gateway server is currently offline or starting up on port 2785.",
          },
          { status: 503 }
        );
      }
      if (apiError.code === "ECONNABORTED" || apiError.message?.includes("timeout")) {
        return NextResponse.json(
          {
            success: false,
            error: "Gateway request timed out. The operation is taking longer than expected. Please verify session status.",
          },
          { status: 504 }
        );
      }
      const errorMsg = apiError.response?.data?.message || apiError.message || "Gateway API error";
      return NextResponse.json(
        { success: false, error: Array.isArray(errorMsg) ? errorMsg.join("; ") : errorMsg },
        { status: apiError.response?.status || 500 }
      );
    }

    return NextResponse.json({ success: false, error: "Invalid action specified" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Proxy request error" }, { status: 500 });
  }
}
