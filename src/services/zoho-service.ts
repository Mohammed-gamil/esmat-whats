import { getZohoConfig, sendPayloadToZoho, ZohoLeadPayload } from "@/lib/zoho-client";

export class ZohoService {
  static async pushToZoho(outreach: any): Promise<{ success: boolean; error?: string }> {
    const config = await getZohoConfig();
    if (!config || !config.zohoEnabled) {
      return { success: false, error: "Zoho CRM integration is disabled" };
    }

    const phone = outreach.contactPhone?.replace("@c.us", "").replace("@s.whatsapp.net", "");
    const payload: ZohoLeadPayload = {
      Company: outreach.recipientName || `WhatsApp Lead (${phone})`,
      Last_Name: outreach.recipientName || "WhatsApp Contact",
      Phone: phone || undefined,
      Lead_Source: "WhatsApp AI Sales Agent",
      Lead_Status: outreach.status === "qualified" ? "Qualified" : "Contacted",
      Description: [
        `Outreach ID: ${outreach.id}`,
        `Lead Type: ${outreach.leadType}`,
        `Interest Score: ${outreach.leadScore || 0}/100`,
        `Sentiment: ${outreach.sentiment || "N/A"}`,
        `Initial Hook: ${outreach.initialHook || "N/A"}`,
      ].join("\n"),
      Rating: outreach.leadScore >= 60 ? "Hot" : "Warm",
    };

    return sendPayloadToZoho([payload], config);
  }
}
