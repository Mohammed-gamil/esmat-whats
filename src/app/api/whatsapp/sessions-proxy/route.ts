import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { WhatsAppService } from "@/services/whatsapp-service";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, id, name, phoneNumber } = body;

    const targetUrl = (process.env.OPENWA_GATEWAY_URL || "http://localhost:2785/api").replace(/\/+$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    
    const key = WhatsAppService.getOpenWaApiKey();
    if (key) {
      headers["X-API-Key"] = key;
    }

    try {
      if (action === "list") {
        const res = await axios.get(`${targetUrl}/sessions`, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, sessions: res.data });
      }

      if (action === "get" && id) {
        const res = await axios.get(`${targetUrl}/sessions/${id}`, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "create" && name) {
        const res = await axios.post(`${targetUrl}/sessions`, { name }, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "start" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${id}/start`, {}, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "stop" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${id}/stop`, {}, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "logout" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${id}/logout`, {}, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "force-kill" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${id}/force-kill`, {}, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, session: res.data });
      }

      if (action === "delete" && id) {
        await axios.delete(`${targetUrl}/sessions/${id}`, { headers, timeout: 8000 });
        return NextResponse.json({ success: true });
      }

      if (action === "qr" && id) {
        const res = await axios.get(`${targetUrl}/sessions/${id}/qr`, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, qr: res.data });
      }

      if (action === "pairing-code" && id) {
        const res = await axios.post(`${targetUrl}/sessions/${id}/pairing-code`, { phoneNumber }, { headers, timeout: 8000 });
        return NextResponse.json({ success: true, pairing: res.data });
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
