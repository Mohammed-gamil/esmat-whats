'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Clock,
  Terminal,
  Download,
  Square,
  Activity,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Server,
  Cloud,
  Check,
} from 'lucide-react';
import {
  AutomationExecutionState,
  DelaySettings,
  ExecutionLog,
  MessageVariation,
  RecipientQueueItem,
  CsvParseResult,
} from '@/types/automation';
import { buildRecipientQueue } from '@/lib/template-engine';
import { addExecutionLog, createInitialExecutionState } from '@/lib/automation-engine';

interface AutomationMonitorSectionProps {
  parseResult: CsvParseResult | null;
  variations: MessageVariation[];
  delaySettings: DelaySettings;
}

type QueueFilter = 'all' | 'sent' | 'failed' | 'queued';

export function AutomationMonitorSection({
  parseResult,
  variations,
  delaySettings,
}: AutomationMonitorSectionProps) {
  const [executionState, setExecutionState] = useState<AutomationExecutionState>({
    status: 'idle',
    currentIndex: 0,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    remainingSecondsForNext: 0,
    queue: [],
    logs: [],
  });

  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');
  const [retryingSingleId, setRetryingSingleId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [serverSynced, setServerSynced] = useState<boolean>(false);

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const recipientColumn = parseResult?.recipientColumn || 'phone';
  const rows = parseResult?.rows || [];

  // Get active delay in seconds
  const getDelaySeconds = (): number => {
    if (delaySettings.delaySeconds && delaySettings.delaySeconds > 0) {
      return delaySettings.delaySeconds;
    }
    if (delaySettings.delayMinutes && delaySettings.delayMinutes > 0) {
      return Math.round(delaySettings.delayMinutes * 60);
    }
    return 30;
  };

  const formatSeconds = (sec: number): string => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  // Sync state from server on mount
  useEffect(() => {
    const fetchServerState = async () => {
      try {
        const res = await fetch('/api/whatsapp/automation-runner');
        const data = await res.json().catch(() => ({}));
        if (data.success && data.state && data.state.queue && data.state.queue.length > 0) {
          setExecutionState(data.state);
          setServerSynced(true);
        } else if (rows.length > 0) {
          const queue = buildRecipientQueue(rows, recipientColumn, variations);
          const initial = createInitialExecutionState(queue);
          setExecutionState(initial);
        }
      } catch (e) {
        if (rows.length > 0) {
          const queue = buildRecipientQueue(rows, recipientColumn, variations);
          setExecutionState(createInitialExecutionState(queue));
        }
      }
    };

    fetchServerState();
  }, [rows.length, recipientColumn]);

  // Polling loop: continuously sync state from server whenever running
  useEffect(() => {
    if (executionState.status === 'running') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/whatsapp/automation-runner');
          const data = await res.json().catch(() => ({}));
          if (data.success && data.state) {
            setExecutionState(data.state);
          }
        } catch (e) {
          console.warn('[AutomationMonitor] polling error:', e);
        }
      }, 1200);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [executionState.status]);

  // Scroll internal log terminal box when new logs arrive while running
  useEffect(() => {
    if (executionState.status === 'running' && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [executionState.logs.length, executionState.status]);

  /**
   * Start bulk automation in server background.
   */
  const handleStartAutomation = async () => {
    if (rows.length === 0) {
      alert('Please upload a CSV file with valid recipient rows first.');
      return;
    }
    if (variations.every((v) => !v.content.trim())) {
      alert('Please compose at least one message variation before starting.');
      return;
    }

    const queue = buildRecipientQueue(rows, recipientColumn, variations);
    const delaySec = getDelaySeconds();
    setIsActionLoading(true);

    try {
      const res = await fetch('/api/whatsapp/automation-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          queue,
          delaySettings: {
            delaySeconds: delaySec,
            delayMinutes: Math.round((delaySec / 60) * 100) / 100,
            customSeconds: delaySec,
          },
          defaultCountryCode: '20',
          simulateTyping: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data.success && data.state) {
        setExecutionState(data.state);
      } else {
        alert(data.error || 'Failed to start background automation');
      }
    } catch (e: any) {
      alert('Network error starting background automation: ' + (e.message || String(e)));
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Pause background automation.
   */
  const handlePauseAutomation = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/automation-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.state) {
        setExecutionState(data.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Resume paused background automation.
   */
  const handleResumeAutomation = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/automation-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.state) {
        setExecutionState(data.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Stop background automation.
   */
  const handleStopAutomation = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/automation-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.state) {
        setExecutionState(data.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Resend / Retry ALL failed recipient numbers on server.
   */
  const handleRetryFailedMessages = async () => {
    const delaySec = getDelaySeconds();
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/automation-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'retry-failed',
          delaySettings: {
            delaySeconds: delaySec,
            delayMinutes: Math.round((delaySec / 60) * 100) / 100,
            customSeconds: delaySec,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.state) {
        setExecutionState(data.state);
      } else {
        alert(data.error || 'Failed to retry messages');
      }
    } catch (e: any) {
      alert('Error retrying failed messages: ' + (e.message || String(e)));
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Retry single failed recipient on server.
   */
  const handleRetrySingle = async (recipientId: string) => {
    setRetryingSingleId(recipientId);
    try {
      const res = await fetch('/api/whatsapp/automation-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry-single', recipientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.state) {
        setExecutionState(data.state);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRetryingSingleId(null);
    }
  };

  /**
   * Export full CSV report.
   */
  const handleExportLog = () => {
    if (executionState.queue.length === 0) return;
    const csvLines = [
      'Recipient ID,Recipient Contact,Variation Assigned,Status,Sent At,Error Reason,Message Content',
    ];

    executionState.queue.forEach((q) => {
      const cleanMsg = `"${q.resolvedMessage.replace(/"/g, '""')}"`;
      const cleanErr = `"${(q.error || '').replace(/"/g, '""')}"`;
      csvLines.push(
        `"${q.recipientId}","${q.recipientContact}","${q.assignedVariation.title}","${q.status}","${q.sentAt || ''}",${cleanErr},${cleanMsg}`
      );
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `automation_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Export only failed numbers CSV.
   */
  const handleExportFailedCsv = () => {
    const failedItems = executionState.queue.filter((q) => q.status === 'failed');
    if (failedItems.length === 0) {
      alert('No failed recipients to export.');
      return;
    }

    const csvLines = ['Recipient Contact,Error Reason,Assigned Variation,Message Content'];
    failedItems.forEach((q) => {
      const cleanMsg = `"${q.resolvedMessage.replace(/"/g, '""')}"`;
      const cleanErr = `"${(q.error || '').replace(/"/g, '""')}"`;
      csvLines.push(`"${q.recipientContact}",${cleanErr},"${q.assignedVariation.title}",${cleanMsg}`);
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `failed_recipients_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered queue items
  const filteredQueue = executionState.queue.filter((item) => {
    if (activeFilter === 'sent') return item.status === 'sent';
    if (activeFilter === 'failed') return item.status === 'failed';
    if (activeFilter === 'queued') return item.status === 'queued' || item.status === 'sending';
    return true;
  });

  const totalCount = executionState.totalRecipients || executionState.queue.length;
  const sentCount = executionState.queue.filter((q) => q.status === 'sent').length;
  const failedCount = executionState.queue.filter((q) => q.status === 'failed').length;
  const queuedCount = executionState.queue.filter((q) => q.status === 'queued' || q.status === 'sending').length;

  const progressPercent =
    totalCount > 0 ? Math.round(((sentCount + failedCount) / totalCount) * 100) : 0;

  const currentDelaySec = getDelaySeconds();

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold shadow-inner">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Step 5: Automation Monitor & Live Queue</span>
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono border font-semibold ${
                  executionState.status === 'running'
                    ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40 animate-pulse'
                    : executionState.status === 'paused'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : executionState.status === 'completed'
                    ? 'bg-[#f05a28]/20 text-[#ff8c5a] border-[#f05a28]/40'
                    : 'bg-[#081419] text-white/50 border-white/10'
                }`}
              >
                Status: {executionState.status.toUpperCase()}
              </span>

              {/* Background Server Execution Badge */}
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono flex items-center gap-1">
                <Server className="w-3 h-3 text-cyan-400" />
                <span>24/7 Server Background Job</span>
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              Runs persistently on the server. You can safely close your browser or navigate away anytime.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Resend to Failed Numbers button (prominent if there are failed items) */}
          {failedCount > 0 && executionState.status !== 'running' && (
            <button
              onClick={handleRetryFailedMessages}
              disabled={isActionLoading}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 transition-all flex items-center gap-2 cursor-pointer animate-pulse disabled:opacity-50"
              title="Resend messages to all failed numbers in background"
            >
              {isActionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>Resend to Failed ({failedCount})</span>
            </button>
          )}

          {executionState.status === 'idle' || executionState.status === 'completed' || executionState.status === 'stopped' ? (
            <button
              onClick={handleStartAutomation}
              disabled={isActionLoading || rows.length === 0}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              {isActionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              <span>Start Background Automation</span>
            </button>
          ) : executionState.status === 'running' ? (
            <button
              onClick={handlePauseAutomation}
              disabled={isActionLoading}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Pause className="w-4 h-4 fill-amber-300" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={handleResumeAutomation}
              disabled={isActionLoading}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 text-[#081419] font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-[#081419]" />
              <span>Resume Execution</span>
            </button>
          )}

          {executionState.status !== 'idle' && (
            <button
              onClick={handleStopAutomation}
              disabled={isActionLoading}
              className="px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-[#081419] hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title="Stop & Reset Queue"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Metrics Banner & Countdown Timer */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progress Bar Metric */}
        <div className="p-4 rounded-xl bg-[#081419] border border-white/10 space-y-2 col-span-1 md:col-span-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-200">Total Batch Progress:</span>
            <span className="font-mono text-[#10b981] font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-[#0d2530] rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#f05a28] via-[#ff8c5a] to-[#10b981] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono pt-1">
            <span className="text-emerald-400 font-semibold">✓ Sent: {sentCount}</span>
            <span className={failedCount > 0 ? 'text-rose-400 font-bold' : 'text-white/50'}>
              ✗ Failed: {failedCount}
            </span>
            <span className="text-white/50">Total: {totalCount}</span>
          </div>
        </div>

        {/* Pacing Delay Countdown Display */}
        <div className="p-4 rounded-xl bg-[#081419] border border-[#f05a28]/30 flex items-center justify-between col-span-1 md:col-span-2">
          <div>
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#ff8c5a]" />
              <span>Inter-Message Countdown Timer:</span>
            </span>
            <p className="text-xs text-white/50 mt-0.5">
              {executionState.status === 'running' && executionState.remainingSecondsForNext > 0
                ? 'Server pacing active between messages...'
                : executionState.status === 'running'
                ? 'Server dispatching message...'
                : executionState.status === 'paused'
                ? 'Server execution paused'
                : 'Waiting for next dispatch step'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-[#ff8c5a]">
              {executionState.remainingSecondsForNext > 0
                ? formatSeconds(executionState.remainingSecondsForNext)
                : `${currentDelaySec}s`}
            </span>
            <span className="block text-[10px] text-[#ff8c5a]/80 font-mono">
              Delay: {formatSeconds(currentDelaySec)}
            </span>
          </div>
        </div>
      </div>

      {/* Recipient Queue Table & Terminal Log 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recipient Queue Table Column */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#081419] border border-white/10 rounded-xl text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-brand-gradient text-white font-bold shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('sent')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFilter === 'sent'
                    ? 'bg-emerald-500 text-white font-bold shadow-sm'
                    : 'text-white/60 hover:text-emerald-400'
                }`}
              >
                Sent ({sentCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('failed')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFilter === 'failed'
                    ? 'bg-rose-500 text-white font-bold shadow-sm'
                    : failedCount > 0
                    ? 'text-rose-400 font-bold hover:text-rose-300'
                    : 'text-white/60 hover:text-rose-400'
                }`}
              >
                Failed ({failedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('queued')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFilter === 'queued'
                    ? 'bg-cyan-500 text-white font-bold shadow-sm'
                    : 'text-white/60 hover:text-cyan-400'
                }`}
              >
                Queued ({queuedCount})
              </button>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              {failedCount > 0 && (
                <button
                  onClick={handleExportFailedCsv}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 cursor-pointer"
                  title="Export only failed recipients as CSV"
                >
                  <Download className="w-3 h-3" />
                  <span>Export Failed</span>
                </button>
              )}

              {executionState.queue.length > 0 && (
                <button
                  onClick={handleExportLog}
                  className="text-xs text-[#ff8c5a] hover:text-white flex items-center gap-1 font-medium bg-white/5 px-2 py-1 rounded-lg border border-white/10 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Queue List Table */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#081419] max-h-[350px] overflow-y-auto scrollbar-thin">
            {filteredQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40 font-mono">
                {activeFilter === 'all'
                  ? 'No items in execution queue. Upload a CSV file above to populate.'
                  : `No ${activeFilter} recipients in current queue.`}
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0d2530] text-white/60 sticky top-0 border-b border-white/10">
                  <tr>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5">Variation</th>
                    <th className="p-2.5 text-right">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filteredQueue.map((item) => {
                    const isCurrent =
                      executionState.queue[executionState.currentIndex]?.id === item.id &&
                      executionState.status === 'running';
                    const isRetrying = retryingSingleId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isCurrent ? 'bg-[#f05a28]/15 font-bold' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="p-2.5">
                          <span className="text-white block font-medium">
                            {item.recipientContact}
                          </span>
                          <span className="text-[10px] text-white/40 block max-w-[140px] truncate">
                            {item.imageUrl ? '📷 ' : ''}
                            {item.resolvedMessage}
                          </span>
                          {item.error && (
                            <span className="text-[10px] text-rose-400 block max-w-[180px] truncate mt-0.5">
                              ⚠️ {item.error}
                            </span>
                          )}
                        </td>

                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-[#0d2530] text-slate-200 text-[10px] border border-white/10">
                            {item.assignedVariation.title}
                          </span>
                        </td>

                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                item.status === 'sent'
                                  ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                                  : item.status === 'sending'
                                  ? 'bg-[#f05a28]/20 text-[#ff8c5a] border-[#f05a28]/40 animate-pulse'
                                  : item.status === 'failed'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                  : 'bg-[#0d2530] text-white/50 border-white/10'
                              }`}
                            >
                              {item.status}
                            </span>

                            {/* Individual Retry button on failed rows */}
                            {item.status === 'failed' && executionState.status !== 'running' && (
                              <button
                                onClick={() => handleRetrySingle(item.id)}
                                disabled={isRetrying}
                                className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-[10px] transition-all cursor-pointer flex items-center gap-0.5"
                                title="Resend message to this number now"
                              >
                                {isRetrying ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Real-time Execution Terminal Logs Column */}
        <div className="space-y-3 bg-[#081419] p-4 rounded-xl border border-white/10 font-mono flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-[#06b6d4]" />
              <span>Server-Side Execution Log Terminal</span>
            </span>
            <span className="text-[10px] text-white/40">
              {executionState.logs.length} Event(s) Recorded
            </span>
          </div>

          <div
            ref={terminalContainerRef}
            className="bg-[#060f13] p-3 rounded-lg border border-white/5 h-[300px] overflow-y-auto space-y-1.5 text-[11px] leading-relaxed scrollbar-thin"
          >
            {executionState.logs.length === 0 ? (
              <div className="text-white/40 italic">Waiting for automation execution events...</div>
            ) : (
              executionState.logs.map((log) => {
                const timeStr = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-white/40 text-[10px] shrink-0 font-mono">
                      [{timeStr}]
                    </span>
                    <span
                      className={`break-all ${
                        log.type === 'success'
                          ? 'text-[#10b981]'
                          : log.type === 'error'
                          ? 'text-rose-400 font-bold'
                          : log.type === 'warning'
                          ? 'text-amber-300'
                          : log.type === 'step'
                          ? 'text-[#06b6d4]'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
