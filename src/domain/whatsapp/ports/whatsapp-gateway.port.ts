export interface SessionInfo {
  id: string;
  sessionId: string;
  engine: string;
  phoneNumber?: string;
  status: string;
  qrCodeUrl?: string;
}

export interface IWhatsAppGateway {
  sendText(session: { sessionId: string }, chatId: string, text: string): Promise<boolean>;
  isSessionReady(session: { sessionId: string }): Promise<boolean>;
  ensureWebhook(sessionUuid: string): Promise<void>;
  resolveSessionUuid(sessionId: string): Promise<string>;
}
