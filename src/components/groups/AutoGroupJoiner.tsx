'use client';

import React, { useState } from 'react';
import {
  UserPlus,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Link,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { OpenWaSessionDto } from '@/types/openwa-session';

interface JoinResultItem {
  inviteCode: string;
  originalLink: string;
  status: 'queued' | 'joining' | 'joined' | 'already_member' | 'invalid' | 'rate_limited' | 'failed';
  message?: string;
  joinedAt?: string;
}

interface AutoGroupJoinerProps {
  sessions: OpenWaSessionDto[];
  selectedSessionId: string;
}

export function AutoGroupJoiner({ sessions, selectedSessionId }: AutoGroupJoinerProps) {
  const [linksInput, setLinksInput] = useState<string>('');
  const [minDelaySec, setMinDelaySec] = useState<number>(30);
  const [maxDelaySec, setMaxDelaySec] = useState<number>(60);

  const [queue, setQueue] = useState<JoinResultItem[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Parse invite links or codes
  const parseInviteCodes = (text: string): { code: string; original: string }[] => {
    const lines = text.split(/[\r\n,;]+/).map((l) => l.trim()).filter(Boolean);
    const parsed: { code: string; original: string }[] = [];

    lines.forEach((line) => {
      let code = line;
      if (line.includes('chat.whatsapp.com/')) {
        code = line.split('chat.whatsapp.com/')[1].split(/[\s?#/]/)[0];
      }
      code = code.replace(/[^a-zA-Z0-9_\-]/g, '').trim();
      if (code && !parsed.some((p) => p.code === code)) {
        parsed.push({ code, original: line });
      }
    });

    return parsed;
  };

  const handleStartJoiner = async () => {
    if (!selectedSessionId) {
      setError('Please select a connected WhatsApp session first.');
      return;
    }
    const parsedCodes = parseInviteCodes(linksInput);
    if (parsedCodes.length === 0) {
      setError('Please enter at least one valid WhatsApp group invite link or code.');
      return;
    }

    setError(null);
    const initialQueue: JoinResultItem[] = parsedCodes.map((item) => ({
      inviteCode: item.code,
      originalLink: item.original,
      status: 'queued',
    }));

    setQueue(initialQueue);
    setIsRunning(true);
    setCurrentIndex(0);

    runJoinerLoop(0, initialQueue);
  };

  const runJoinerLoop = async (index: number, currentQueue: JoinResultItem[]) => {
    if (index >= currentQueue.length) {
      setIsRunning(false);
      setCountdown(0);
      return;
    }

    setCurrentIndex(index);
    const currentItem = currentQueue[index];

    // Update status to joining
    setQueue((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: 'joining' };
      return copy;
    });

    try {
      const res = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join-group',
          id: selectedSessionId,
          inviteCode: currentItem.inviteCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      setQueue((prev) => {
        const copy = [...prev];
        if (data.success) {
          copy[index] = {
            ...copy[index],
            status: 'joined',
            message: 'Joined group successfully',
            joinedAt: new Date().toLocaleTimeString(),
          };
        } else {
          const errMsg = data.error || 'Failed to join group';
          const lower = errMsg.toLowerCase();
          let itemStatus: JoinResultItem['status'] = 'failed';
          if (lower.includes('already') || lower.includes('participant')) itemStatus = 'already_member';
          if (lower.includes('invalid') || lower.includes('expired')) itemStatus = 'invalid';
          if (lower.includes('rate') || lower.includes('limit')) itemStatus = 'rate_limited';

          copy[index] = {
            ...copy[index],
            status: itemStatus,
            message: errMsg,
          };
        }
        return copy;
      });
    } catch (err: any) {
      setQueue((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          status: 'failed',
          message: err.message || 'Network error',
        };
        return copy;
      });
    }

    // Schedule next with randomized safety delay
    if (index + 1 < currentQueue.length) {
      const randomDelay = Math.floor(Math.random() * (maxDelaySec - minDelaySec + 1)) + minDelaySec;
      let remaining = randomDelay;
      setCountdown(remaining);

      const interval = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          runJoinerLoop(index + 1, currentQueue);
        }
      }, 1000);
    } else {
      setIsRunning(false);
      setCountdown(0);
    }
  };

  const joinedCount = queue.filter((q) => q.status === 'joined').length;
  const alreadyCount = queue.filter((q) => q.status === 'already_member').length;
  const failedCount = queue.filter((q) => q.status === 'failed' || q.status === 'invalid' || q.status === 'rate_limited').length;

  return (
    <div className="space-y-6">
      {/* Risk Warning Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1 shadow-md">
        <div className="flex items-center gap-2 font-bold text-amber-100">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Anti-Ban Safety Warning:</span>
        </div>
        <p className="text-xs text-amber-200/90 leading-relaxed pl-6">
          Joining multiple groups back-to-back is a high-risk activity. Enforce a randomized delay of at least 30–60 seconds between joins to keep your session safe.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Column */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-200 block mb-1.5 flex items-center gap-1.5">
              <Link className="w-4 h-4 text-[#ff8c5a]" />
              <span>Paste Group Invite Links / Codes (One per line or comma-separated):</span>
            </label>
            <textarea
              value={linksInput}
              onChange={(e) => setLinksInput(e.target.value)}
              placeholder="https://chat.whatsapp.com/AbCdEfGhIjKlMnOp&#10;https://chat.whatsapp.com/XyZ123456789&#10;AbCdEfGhIjKlMnOp"
              rows={8}
              disabled={isRunning}
              className="w-full bg-[#081419] border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[#f05a28]"
            />
          </div>

          {/* Delay Pacing Controls */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#081419] border border-white/10">
            <div>
              <label className="text-[11px] text-white/50 block font-mono mb-1">Min Delay (Sec):</label>
              <input
                type="number"
                min={15}
                value={minDelaySec}
                onChange={(e) => setMinDelaySec(Math.max(15, parseInt(e.target.value) || 15))}
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-2 text-xs font-mono text-white text-center"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/50 block font-mono mb-1">Max Delay (Sec):</label>
              <input
                type="number"
                min={minDelaySec}
                value={maxDelaySec}
                onChange={(e) => setMaxDelaySec(Math.max(minDelaySec, parseInt(e.target.value) || 60))}
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-2 text-xs font-mono text-white text-center"
              />
            </div>
          </div>

          <button
            onClick={handleStartJoiner}
            disabled={isRunning || !linksInput.trim()}
            className="w-full py-3 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isRunning ? `Joining Groups (Waiting ${countdown}s)...` : 'Start Auto Group Joiner'}</span>
          </button>
        </div>

        {/* Execution Log & Results */}
        <div className="space-y-4 bg-[#081419] p-4 rounded-xl border border-white/10 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                <FileText className="w-4 h-4 text-[#06b6d4]" />
                <span>Joiner Execution Log</span>
              </h3>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Joined: {joinedCount} | Already: {alreadyCount} | Failed: {failedCount}
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40 font-mono">
                No join queue running. Paste group links and click Start.
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 text-xs font-mono">
                {queue.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      item.status === 'joined'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : item.status === 'already_member'
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                        : item.status === 'joining'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                        : item.status === 'failed' || item.status === 'invalid'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-white/5 border-white/5 text-white/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-bold">{item.inviteCode}</span>
                      <span className="text-[10px] block text-white/40 truncate">{item.message || item.originalLink}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-current">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
