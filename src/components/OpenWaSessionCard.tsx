'use client';

import React, { useState } from 'react';
import {
  Play,
  QrCode,
  LogOut,
  Trash2,
  AlertOctagon,
  Phone,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { OpenWaSessionDto, SessionStatus } from '@/types/openwa-session';
import { OpenWaClient } from '@/lib/openwa-client';
import { OpenWaQrPairingModal } from './OpenWaQrPairingModal';

interface OpenWaSessionCardProps {
  session: OpenWaSessionDto;
  baseUrl: string;
  apiKey: string;
  onRefresh: () => void;
  onActionError?: (msg: string) => void;
}

export function OpenWaSessionCard({
  session,
  baseUrl,
  apiKey,
  onRefresh,
  onActionError,
}: OpenWaSessionCardProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const client = new OpenWaClient(baseUrl, apiKey);
  const statusLower = (session.status || '').toLowerCase();

  // Status Badge Colors & Labels
  const getStatusBadge = () => {
    switch (statusLower) {
      case 'ready':
      case 'working':
      case 'connected':
        return {
          label: 'READY / CONNECTED',
          className: 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40 font-bold',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />,
        };
      case 'qr_ready':
        return {
          label: 'QR READY (AUTHENTICATE NOW)',
          className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse font-bold',
          icon: <QrCode className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'authenticating':
        return {
          label: 'AUTHENTICATING...',
          className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse font-semibold',
          icon: <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />,
        };
      case 'initializing':
        return {
          label: 'INITIALIZING ENGINE...',
          className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse font-semibold',
          icon: <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />,
        };
      case 'created':
        return {
          label: 'CREATED (NOT STARTED)',
          className: 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]/40 font-medium',
          icon: <Clock className="w-3.5 h-3.5 text-[#06b6d4]" />,
        };
      case 'disconnected':
        return {
          label: 'DISCONNECTED / STOPPED',
          className: 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-medium',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
        };
      case 'action_required':
        return {
          label: 'ACTION REQUIRED',
          className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'failed':
      default:
        return {
          label: statusLower ? statusLower.toUpperCase() : 'FAILED',
          className: 'bg-rose-500/25 text-rose-300 border-rose-500/40 font-bold',
          icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />,
        };
    }
  };

  const badge = getStatusBadge();

  // Action Handlers
  const handleStart = async () => {
    setLoadingAction('start');
    try {
      await client.startSession(session.id);
      onRefresh();
    } catch (err: any) {
      if (onActionError) onActionError(err.message || 'Failed to start session.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStop = async () => {
    setLoadingAction('stop');
    try {
      await client.stopSession(session.id);
      onRefresh();
    } catch (err: any) {
      if (onActionError) onActionError(err.message || 'Failed to disconnect session.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async () => {
    setLoadingAction('logout');
    try {
      await client.logoutSession(session.id);
      onRefresh();
    } catch (err: any) {
      if (onActionError) onActionError(err.message || 'Failed to log out session.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForceKill = async () => {
    if (!confirm('Force-kill SIGKILL this engine process? Use only if session is stuck.')) return;
    setLoadingAction('force-kill');
    try {
      await client.forceKillSession(session.id);
      onRefresh();
    } catch (err: any) {
      if (onActionError) onActionError(err.message || 'Failed to force-kill session.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    setLoadingAction('delete');
    try {
      await client.deleteSession(session.id);
      setShowDeleteConfirm(false);
      onRefresh();
    } catch (err: any) {
      if (onActionError) onActionError(err.message || 'Failed to delete session.');
    } finally {
      setLoadingAction(null);
    }
  };

  // Inline QR state when status is qr_ready
  const [inlineQrCode, setInlineQrCode] = useState<string | null>(null);
  const [inlineQrLoading, setInlineQrLoading] = useState<boolean>(false);

  React.useEffect(() => {
    if (statusLower === 'qr_ready') {
      const fetchInlineQr = async () => {
        setInlineQrLoading(true);
        try {
          const res = await client.fetchQrCode(session.id);
          if (res && res.qrCode) {
            setInlineQrCode(res.qrCode);
          }
        } catch (e) {
          // ignore background poll errors
        } finally {
          setInlineQrLoading(false);
        }
      };

      fetchInlineQr();
      const interval = setInterval(fetchInlineQr, 8000);
      return () => clearInterval(interval);
    } else {
      setInlineQrCode(null);
    }
  }, [session.id, statusLower]);

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between">
      {/* Session Title & Status Badge */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>{session.name}</span>
              {session.engineLoaded && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/30 font-mono">
                  Engine Loaded
                </span>
              )}
            </h3>
            <span className="text-[11px] font-mono text-white/40 block max-w-[220px] truncate">
              ID: {session.id}
            </span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-xl text-[10px] font-mono border flex items-center gap-1.5 shrink-0 ${badge.className}`}
          >
            {badge.icon}
            <span>{badge.label}</span>
          </span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
          <div className="p-2 rounded-lg bg-[#081419] border border-white/5 space-y-0.5">
            <span className="text-[10px] text-white/40 block">Phone Number</span>
            <span className="text-white font-bold flex items-center gap-1">
              <Phone className="w-3 h-3 text-[#ff8c5a]" />
              {session.phone || <span className="text-white/30 italic font-normal">Not Connected</span>}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#081419] border border-white/5 space-y-0.5">
            <span className="text-[10px] text-white/40 block">Push Profile Name</span>
            <span className="text-white font-bold flex items-center gap-1">
              <User className="w-3 h-3 text-[#06b6d4]" />
              {session.pushName || <span className="text-white/30 italic font-normal">N/A</span>}
            </span>
          </div>
        </div>

        {/* PROMINENT INLINE QR DISPLAY PANEL (When status is qr_ready) */}
        {statusLower === 'qr_ready' && (
          <div className="p-4 rounded-2xl bg-[#081419] border border-amber-500/40 space-y-3 text-center shadow-lg">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <QrCode className="w-4 h-4 animate-pulse" />
                Scan to Authenticate:
              </span>
              <button
                onClick={() => setShowQrModal(true)}
                className="text-[11px] text-amber-300 hover:text-white underline font-semibold"
              >
                Or Use Pairing Code
              </button>
            </div>

            {/* Spacious, Unclipped Pure-White QR Box Container */}
            <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 bg-white rounded-2xl p-4 shadow-[0_0_30px_rgba(245,158,11,0.25)] border border-amber-500/30 flex items-center justify-center overflow-hidden">
              {/* Corner Target Lines */}
              <div className="absolute top-2 left-2 w-5 h-5 border-t-4 border-l-4 border-amber-500 rounded-tl-md pointer-events-none z-10" />
              <div className="absolute top-2 right-2 w-5 h-5 border-t-4 border-r-4 border-amber-500 rounded-tr-md pointer-events-none z-10" />
              <div className="absolute bottom-2 left-2 w-5 h-5 border-b-4 border-l-4 border-amber-500 rounded-bl-md pointer-events-none z-10" />
              <div className="absolute bottom-2 right-2 w-5 h-5 border-b-4 border-r-4 border-amber-500 rounded-br-md pointer-events-none z-10" />

              {inlineQrLoading && !inlineQrCode ? (
                <div className="flex flex-col items-center justify-center space-y-2 text-slate-800">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="text-xs font-mono font-semibold">Loading QR Code...</span>
                </div>
              ) : inlineQrCode ? (
                <img
                  src={inlineQrCode}
                  alt="WhatsApp QR Code"
                  className="w-full h-full object-contain block mx-auto rounded-lg"
                />
              ) : (
                <span className="text-xs text-slate-500">QR Code Generating...</span>
              )}
            </div>

            <p className="text-[11px] text-slate-300">
              Open WhatsApp on phone &gt; Linked Devices &gt; Scan QR code above
            </p>
          </div>
        )}

        {/* Error message callout if present */}
        {session.lastError && (
          <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="break-all">{session.lastError}</span>
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Start Button */}
          {statusLower === 'created' || statusLower === 'disconnected' || !session.engineLoaded ? (
            <button
              onClick={handleStart}
              disabled={loadingAction !== null}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-gradient hover:opacity-90 text-white disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-md"
            >
              {loadingAction === 'start' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white" />
              )}
              <span>Start Engine</span>
            </button>
          ) : null}

          {/* QR Code / Pairing Code Authenticate Button */}
          {statusLower === 'qr_ready' || statusLower === 'initializing' ? (
            <button
              onClick={() => setShowQrModal(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-[#081419] font-bold transition-all flex items-center gap-1.5 shadow-md animate-bounce"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR / Pairing Code</span>
            </button>
          ) : null}

          {/* Disconnect / Stop Action (Visually Distinct Amber Outline Button) */}
          {session.engineLoaded || statusLower === 'ready' || statusLower === 'authenticating' ? (
            <button
              onClick={handleStop}
              disabled={loadingAction !== null}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 disabled:opacity-40 transition-all flex items-center gap-1.5"
              title="Stop engine process (keeps session record)"
            >
              {loadingAction === 'stop' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Disconnect / Stop</span>
            </button>
          ) : null}
        </div>

        {/* Destructive Delete Action (Visually Distinct Red Button with Dialog) */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={loadingAction !== null}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:border-rose-500/60 disabled:opacity-40 transition-all flex items-center gap-1.5"
          title="Delete session permanently"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>

      {/* QR & Pairing Code Modal */}
      {showQrModal && (
        <OpenWaQrPairingModal
          session={session}
          baseUrl={baseUrl}
          apiKey={apiKey}
          onClose={() => setShowQrModal(false)}
          onSessionUpdated={onRefresh}
        />
      )}

      {/* Delete Confirmation Modal Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d2530] border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-white">Delete Session?</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete session{' '}
              <strong className="text-white font-mono">{session.name}</strong> ({session.id})? This will un-register the session from the WhatsApp Gateway and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loadingAction === 'delete'}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {loadingAction === 'delete' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
