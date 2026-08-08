import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueSend, drainQueueOnce } from "@/services/send-queue";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { outreachId } = body;

    let targetOutreaches = [];

    if (outreachId) {
      const o = await prisma.whatsAppOutreach.findUnique({
        where: { id: outreachId },
        include: { session: true },
      });
      if (o) targetOutreaches.push(o);
    } else {
      targetOutreaches = await prisma.whatsAppOutreach.findMany({
        where: { status: "queued" },
        include: { session: true },
        take: 20,
      });
    }

    if (targetOutreaches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No queued outreaches to send.",
        dispatchedCount: 0,
      });
    }

    for (const o of targetOutreaches) {
      const text = o.initialHook || "Hello! Reaching out regarding your business AI & workflow needs.";
      await enqueueSend({
        outreachId: o.id,
        chatId: o.contactPhone,
        text,
        kind: "hook",
      });
    }

    await drainQueueOnce();

    return NextResponse.json({
      success: true,
      message: `Dispatched ${targetOutreaches.length} queued outreach message(s)`,
      dispatchedCount: targetOutreaches.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to dispatch queued messages" },
      { status: 500 }
    );
  }
}
