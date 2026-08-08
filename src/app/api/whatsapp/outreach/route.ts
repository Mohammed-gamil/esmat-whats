import { NextRequest, NextResponse } from "next/server";
import { WhatsAppService } from "@/services/whatsapp-service";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const outreaches = await WhatsAppService.getOutreaches();
    return NextResponse.json({ success: true, outreaches });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch outreaches" },
      { status: 500 }
    );
  }
}
