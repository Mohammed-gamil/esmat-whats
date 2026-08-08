import { NextRequest, NextResponse } from "next/server";
import { WhatsAppService } from "@/services/whatsapp-service";
import { ConnectLeadsSchema } from "@/domain/whatsapp/validation";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = ConnectLeadsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }
    const result = await WhatsAppService.connectLeads(parsed.data);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to connect leads" },
      { status: 500 }
    );
  }
}
