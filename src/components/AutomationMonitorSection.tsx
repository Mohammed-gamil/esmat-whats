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
} from 'lucide-react';
import {
  AutomationExecutionState,
  DelaySettings,
  ExecutionLog,
  MessageVariation,
  RecipientQueueItem,
  CsvParseResult,
} from '@/types/automation';
import {
  buildRecipientQueue,
} from '@/lib/template-engine';
import {
  addExecutionLog,
  createInitialExecutionState,
  sendRecipientMessage,
} from '@/lib/automation-engine';

interface AutomationMonitorSectionProps {
  parseResult: CsvParseResult | null;
  variations: MessageVariation[];
  delaySettings: DelaySettings;
}

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logTerminalEndRef = useRef<HTMLDivElement>(null);

  const recipientColumn = parseResult?.recipientColumn || 'phone';
  const rows = parseResult?.rows || [];

  useEffect(() => {
    if (executionState.status === 'idle' && rows.length > 0 && variations.length > 0) {
      const queue = buildRecipientQueue(rows, recipientColumn, variations);
      const initialState = createInitialExecutionState(queue);
      setExecutionState(initialState);
    }
  }, [rows, recipientColumn, variations, executionState.status]);

  useEffect(() => {
    logTerminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionState.logs]);

  const handleStartAutomation = () => {
    if (rows.length === 0) {
      alert('Please upload a CSV file with valid recipient rows first.');
      return;
    }
    if (variations.every((v) => !v.content.trim())) {
      alert('Please compose at least one message variation before starting.');
      return;
    }

    const queue = buildRecipientQueue(rows, recipientColumn, variations);
    const totalSec = delaySettings.delayMinutes * 60;

    let initialLogs: ExecutionLog[] = [
      {
        id: `log_start_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `🚀 Automation session started for ${queue.length} recipient(s). Inter-message delay set to ${delaySettings.delayMinutes} minute(s) (${totalSec}s).`,
      },
    ];

    setExecutionState({
      status: 'running',
      currentIndex: 0,
      totalRecipients: queue.length,
      sentCount: 0,
      failedCount: 0,
      remainingSecondsForNext: 0,
      queue,
      logs: initialLogs,
      startedAt: new Date().toISOString(),
    });

    executeStep(0, queue, initialLogs, delaySettings.delayMinutes * 60);
  };

  const handlePauseAutomation = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setExecutionState((prev) => ({
      ...prev,
      status: 'paused',
      logs: addExecutionLog(
        prev.logs,
        'warning',
        '⏸️ Automation paused by user. Timer halted.'
      ),
    }));
  };

  const handleResumeAutomation = () => {
    setExecutionState((prev) => {
      const nextLogs = addExecutionLog(
        prev.logs,
        'info',
        '▶️ Automation resumed. Continuing batch queue execution...'
      );
      setTimeout(() => {
        executeStep(
          prev.currentIndex,
          prev.queue,
          nextLogs,
          prev.remainingSecondsForNext > 0
            ? prev.remainingSecondsForNext
            : delaySettings.delayMinutes * 60
        );
      }, 100);

      return {
        ...prev,
        status: 'running',
        logs: nextLogs,
      };
    });
  };

  const handleStopAutomation = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const queue = buildRecipientQueue(rows, recipientColumn, variations);
    const resetState = createInitialExecutionState(queue);

    setExecutionState({
      ...resetState,
      logs: addExecutionLog(
        resetState.logs,
        'warning',
        '⏹️ Automation stopped and queue reset to idle.'
      ),
    });
  };

  const executeStep = async (
    index: number,
    currentQueue: RecipientQueueItem[],
    currentLogs: ExecutionLog[],
    delaySeconds: number
  ) => {
    if (index >= currentQueue.length) {
      setExecutionState((prev) => ({
        ...prev,
        status: 'completed',
        remainingSecondsForNext: 0,
        completedAt: new Date().toISOString(),
        logs: addExecutionLog(
          prev.logs,
          'success',
          `🎉 Bulk message automation completed! Sent: ${prev.sentCount}, Failed: ${prev.failedCount}.`
        ),
      }));
      return;
    }

    const currentItem = currentQueue[index];

    setExecutionState((prev) => {
      const updatedQueue = [...prev.queue];
      updatedQueue[index] = { ...updatedQueue[index], status: 'sending' };
      return {
        ...prev,
        currentIndex: index,
        queue: updatedQueue,
        logs: addExecutionLog(
          prev.logs,
          'step',
          `[DISPATCH] Processing Recipient #${index + 1}/${currentQueue.length} (${currentItem.recipientContact}) with "${currentItem.assignedVariation.title}"`,
          currentItem.recipientContact,
          currentItem.assignedVariation.title
        ),
      };
    });

    const res = await sendRecipientMessage(currentItem);

    setExecutionState((prev) => {
      const updatedQueue = [...prev.queue];
      const nowIso = new Date().toISOString();

      if (res.success) {
        updatedQueue[index] = {
          ...updatedQueue[index],
          status: 'sent',
          sentAt: nowIso,
        };
        const newSentCount = prev.sentCount + 1;
        const newLogs = addExecutionLog(
          prev.logs,
          'success',
          `[SENT] Delivered to ${currentItem.recipientContact} successfully!`,
          currentItem.recipientContact
        );

        if (index + 1 >= currentQueue.length) {
          return {
            ...prev,
            status: 'completed',
            sentCount: newSentCount,
            queue: updatedQueue,
            logs: addExecutionLog(
              newLogs,
              'success',
              `🎉 All ${currentQueue.length} recipient messages dispatched successfully!`
            ),
          };
        }

        startCountdownAndScheduleNext(index + 1, updatedQueue, newLogs, delaySeconds);

        return {
          ...prev,
          sentCount: newSentCount,
          queue: updatedQueue,
          logs: newLogs,
        };
      } else {
        updatedQueue[index] = {
          ...updatedQueue[index],
          status: 'failed',
          error: res.error || 'Send failed',
        };
        const newFailedCount = prev.failedCount + 1;
        const newLogs = addExecutionLog(
          prev.logs,
          'error',
          `[FAILED] Delivery to ${currentItem.recipientContact} failed: ${res.error}`,
          currentItem.recipientContact
        );

        if (index + 1 >= currentQueue.length) {
          return {
            ...prev,
            status: 'completed',
            failedCount: newFailedCount,
            queue: updatedQueue,
            logs: newLogs,
          };
        }

        startCountdownAndScheduleNext(index + 1, updatedQueue, newLogs, delaySeconds);

        return {
          ...prev,
          failedCount: newFailedCount,
          queue: updatedQueue,
          logs: newLogs,
        };
      }
    });
  };

  const startCountdownAndScheduleNext = (
    nextIndex: number,
    queue: RecipientQueueItem[],
    logs: ExecutionLog[],
    totalDelaySeconds: number
  ) => {
    let remaining = totalDelaySeconds;

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setExecutionState((prev) => ({
      ...prev,
      remainingSecondsForNext: remaining,
      logs: addExecutionLog(
        prev.logs,
        'info',
        `⏳ Pacing Delay Active: Waiting ${Math.floor(remaining / 60)}m ${remaining % 60}s before sending next message...`
      ),
    }));

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setExecutionState((prev) => ({
        ...prev,
        remainingSecondsForNext: Math.max(0, remaining),
      }));

      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        executeStep(nextIndex, queue, logs, totalDelaySeconds);
      }
    }, 1000);
  };

  const handleExportLog = () => {
    if (executionState.queue.length === 0) return;
    const csvLines = [
      'Recipient ID,Recipient Contact,Variation Assigned,Status,Sent At,Message Content',
    ];

    executionState.queue.forEach((q) => {
      const cleanMsg = `"${q.resolvedMessage.replace(/"/g, '""')}"`;
      csvLines.push(
        `"${q.recipientId}","${q.recipientContact}","${q.assignedVariation.title}","${q.status}","${q.sentAt || ''}",${cleanMsg}`
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

  const progressPercent =
    executionState.totalRecipients > 0
      ? Math.round(
          ((executionState.sentCount + executionState.failedCount) /
            executionState.totalRecipients) *
            100
        )
      : 0;

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold shadow-inner">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Step 5: Automation Monitor & Live Queue</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono border ${
                  executionState.status === 'running'
                    ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40 animate-pulse font-semibold'
                    : executionState.status === 'paused'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : executionState.status === 'completed'
                    ? 'bg-[#f05a28]/20 text-[#ff8c5a] border-[#f05a28]/40'
                    : 'bg-[#081419] text-white/50 border-white/10'
                }`}
              >
                Status: {executionState.status.toUpperCase()}
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Run deterministic rule-based automation with live status monitoring, pacing countdown, and execution terminal logs.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {executionState.status === 'idle' || executionState.status === 'completed' ? (
            <button
              onClick={handleStartAutomation}
              disabled={rows.length === 0}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Bulk Automation</span>
            </button>
          ) : executionState.status === 'running' ? (
            <button
              onClick={handlePauseAutomation}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 transition-all flex items-center gap-2"
            >
              <Pause className="w-4 h-4 fill-amber-300" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={handleResumeAutomation}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 text-[#081419] font-bold transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-[#081419]" />
              <span>Resume Execution</span>
            </button>
          )}

          {executionState.status !== 'idle' && (
            <button
              onClick={handleStopAutomation}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#081419] hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 text-slate-200 transition-colors"
              title="Stop & Reset Queue"
            >
              <Square className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 pt-1">
            <span>Sent: {executionState.sentCount}</span>
            <span>Failed: {executionState.failedCount}</span>
            <span>Total: {executionState.totalRecipients}</span>
          </div>
        </div>

        {/* Pacing Delay Countdown Display */}
        <div className="p-4 rounded-xl bg-[#081419] border border-[#f05a28]/30 flex items-center justify-between col-span-1 md:col-span-2">
          <div>
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#ff8c5a]" />
              Inter-Message Countdown Timer:
            </span>
            <p className="text-xs text-white/50 mt-0.5">
              {executionState.status === 'running' && executionState.remainingSecondsForNext > 0
                ? 'Pacing active between messages...'
                : 'Waiting for next dispatch step'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xl font-bold font-mono text-[#ff8c5a]">
              {Math.floor(executionState.remainingSecondsForNext / 60)}m{' '}
              {String(executionState.remainingSecondsForNext % 60).padStart(2, '0')}s
            </span>
            <span className="block text-[10px] text-[#ff8c5a]/80 font-mono">
              Min 1m delay rule
            </span>
          </div>
        </div>
      </div>

      {/* Recipient Queue Table & Terminal Log 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recipient Queue Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <span>Recipient Dispatch Queue</span>
              <span className="px-2 py-0.5 rounded bg-[#0d2530] text-slate-200 text-[10px] font-mono border border-white/10">
                {executionState.queue.length} Total Items
              </span>
            </span>

            {executionState.queue.length > 0 && (
              <button
                onClick={handleExportLog}
                className="text-xs text-[#ff8c5a] hover:text-white flex items-center gap-1 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report CSV</span>
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#081419] max-h-[350px] overflow-y-auto scrollbar-thin">
            {executionState.queue.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40">
                No items in execution queue. Upload a CSV file above to populate.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0d2530] text-white/60 sticky top-0 border-b border-white/10">
                  <tr>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5">Variation</th>
                    <th className="p-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {executionState.queue.map((item, idx) => {
                    const isCurrent = executionState.currentIndex === idx && executionState.status === 'running';
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
                            {item.resolvedMessage}
                          </span>
                        </td>

                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-[#0d2530] text-slate-200 text-[10px] border border-white/10">
                            {item.assignedVariation.title}
                          </span>
                        </td>

                        <td className="p-2.5 text-right">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Real-time Execution Terminal Logs */}
        <div className="space-y-3 bg-[#081419] p-4 rounded-xl border border-white/10 font-mono flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-[#06b6d4]" />
              <span>Deterministic Execution Log Terminal</span>
            </span>
            <span className="text-[10px] text-white/40">
              {executionState.logs.length} Event(s) Recorded
            </span>
          </div>

          <div className="bg-[#060f13] p-3 rounded-lg border border-white/5 h-[300px] overflow-y-auto space-y-1.5 text-[11px] leading-relaxed scrollbar-thin">
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
            <div ref={logTerminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
