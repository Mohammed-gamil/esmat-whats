import { prisma } from "@/lib/prisma";
import { getZohoConfig, sendPayloadToZoho } from "@/lib/zoho-client";

const QUALIFY_THRESHOLD = 60;

export interface QualifyResult {
  newScore: number;
  qualified: boolean;
  zohoSynced: boolean;
  zohoError?: string;
}

export async function applyLeadScore(
  outreachId: string,
  scoreDelta: number
): Promise<QualifyResult> {
  if (!scoreDelta || scoreDelta <= 0) {
    return { newScore: 0, qualified: false, zohoSynced: false };
  }

  let outreach: any;
  try {
    outreach = await prisma.whatsAppOutreach.update({
      where: { id: outreachId },
      data: {
        leadScore: { increment: scoreDelta },
      },
      include: { session: true },
    });
  } catch (err: any) {
    console.warn("[LeadQualifier] Could not update leadScore:", err?.message);
    return { newScore: 0, qualified: false, zohoSynced: false };
  }

  const newScore: number = outreach.leadScore ?? 0;
  const wasAlreadyQualified = outreach.status === "qualified";

  if (newScore >= QUALIFY_THRESHOLD && !wasAlreadyQualified) {
    try {
      await prisma.whatsAppOutreach.update({
        where: { id: outreachId },
        data: { status: "qualified" },
      });
      console.log(
        `[LeadQualifier] Outreach ${outreachId} auto-qualified (score=${newScore})`
      );
    } catch {
      /* non-fatal */
    }

    const zohoResult = await syncQualifiedLeadToZoho(outreach);
    return {
      newScore,
      qualified: true,
      zohoSynced: zohoResult.success,
      zohoError: zohoResult.error,
    };
  }

  return { newScore, qualified: wasAlreadyQualified, zohoSynced: false };
}

async function syncQualifiedLeadToZoho(
  outreach: any
): Promise<{ success: boolean; error?: string }> {
  let config: any;
  try {
    config = await getZohoConfig();
  } catch {
    return { success: false, error: "Zoho config not available" };
  }

  if (!config?.zohoEnabled) {
    return { success: false, error: "Zoho integration disabled" };
  }

  const phone = outreach.contactPhone?.replace("@c.us", "").replace("@s.whatsapp.net", "");
  const payload = {
    Company:
      outreach.recipientName ||
      `WhatsApp Lead (${phone})`,
    Last_Name: outreach.recipientName || "WhatsApp Contact",
    Phone: phone || undefined,
    Lead_Source: "WhatsApp AI Sales Agent",
    Lead_Status: "Qualified",
    Description: [
      `WhatsApp Lead ID: ${outreach.id}`,
      `Lead Type: ${outreach.leadType}`,
      `Interest Score: ${outreach.leadScore}/100`,
      `Sentiment: ${outreach.sentiment || "N/A"}`,
      `Initial Hook: ${outreach.initialHook || "N/A"}`,
    ].join("\n"),
    Rating: "Hot",
  };

  try {
    const result = await sendPayloadToZoho([payload], config);
    if (result.success) {
      console.log(
        `[LeadQualifier] Zoho CRM sync OK for outreach ${outreach.id} (score=${outreach.leadScore})`
      );
    } else {
      console.warn("[LeadQualifier] Zoho CRM sync failed:", result.error);
    }
    return result;
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}
