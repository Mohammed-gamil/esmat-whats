import { NextRequest, NextResponse } from "next/server";
import { generateLeadIntelligenceDossier, synthesizeLiveDorkPrompt } from "@/domain/whatsapp/lead-dossier-generator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dossier = await generateLeadIntelligenceDossier(id);
    if (!dossier) {
      return NextResponse.json({ success: false, error: "Outreach lead not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, dossier });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dossier = await synthesizeLiveDorkPrompt(id);
    if (!dossier) {
      return NextResponse.json({ success: false, error: "Dossier synthesis failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true, dossier });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
