/**
 * OpenWA WhatsApp Gateway API Session Types & DTOs
 */

export enum SessionStatus {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  QR_READY = 'qr_ready',
  AUTHENTICATING = 'authenticating',
  READY = 'ready',
  DISCONNECTED = 'disconnected',
  ACTION_REQUIRED = 'action_required',
  FAILED = 'failed',
}

export interface OpenWaSessionDto {
  id: string;
  name: string;
  status: SessionStatus | string;
  phone?: string | null;
  pushName?: string | null;
  connectedAt?: string | null;
  lastActive?: string | null;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
  engineLoaded: boolean;
}

export interface CreateSessionPayload {
  name: string;
}

export interface QrCodeResponseDto {
  qrCode: string; // Base64 data URL string e.g. "data:image/png;base64,..."
  status: string;
}

export interface RequestPairingCodePayload {
  phoneNumber: string; // Digits only, 6-15 digits
}

export interface PairingCodeResponseDto {
  pairingCode: string; // 8-character string
  status: string;
}

export interface NestJsErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
}
