'use client';

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Upload,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { OpenWaSessionDto } from '@/types/openwa-session';
import { formatWhatsAppPhone, formatWhatsAppJid } from '@/lib/phone-formatter';
import { parseCsv } from '@/lib/csv-parser';

interface GroupItem {
  id: string;
  name: string;
  memberCount?: number;
}

interface MemberQueueItem {
  phone: string;
  formattedJid: string;
  name?: string;
  status: 'queued' | 'adding' | 'added' | 'already_in_group' | 'privacy_blocked' | 'failed';
  reason?: string;
}

interface BulkMemberAdderProps {
  sessions: OpenWaSessionDto[];
  selectedSessionId: string;
}

export function BulkMemberAdder({ sessions, selectedSessionId }: BulkMemberAdderProps) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);

  const [rawText, setRawText] = useState<string>('');
  const [chunkSize, setChunkSize] = useState<number>(5);
  const [delayBetweenBatchesSec, setDelayBetweenBatchesSec] = useState<number>(15);
  const [defaultCountryCode, setDefaultCountryCode] = useState<string>('20');

  const [queue, setQueue] = useState<MemberQueueItem[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch groups for selected session
  const fetchGroups = async (sessId: string) => {
    if (!sessId) return;
    setLoadingGroups(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'groups', id: sessId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        const mapped: GroupItem[] = data.groups.map((g: any) => ({
          id: g.id,
          name: g.name || g.subject || g.id,
          memberCount: g.participants?.length,
        }));
        setGroups(mapped);
        if (mapped.length > 0 && !targetGroupId) {
          setTargetGroupId(mapped[0].id);
        }
      }
    } catch (e: any) {
      setError('Failed to fetch groups for this session.');
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchGroups(selectedSessionId);
    }
  }, [selectedSessionId]);

  // Handle CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      const parsed = parseCsv(text, file.name);
      if (parsed && parsed.rows.length > 0) {
        const phones = parsed.rows
          .map((r) => r.phone || r.mobile || r.contact || Object.values(r)[0])
          .filter(Boolean);
        setRawText(phones.join('\n'));
      }
    };
    reader.readAsText(file);
  };

  const handleStartAdder = async () => {
    if (!selectedSessionId) {
      setError('Please select an active WhatsApp session first.');
      return;
    }
    if (!targetGroupId) {
      setError('Please select a target WhatsApp group.');
      return;
    }

    const lines = rawText.split(/[\r\n,;]+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError('Please enter or upload at least one phone number.');
      return;
    }

    setError(null);
    const parsedQueue: MemberQueueItem[] = [];

    lines.forEach((line) => {
      const cleanDigits = formatWhatsAppPhone(line, defaultCountryCode);
      if (cleanDigits) {
        const formattedJid = `${cleanDigits}@c.us`;
        if (!parsedQueue.some((p) => p.formattedJid === formattedJid)) {
          parsedQueue.push({
            phone: cleanDigits,
            formattedJid,
            status: 'queued',
          });
        }
      }
    });

    if (parsedQueue.length === 0) {
      setError('No valid phone numbers parsed.');
      return;
    }

    setQueue(parsedQueue);
    setIsRunning(true);

    processBatchLoop(0, parsedQueue);
  };

  const processBatchLoop = async (startIndex: number, currentQueue: MemberQueueItem[]) => {
    if (startIndex >= currentQueue.length) {
      setIsRunning(false);
      setCountdown(0);
      return;
    }

    const batch = currentQueue.slice(startIndex, startIndex + chunkSize);
    const batchJids = batch.map((b) => b.formattedJid);

    // Update queue status to adding for this batch
    setQueue((prev) => {
      const copy = [...prev];
      for (let i = startIndex; i < startIndex + batch.length; i++) {
        copy[i] = { ...copy[i], status: 'adding' };
      }
      return copy;
    });

    try {
      const res = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-participants',
          id: selectedSessionId,
          groupId: targetGroupId,
          participants: batchJids,
        }),
      });

      const data = await res.json().catch(() => ({}));

      setQueue((prev) => {
        const copy = [...prev];
        const resultsMap: Record<string, any> = data.result?.results || {};

        for (let i = startIndex; i < startIndex + batch.length; i++) {
          const item = copy[i];
          const outcome = resultsMap[item.formattedJid] || resultsMap[item.phone];

          if (data.success && (!outcome || outcome.status === 200 || outcome.code === 200 || outcome.status === 'success')) {
            copy[i] = { ...copy[i], status: 'added', reason: 'Added successfully' };
          } else {
            const errStr = outcome?.message || outcome?.error || data.error || 'Failed to add';
            const lower = errStr.toLowerCase();
            let status: MemberQueueItem['status'] = 'failed';
            if (lower.includes('already') || lower.includes('in group')) status = 'already_in_group';
            if (lower.includes('privacy') || lower.includes('invite')) status = 'privacy_blocked';

            copy[i] = { ...copy[i], status, reason: errStr };
          }
        }
        return copy;
      });
    } catch (err: any) {
      setQueue((prev) => {
        const copy = [...prev];
        for (let i = startIndex; i < startIndex + batch.length; i++) {
          copy[i] = { ...copy[i], status: 'failed', reason: err.message || 'Network error' };
        }
        return copy;
      });
    }

    const nextIndex = startIndex + batch.length;
    if (nextIndex < currentQueue.length) {
      let remaining = delayBetweenBatchesSec;
      setCountdown(remaining);
      const interval = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          processBatchLoop(nextIndex, currentQueue);
        }
      }, 1000);
    } else {
      setIsRunning(false);
      setCountdown(0);
    }
  };

  const addedCount = queue.filter((q) => q.status === 'added').length;
  const alreadyCount = queue.filter((q) => q.status === 'already_in_group').length;
  const privacyCount = queue.filter((q) => q.status === 'privacy_blocked').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Column */}
        <div className="space-y-4">
          {/* Target Group Selector */}
          <div className="p-3.5 rounded-xl bg-[#081419] border border-white/10 space-y-1.5">
            <label className="text-xs font-semibold text-white block">Select Target WhatsApp Group:</label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              disabled={isRunning || loadingGroups}
              className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-[#f05a28]"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.id})
                </option>
              ))}
            </select>
          </div>

          {/* Numbers Input & CSV Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#ff8c5a]" />
                <span>Phone Numbers List (One per line):</span>
              </label>

              <label className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] rounded-lg cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3 text-cyan-400" />
                <span>Upload CSV / Excel</span>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="01012345678&#10;01198765432&#10;201234567890"
              rows={6}
              disabled={isRunning}
              className="w-full bg-[#081419] border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[#f05a28]"
            />
          </div>

          {/* Batch Pacing Settings */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#081419] border border-white/10">
            <div>
              <label className="text-[10px] text-white/50 block font-mono mb-1">Batch Size:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value) || 5)}
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-2 text-xs font-mono text-white text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block font-mono mb-1">Batch Delay (s):</label>
              <input
                type="number"
                min={5}
                value={delayBetweenBatchesSec}
                onChange={(e) => setDelayBetweenBatchesSec(parseInt(e.target.value) || 15)}
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-2 text-xs font-mono text-white text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block font-mono mb-1">Country Prefix:</label>
              <input
                type="text"
                value={defaultCountryCode}
                onChange={(e) => setDefaultCountryCode(e.target.value.replace(/[^\d]/g, ''))}
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-2 text-xs font-mono text-white text-center font-bold"
              />
            </div>
          </div>

          <button
            onClick={handleStartAdder}
            disabled={isRunning || !rawText.trim() || !targetGroupId}
            className="w-full py-3 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span>{isRunning ? `Adding Members in Chunks (Waiting ${countdown}s)...` : 'Start Bulk Member Adder'}</span>
          </button>
        </div>

        {/* Execution Summary & Results */}
        <div className="space-y-4 bg-[#081419] p-4 rounded-xl border border-white/10 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Adder Execution Report</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                Added: {addedCount} | Already: {alreadyCount} | Privacy Block: {privacyCount} | Failed: {failedCount}
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40 font-mono">
                No add queue processing. Upload numbers and click Start.
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 text-xs font-mono">
                {queue.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      item.status === 'added'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : item.status === 'already_in_group'
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                        : item.status === 'privacy_blocked'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : item.status === 'adding'
                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 animate-pulse'
                        : item.status === 'failed'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-white/5 border-white/5 text-white/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-bold">{item.formattedJid}</span>
                      <span className="text-[10px] block text-white/40 truncate">{item.reason || item.phone}</span>
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
