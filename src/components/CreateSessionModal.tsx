'use client';

import React, { useState } from 'react';
import {
  Plus,
  X,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { OpenWaClient } from '@/lib/openwa-client';
import { OpenWaSessionDto } from '@/types/openwa-session';

interface CreateSessionModalProps {
  baseUrl: string;
  apiKey: string;
  onClose: () => void;
  onSessionCreated: (session: OpenWaSessionDto) => void;
}

export function CreateSessionModal({
  baseUrl,
  apiKey,
  onClose,
  onSessionCreated,
}: CreateSessionModalProps) {
  const [sessionNameInput, setSessionNameInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const client = new OpenWaClient(baseUrl, apiKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sessionNameInput.trim();

    // Client-side validation matching NestJS CreateSessionDto
    if (!cleanName || cleanName.length < 3 || cleanName.length > 50) {
      setErrorMessage('Session name must be between 3 and 50 characters in length.');
      return;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(cleanName)) {
      setErrorMessage('Session name can only contain letters, numbers, and hyphens (e.g. sales-bot-1).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // POST /api/sessions with strict { name: string } payload
      const created = await client.createSession(cleanName);
      onSessionCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create session on OpenWA gateway.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0d2530] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/30 flex items-center justify-center text-[#ff8c5a]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create WhatsApp Session</h3>
              <p className="text-xs text-white/50">Register a new WhatsApp Gateway session instance</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#081419] hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Note Warning Callout Box */}
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-100">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>WhatsApp Safety & Ban Risk Notice</span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed pl-6">
            This tool operates WhatsApp via an unofficial Web protocol. We strongly recommend linking a{' '}
            <strong className="text-white underline">dedicated or burner phone number</strong> rather than your primary personal account to mitigate potential ban risks.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-200 block mb-1">
              Session Name * (Alphanumeric & Hyphens only)
            </label>
            <input
              type="text"
              value={sessionNameInput}
              onChange={(e) => setSessionNameInput(e.target.value)}
              placeholder="e.g., sales-agent-1"
              maxLength={50}
              className="w-full bg-[#081419] border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#f05a28]"
            />
            <span className="text-[10px] text-white/40 mt-1 block">
              3 to 50 characters. Used as unique identifier on the gateway.
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white/50 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !sessionNameInput.trim()}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white disabled:opacity-40 transition-all shadow-md flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating Session...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Session</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
