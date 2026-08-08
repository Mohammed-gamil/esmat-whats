import { NextRequest, NextResponse } from "next/server";
import { listActiveChats } from "@/lib/chat-store";

export async function GET(req: NextRequest) {
  try {
    const chats = await listActiveChats(100);
    return NextResponse.json({ success: true, chats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
