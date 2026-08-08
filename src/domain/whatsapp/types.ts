export interface MessageTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  senderJid?: string;
  createdAt?: Date | string;
}

export interface LeadProfileContext {
  recipientName: string;
  contactPhone: string;
  leadType: string;
  companyName?: string;
  jobTitle?: string;
  sector?: string;
  signals?: string;
  initialHook?: string;
  dossierPrompt?: string;
}

export interface AiAgentDecision {
  response: string;
  replyText?: string;
  action?: "REPLY" | "IGNORE" | "HUMAN_TAKEOVER";
  sendBrochure?: boolean;
  confidence?: number;
  sentiment?: "positive" | "neutral" | "negative" | "objection";
  intent?: "pricing" | "demo" | "opt_out" | "question" | "general" | "brochure";
  leadScore?: number;      /// 0–100 interest score delta for this turn
  attachmentUrl?: string;  /// PDF/file URL to send alongside text response
}

export interface WhatsAppAgentSettings {
  gatewayUrl: string;
  apiKey?: string;
  systemPrompt: string;
  delaySeconds: number;
  autoReply: boolean;
  slangEnabled: boolean;
}
