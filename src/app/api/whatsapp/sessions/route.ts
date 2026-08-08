import { NextRequest, NextResponse } from "next/server";
import { WhatsAppService } from "@/services/whatsapp-service";

export async function GET() {
  try {
    const sessions = await WhatsAppService.getSessions();
    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId || "sales-agent-1";
    const session = await WhatsAppService.startSession(sessionId);
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start session" },
      { status: 500 }
    );
  }
}
