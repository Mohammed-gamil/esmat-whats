'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode as QrIcon,
  Phone,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Smartphone,
  Info,
} from 'lucide-react';
import { OpenWaSessionDto, QrCodeResponseDto } from '@/types/openwa-session';
import { OpenWaClient } from '@/lib/openwa-client';

interface OpenWaQrPairingModalProps {
  session: OpenWaSessionDto;
  baseUrl: string;
  apiKey: string;
  onClose: () => void;
  onSessionUpdated?: () => void;
}

export function OpenWaQrPairingModal({
  session,
  baseUrl,
  apiKey,
  onClose,
  onSessionUpdated,
}: OpenWaQrPairingModalProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'pairing'>('qr');

  // QR State
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState<boolean>(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrRefreshSeconds, setQrRefreshSeconds] = useState<number>(20);

  // Pairing Code State
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>('');
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState<boolean>(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const qrIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const client = new OpenWaClient(baseUrl, apiKey);

  // Fetch QR Code function
  const fetchQr = async () => {
    setLoadingQr(true);
    setQrError(null);
    try {
      const res = await client.fetchQrCode(session.id);
      if (res && res.qrCode) {
        setQrCodeData(res.qrCode);
      } else {
        setQrError('QR code string not ready yet. Retrying...');
      }
    } catch (err: any) {
      setQrError(err.message || 'Failed to load QR code. Session might be authenticating.');
    } finally {
      setLoadingQr(false);
      setQrRefreshSeconds(20);
    }
  };

  // Setup QR polling interval (every 20 seconds while status is qr_ready)
  useEffect(() => {
    fetchQr();

    qrIntervalRef.current = setInterval(() => {
      fetchQr();
    }, 20000);

    timerRef.current = setInterval(() => {
      setQrRefreshSeconds((prev) => (prev > 1 ? prev - 1 : 20));
    }, 1000);

    return () => {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session.id]);

  // Request Pairing Code
  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumberInput.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 6 || cleanPhone.length > 15) {
      setPairingError(
        'Phone number must contain 6 to 15 digits in international format (e.g. 628123456789 or 14155550123).'
      );
      return;
    }

    setPairingLoading(true);
    setPairingError(null);
    setPairingCodeResult(null);

    try {
      const res = await client.requestPairingCode(session.id, cleanPhone);
      if (res && res.pairingCode) {
        setPairingCodeResult(res.pairingCode);
        if (onSessionUpdated) onSessionUpdated();
      } else {
        setPairingError('Gateway returned empty pairing code.');
      }
    } catch (err: any) {
      setPairingError(err.message || 'Failed to request pairing code.');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!pairingCodeResult) return;
    navigator.clipboard.writeText(pairingCodeResult);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0d2530] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <QrIcon className="w-5 h-5 text-[#ff8c5a]" />
              <span>Authenticate WhatsApp Session</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5 font-mono">
              Session Name: <span className="text-[#ff8c5a] font-bold">{session.name}</span> ({session.id})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#081419] hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: QR Code vs Pairing Code */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[#081419] border border-white/10">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'qr'
                ? 'bg-brand-gradient text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <QrIcon className="w-4 h-4" />
            <span>Scan QR Code</span>
          </button>

          <button
            onClick={() => setActiveTab('pairing')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'pairing'
                ? 'bg-brand-gradient text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>8-Digit Pairing Code</span>
          </button>
        </div>

        {/* Tab 1: QR Code View */}
        {activeTab === 'qr' && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-slate-300">
              Open WhatsApp on your mobile phone &gt; Settings &gt; Linked Devices &gt; Link a Device, and scan the QR code below:
            </p>

            <div className="relative mx-auto w-64 h-64 bg-white rounded-2xl p-3 border-4 border-[#f05a28]/30 shadow-2xl flex items-center justify-center">
              {loadingQr && !qrCodeData ? (
                <div className="flex flex-col items-center justify-center text-slate-800 space-y-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#f05a28]" />
                  <span className="text-xs font-mono font-semibold">Generating QR Code...</span>
                </div>
              ) : qrError && !qrCodeData ? (
                <div className="p-3 text-center text-xs text-rose-600 space-y-2">
                  <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
                  <span>{qrError}</span>
                  <button
                    onClick={fetchQr}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded font-semibold text-[11px]"
                  >
                    Retry Fetching QR
                  </button>
                </div>
              ) : qrCodeData ? (
                <img
                  src={qrCodeData}
                  alt="WhatsApp Gateway QR Code"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <span className="text-xs text-slate-500">QR Code Unavailable</span>
              )}
            </div>

            {/* QR Refetch Counter */}
            <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-[#081419] border border-white/10 text-xs font-mono">
              <span className="text-white/50 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingQr ? 'animate-spin text-[#ff8c5a]' : 'text-slate-400'}`} />
                Auto-refreshes in {qrRefreshSeconds}s
              </span>
              <button
                onClick={fetchQr}
                disabled={loadingQr}
                className="text-[#ff8c5a] hover:underline font-bold"
              >
                Refresh Now
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: 8-Digit Pairing Code Fallback */}
        {activeTab === 'pairing' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Link via Phone Number: Enter your WhatsApp phone number to request an 8-character pairing code:
            </p>

            <form onSubmit={handleRequestPairingCode} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1">
                  Phone Number (International digits only, no + or spaces):
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={phoneNumberInput}
                      onChange={(e) => setPhoneNumberInput(e.target.value)}
                      placeholder="e.g. 628123456789 or 14155550123"
                      className="w-full bg-[#081419] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#f05a28]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pairingLoading || !phoneNumberInput.trim()}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white disabled:opacity-40 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {pairingLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Get Code</span>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Error Message */}
            {pairingError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{pairingError}</span>
              </div>
            )}

            {/* Formatted Pairing Code Result Display */}
            {pairingCodeResult && (
              <div className="p-4 rounded-xl bg-[#081419] border border-[#10b981]/40 text-center space-y-2">
                <span className="text-[11px] text-white/60 uppercase font-mono block">
                  Your 8-Character WhatsApp Pairing Code:
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-black font-mono tracking-widest text-[#10b981] bg-[#10b981]/10 px-4 py-2 rounded-xl border border-[#10b981]/30">
                    {pairingCodeResult.slice(0, 4)} - {pairingCodeResult.slice(4)}
                  </span>
                  <button
                    onClick={handleCopyPairingCode}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="Copy code"
                  >
                    {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Open WhatsApp on phone &gt; Linked Devices &gt; Link with phone number instead &gt; Type code above.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer info note */}
        <div className="p-3 rounded-xl bg-[#081419] border border-white/5 text-[11px] text-white/50 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Once linked, WhatsApp session status will automatically transition from <code className="text-amber-300">qr_ready</code> to <code className="text-emerald-400 font-bold">ready</code>.
          </span>
        </div>
      </div>
    </div>
  );
}
