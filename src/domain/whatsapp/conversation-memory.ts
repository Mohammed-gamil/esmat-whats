import { prisma } from "@/lib/prisma";
import { MessageTurn, LeadProfileContext } from "./types";
import { LeadDossierGenerator } from "./lead-dossier-generator";

export class ConversationMemory {
  static async getHistory(outreachId: string, limit: number = 15): Promise<MessageTurn[]> {
    try {
      const messages = await prisma.whatsAppMessage.findMany({
        where: { outreachId },
        orderBy: { createdAt: "asc" },
        take: limit,
      });

      return messages.map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.body,
        senderJid: m.senderJid,
        createdAt: m.createdAt,
      }));
    } catch (e) {
      console.warn(`[ConversationMemory] Could not fetch history for ${outreachId}:`, e);
      return [];
    }
  }

  static async buildLeadContext(outreachId: string): Promise<LeadProfileContext | null> {
    try {
      const outreach = await prisma.whatsAppOutreach.findUnique({
        where: { id: outreachId },
      });

      if (!outreach) return null;

      const dossier = await LeadDossierGenerator.generateDossier(outreachId);

      const profile: LeadProfileContext = {
        recipientName: dossier?.recipientName || outreach.recipientName || "Lead",
        contactPhone: outreach.contactPhone,
        leadType: outreach.leadType,
        companyName: dossier?.companyName || undefined,
        jobTitle: dossier?.jobTitle || undefined,
        sector: dossier?.sector || undefined,
        signals: dossier?.signals || undefined,
        initialHook: outreach.initialHook || undefined,
        dossierPrompt: dossier?.customSystemInstruction || undefined,
      };

      return profile;
    } catch (e) {
      console.warn(`[ConversationMemory] Could not build lead context for ${outreachId}:`, e);
      return null;
    }
  }
}
