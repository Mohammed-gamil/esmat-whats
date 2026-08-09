'use client';

import React, { useState } from 'react';
import {
  FolderPlus,
  Upload,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Link,
  Users,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { OpenWaSessionDto } from '@/types/openwa-session';
import { formatWhatsAppPhone } from '@/lib/phone-formatter';
import { parseCsv } from '@/lib/csv-parser';

interface QueueItem {
  phone: string;
  formattedJid: string;
  status: 'queued' | 'adding' | 'added' | 'already_in_group' | 'privacy_blocked' | 'failed';
  reason?: string;
}

interface BulkGroupGeneratorProps {
  sessions: OpenWaSessionDto[];
  selectedSessionId: string;
}

export function BulkGroupGenerator({ sessions, selectedSessionId }: BulkGroupGeneratorProps) {
  const [groupName, setGroupName] = useState<string>('');
  const [groupDescription, setGroupDescription] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');

  const [initialBatchSize, setInitialBatchSize] = useState<number>(5);
  const [chunkSize, setChunkSize] = useState<number>(5);
  const [delayBetweenBatchesSec, setDelayBetweenBatchesSec] = useState<number>(15);
  const [defaultCountryCode, setDefaultCountryCode] = useState<string>('20');

  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // File Upload Handler
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

  const handleStartGenerator = async () => {
    if (!selectedSessionId) {
      setError('Please select an active WhatsApp session first.');
      return;
    }
    if (!groupName.trim()) {
      setError('Please enter a group name.');
      return;
    }

    const lines = rawText.split(/[\r\n,;]+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError('Please enter or upload at least one phone number.');
      return;
    }

    setError(null);
    setCreatedGroupId(null);
    setInviteLink(null);

    const parsedQueue: QueueItem[] = [];
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
    setStatusMessage('Creating WhatsApp group with initial participants...');

    // 1. Initial Create Group with first initialBatchSize participants
    const initialParticipants = parsedQueue.slice(0, initialBatchSize).map((q) => q.formattedJid);

    try {
      const createRes = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-group',
          id: selectedSessionId,
          name: groupName.trim(),
          participants: initialParticipants,
        }),
      });

      const createData = await createRes.json().catch(() => ({}));

      if (!createRes.ok || !createData.success || !createData.group?.id) {
        throw new Error(createData.error || 'Failed to create WhatsApp group');
      }

      const newGrpId = createData.group.id;
      setCreatedGroupId(newGrpId);

      // Update initial batch status to added
      setQueue((prev) => {
        const copy = [...prev];
        for (let i = 0; i < Math.min(initialBatchSize, copy.length); i++) {
          copy[i] = { ...copy[i], status: 'added', reason: 'Added on group creation' };
        }
        return copy;
      });

      // 2. Set Group Description if provided
      if (groupDescription.trim()) {
        fetch('/api/whatsapp/sessions-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set-group-description',
            id: selectedSessionId,
            groupId: newGrpId,
            description: groupDescription.trim(),
          }),
        }).catch(() => {});
      }

      // 3. Fetch Group Invite Link
      fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-invite-code',
          id: selectedSessionId,
          groupId: newGrpId,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.invite?.inviteLink) {
            setInviteLink(d.invite.inviteLink);
          }
        })
        .catch(() => {});

      // 4. Fall through to Bulk Member Adder flow for the remaining participants
      if (parsedQueue.length > initialBatchSize) {
        setStatusMessage('Group created! Continuing chunked participant additions...');
        await processRemainderLoop(newGrpId, initialBatchSize, parsedQueue);
      } else {
        setStatusMessage('Group created successfully with all members!');
        setIsRunning(false);
      }
    } catch (err: any) {
      setError(err.message || 'Group creation failed');
      setIsRunning(false);
    }
  };

  const processRemainderLoop = async (grpId: string, startIndex: number, currentQueue: QueueItem[]) => {
    if (startIndex >= currentQueue.length) {
      setIsRunning(false);
      setCountdown(0);
      setStatusMessage('Group created and all participants processed!');
      return;
    }

    const batch = currentQueue.slice(startIndex, startIndex + chunkSize);
    const batchJids = batch.map((b) => b.formattedJid);

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
          groupId: grpId,
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
            copy[i] = { ...copy[i], status: 'added', reason: 'Added in batch' };
          } else {
            const errStr = outcome?.message || outcome?.error || data.error || 'Failed to add';
            const lower = errStr.toLowerCase();
            let status: QueueItem['status'] = 'failed';
            if (lower.includes('already')) status = 'already_in_group';
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
          processRemainderLoop(grpId, nextIndex, currentQueue);
        }
      }, 1000);
    } else {
      setIsRunning(false);
      setCountdown(0);
      setStatusMessage('Group creation & participant additions completed!');
    }
  };

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const addedCount = queue.filter((q) => q.status === 'added').length;
  const failedCount = queue.filter((q) => q.status === 'failed' || q.status === 'privacy_blocked').length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Created Group Banner & Invite Link */}
      {createdGroupId && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 font-bold text-sm text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Group Created: "{groupName}"</span>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">{createdGroupId}</span>
          </div>

          {inviteLink && (
            <div className="p-3 rounded-xl bg-[#081419] border border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <Link className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-mono text-cyan-300 truncate">{inviteLink}</span>
              </div>
              <button
                onClick={handleCopyInviteLink}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Column */}
        <div className="space-y-4">
          {/* Group Details Input */}
          <div className="space-y-3 p-4 rounded-xl bg-[#081419] border border-white/10">
            <div>
              <label className="text-xs font-semibold text-white block mb-1">Group Name *:</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., VIP Sales Leads 2026"
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#f05a28]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Optional Group Description:</label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Welcome to our official WhatsApp sales group!"
                rows={2}
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-[#f05a28]"
              />
            </div>
          </div>

          {/* Members List Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#ff8c5a]" />
                <span>Initial & Batch Participant Numbers:</span>
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
              rows={5}
              disabled={isRunning}
              className="w-full bg-[#081419] border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[#f05a28]"
            />
          </div>

          {/* Pacing Settings */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#081419] border border-white/10">
            <div>
              <label className="text-[10px] text-white/50 block font-mono mb-1">Initial Cap:</label>
              <input
                type="number"
                min={1}
                max={10}
                value={initialBatchSize}
                onChange={(e) => setInitialBatchSize(parseInt(e.target.value) || 5)}
                disabled={isRunning}
                className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-2 text-xs font-mono text-white text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block font-mono mb-1">Batch Size:</label>
              <input
                type="number"
                min={1}
                max={15}
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
          </div>

          <button
            onClick={handleStartGenerator}
            disabled={isRunning || !groupName.trim() || !rawText.trim()}
            className="w-full py-3 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
            <span>{isRunning ? `Generating Group (Waiting ${countdown}s)...` : 'Create Group & Populate Members'}</span>
          </button>
        </div>

        {/* Status Log Column */}
        <div className="space-y-4 bg-[#081419] p-4 rounded-xl border border-white/10 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Generator Execution Report</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                Added: {addedCount} | Failed: {failedCount}
              </span>
            </div>

            {statusMessage && (
              <div className="p-2.5 rounded-lg bg-brand-gradient/20 border border-[#f05a28]/40 text-white text-xs font-mono flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin text-[#ff8c5a]' : ''}`} />
                <span>{statusMessage}</span>
              </div>
            )}

            {queue.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40 font-mono">
                No group generation queue running. Fill group details and click Start.
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 text-xs font-mono">
                {queue.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      item.status === 'added'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
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
