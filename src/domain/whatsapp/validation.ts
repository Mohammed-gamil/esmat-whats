import { z } from "zod";

export const ConnectLeadsSchema = z.object({
  leadIds: z
    .array(z.string().min(1, "Lead ID cannot be empty"))
    .min(1, "At least one lead ID is required"),
  leadType: z.enum(["lead", "maps_lead", "icp_prospect", "csv_lead"], {
    message: "leadType must be 'lead', 'maps_lead', 'icp_prospect', or 'csv_lead'",
  }),
  sessionId: z.string().optional(),
  customName: z.string().max(200).optional(),
  customPhone: z.string().max(100).optional(),
  customCompany: z.string().max(200).optional(),
  customJobTitle: z.string().max(200).optional(),
  customSector: z.string().max(200).optional(),
  customHook: z.string().max(4000).optional(),
  autoSend: z.boolean().optional(),
});

export type ConnectLeadsInput = z.infer<typeof ConnectLeadsSchema>;

export const SendChatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Valid message text is required")
    .max(4096, "Message text exceeds 4096 character WhatsApp limit"),
});

export type SendChatMessageInput = z.infer<typeof SendChatMessageSchema>;

export const PatchOutreachSchema = z.object({
  id: z.string().min(1, "Outreach ID is required"),
  contactPhone: z.string().trim().max(100).optional(),
  recipientName: z.string().trim().max(200).optional(),
});

export type PatchOutreachInput = z.infer<typeof PatchOutreachSchema>;

export function sanitizeWhatsAppText(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}
