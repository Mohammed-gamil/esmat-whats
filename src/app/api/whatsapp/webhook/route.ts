import { NextRequest, NextResponse } from "next/server";
import { processInboundWebhook } from "@/application/whatsapp/process-inbound-webhook.use-case";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[WhatsAppWebhook] Inbound webhook received:", body?.event || "event");

    const result = await processInboundWebhook(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[WhatsAppWebhook] Webhook processing exception:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    message: "WhatsApp OpenWA Webhook Endpoint Ready",
  });
}
