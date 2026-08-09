import {
  CreateSessionPayload,
  NestJsErrorResponse,
  OpenWaSessionDto,
  PairingCodeResponseDto,
  QrCodeResponseDto,
  RequestPairingCodePayload,
} from '@/types/openwa-session';

/**
 * Standard default WhatsApp gateway REST base URL
 */
export const DEFAULT_OPENWA_BASE_URL = 'http://localhost:2785/api';

/**
 * Sanitizes base URL ensuring no trailing slash and adding /api if missing
 */
export function sanitizeGatewayUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.trim()) return DEFAULT_OPENWA_BASE_URL;
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api') && !clean.includes('/api/')) {
    clean = `${clean}/api`;
  }
  return clean;
}

/**
 * Constructs request headers with X-API-Key (NEVER query params)
 */
export function buildGatewayHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey && apiKey.trim()) {
    headers['X-API-Key'] = apiKey.trim();
  }
  return headers;
}

/**
 * Parses NestJS standard error response and NetworkError/CORS issues cleanly
 */
export function parseNestJsError(error: any): string {
  if (!error) return 'An unknown error occurred';

  const msgStr = String(error.message || error || '');

  // Handle browser NetworkError, CORS failure, or connection refused
  if (
    msgStr.includes('NetworkError') ||
    msgStr.includes('Failed to fetch') ||
    msgStr.includes('TypeError') ||
    msgStr.includes('ECONNREFUSED') ||
    msgStr.includes('Network error')
  ) {
    return 'Unable to reach WhatsApp Gateway API server. Please ensure the gateway process is running.';
  }

  // NestJS structured error response
  if (error.response && error.response.data) {
    const data = error.response.data as NestJsErrorResponse;
    if (data.message) {
      if (Array.isArray(data.message)) {
        return data.message.join('; ');
      }
      return data.message;
    }
    if (data.error) {
      return `${data.error} (Status ${data.statusCode || error.response.status})`;
    }
  }

  if (error.message) return error.message;
  return String(error);
}

/**
 * WhatsApp Gateway API Client Service (Proxy-First Architecture)
 */
export class OpenWaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl = DEFAULT_OPENWA_BASE_URL, apiKey = '') {
    this.baseUrl = sanitizeGatewayUrl(baseUrl);
    this.apiKey = apiKey.trim();
  }

  /**
   * Universal helper to route session actions through server proxy endpoint
   */
  private async callProxy<T>(action: string, payload: Record<string, any> = {}): Promise<T> {
    try {
      const res = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
        cache: 'no-store',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Proxy error (Status ${res.status})`);
      }

      return data as T;
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * GET /api/sessions
   * Fetches all sessions.
   */
  async fetchSessions(): Promise<OpenWaSessionDto[]> {
    try {
      const data: any = await this.callProxy('list');
      return Array.isArray(data.sessions) ? data.sessions : [];
    } catch (err) {
      // Direct fallback if proxy is unavailable
      const url = `${this.baseUrl}/sessions`;
      const res = await fetch(url, {
        method: 'GET',
        headers: buildGatewayHeaders(this.apiKey),
        cache: 'no-store',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }
      const direct = await res.json();
      return Array.isArray(direct) ? direct : [];
    }
  }

  /**
   * GET /api/sessions/{id}
   * Fetches a single session by UUID or name.
   */
  async fetchSessionById(id: string): Promise<OpenWaSessionDto> {
    const data: any = await this.callProxy('get', { id });
    return data.session;
  }

  /**
   * POST /api/sessions
   * Creates a new session with strictly { name: string }.
   */
  async createSession(name: string): Promise<OpenWaSessionDto> {
    const data: any = await this.callProxy('create', { name: name.trim() });
    return data.session;
  }

  /**
   * POST /api/sessions/{id}/start
   * Starts a session and initializes WhatsApp connection.
   */
  async startSession(id: string): Promise<OpenWaSessionDto> {
    const data: any = await this.callProxy('start', { id });
    return data.session;
  }

  /**
   * POST /api/sessions/{id}/stop
   * Stops a session and disconnects WhatsApp.
   */
  async stopSession(id: string): Promise<OpenWaSessionDto> {
    const data: any = await this.callProxy('stop', { id });
    return data.session;
  }

  /**
   * POST /api/sessions/{id}/logout
   * Logs out of WhatsApp (unlinks companion device).
   */
  async logoutSession(id: string): Promise<OpenWaSessionDto> {
    const data: any = await this.callProxy('logout', { id });
    return data.session;
  }

  /**
   * POST /api/sessions/{id}/force-kill
   * SIGKILL stuck session engine.
   */
  async forceKillSession(id: string): Promise<OpenWaSessionDto> {
    const data: any = await this.callProxy('force-kill', { id });
    return data.session;
  }

  /**
   * DELETE /api/sessions/{id}
   * Removes session entirely from gateway.
   */
  async deleteSession(id: string): Promise<void> {
    await this.callProxy('delete', { id });
  }

  /**
   * GET /api/sessions/{id}/qr
   * Returns QR code dataURL string when status is qr_ready.
   */
  async fetchQrCode(id: string): Promise<QrCodeResponseDto> {
    const data: any = await this.callProxy('qr', { id });
    return data.qr;
  }

  /**
   * POST /api/sessions/{id}/pairing-code
   * Requests an 8-character pairing text code for linking via phone number.
   */
  async requestPairingCode(id: string, phoneNumber: string): Promise<PairingCodeResponseDto> {
    const data: any = await this.callProxy('pairing-code', { id, phoneNumber });
    return data.pairing;
  }
}
