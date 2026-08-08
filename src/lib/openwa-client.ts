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
    return 'Network Connectivity Error: Unable to reach WhatsApp Gateway API. Please check your Gateway Base URL (e.g. http://localhost:2785/api), ensure the server is running, and verify network connectivity / CORS rules.';
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
 * WhatsApp Gateway API Client Service
 */
export class OpenWaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl = DEFAULT_OPENWA_BASE_URL, apiKey = '') {
    this.baseUrl = sanitizeGatewayUrl(baseUrl);
    this.apiKey = apiKey.trim();
  }

  private get headers(): Record<string, string> {
    return buildGatewayHeaders(this.apiKey);
  }

  /**
   * GET /api/sessions
   * Fetches all sessions (bare array response, no envelope).
   */
  async fetchSessions(): Promise<OpenWaSessionDto[]> {
    const url = `${this.baseUrl}/sessions`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * GET /api/sessions/{id}
   * Fetches a single session by UUID or name.
   */
  async fetchSessionById(id: string): Promise<OpenWaSessionDto> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * POST /api/sessions
   * Creates a new session with strictly { name: string }.
   */
  async createSession(name: string): Promise<OpenWaSessionDto> {
    const url = `${this.baseUrl}/sessions`;
    const payload: CreateSessionPayload = { name: name.trim() };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * POST /api/sessions/{id}/start
   * Starts a session and initializes WhatsApp connection.
   */
  async startSession(id: string): Promise<OpenWaSessionDto> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}/start`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * POST /api/sessions/{id}/stop
   * Stops a session and disconnects WhatsApp.
   */
  async stopSession(id: string): Promise<OpenWaSessionDto> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}/stop`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * POST /api/sessions/{id}/logout
   * Logs out of WhatsApp (unlinks companion device).
   */
  async logoutSession(id: string): Promise<OpenWaSessionDto> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}/logout`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * POST /api/sessions/{id}/force-kill
   * SIGKILL stuck session engine.
   */
  async forceKillSession(id: string): Promise<OpenWaSessionDto> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}/force-kill`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * DELETE /api/sessions/{id}
   * Removes session entirely from gateway (204 No Content).
   */
  async deleteSession(id: string): Promise<void> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.headers,
      });

      if (!res.ok && res.status !== 204) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * GET /api/sessions/{id}/qr
   * Returns QR code dataURL string when status is qr_ready.
   */
  async fetchQrCode(id: string): Promise<QrCodeResponseDto> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}/qr`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }

  /**
   * POST /api/sessions/{id}/pairing-code
   * Requests an 8-character pairing text code for linking via phone number.
   */
  async requestPairingCode(id: string, phoneNumber: string): Promise<PairingCodeResponseDto> {
    const url = `${this.baseUrl}/sessions/${encodeURIComponent(id)}/pairing-code`;
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const payload: RequestPairingCodePayload = { phoneNumber: cleanPhone };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseNestJsError({ response: { status: res.status, data: errData } }));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(parseNestJsError(err));
    }
  }
}
