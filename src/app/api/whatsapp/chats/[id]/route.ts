import { NextRequest, NextResponse } from "next/server";
import { WhatsAppService } from "@/services/whatsapp-service";
import { SendChatMessageSchema } from "@/domain/whatsapp/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const parsed = SendChatMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid message payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const message = await WhatsAppService.sendMessage(id, parsed.data.message);
    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send message" },
      { status: 500 }
    );
  }
}
