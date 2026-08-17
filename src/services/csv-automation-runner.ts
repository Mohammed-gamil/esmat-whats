import axios from 'axios';
import {
  AutomationExecutionState,
  DelaySettings,
  ExecutionLog,
  RecipientQueueItem,
} from '@/types/automation';
import { formatWhatsAppPhone } from '@/lib/phone-formatter';
import { WhatsAppService } from './whatsapp-service';
import { getKv } from '@/lib/redis';

const KV_STATE_KEY = 'wa:csv_automation:state';

export class CsvAutomationRunner {
  private static instance: CsvAutomationRunner | null = null;

  private state: AutomationExecutionState = {
    status: 'idle',
    currentIndex: 0,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    remainingSecondsForNext: 0,
    queue: [],
    logs: [],
  };

  private delaySettings: DelaySettings = {
    delaySeconds: 30,
    delayMinutes: 0.5,
    customSeconds: 30,
  };

  private defaultCountryCode: string = '20';
  private simulateTyping: boolean = true;

  private runId: number = 0;
  private isPaused: boolean = false;
  private isStopped: boolean = false;
  private initialized: boolean = false;

  private constructor() {
    this.loadStateFromKv().catch(() => {});
  }

  public static getInstance(): CsvAutomationRunner {
    if (!CsvAutomationRunner.instance) {
      CsvAutomationRunner.instance = new CsvAutomationRunner();
    }
    return CsvAutomationRunner.instance;
  }

  private async loadStateFromKv(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const kv = await getKv();
      const raw = await kv.get(KV_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.queue && Array.isArray(saved.queue)) {
          // If server was restarted while running, mark as paused so user can resume
          if (saved.status === 'running') {
            saved.status = 'paused';
            saved.remainingSecondsForNext = 0;
          }
          this.state = saved;
          if (saved.delaySettings) {
            this.delaySettings = saved.delaySettings;
          }
        }
      }
    } catch (e) {
      console.warn('[CsvAutomationRunner] failed to load state from KV:', e);
    }
  }

  private async persistState(): Promise<void> {
    try {
      const kv = await getKv();
      const toSave = {
        ...this.state,
        delaySettings: this.delaySettings,
      };
      await kv.set(KV_STATE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[CsvAutomationRunner] failed to persist state:', e);
    }
  }

  private addLog(
    type: ExecutionLog['type'],
    message: string,
    recipientContact?: string,
    variationTitle?: string
  ): void {
    const newLog: ExecutionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      recipientContact,
      variationTitle,
    };
    this.state.logs = [newLog, ...this.state.logs.slice(0, 99)];
  }

  public async getState(): Promise<{
    state: AutomationExecutionState;
    delaySettings: DelaySettings;
  }> {
    await this.loadStateFromKv();
    return {
      state: this.state,
      delaySettings: this.delaySettings,
    };
  }

  private getEffectiveDelaySeconds(): number {
    if (this.delaySettings.delaySeconds && this.delaySettings.delaySeconds > 0) {
      return this.delaySettings.delaySeconds;
    }
    if (this.delaySettings.delayMinutes && this.delaySettings.delayMinutes > 0) {
      return Math.round(this.delaySettings.delayMinutes * 60);
    }
    return 30;
  }

  /**
   * Dispatches a single recipient message via OpenWA Gateway
   */
  public async dispatchSingleRecipient(
    item: RecipientQueueItem
  ): Promise<{ success: boolean; error?: string }> {
    if (!item.recipientContact || item.recipientContact.trim() === '') {
      return { success: false, error: 'Recipient phone number is empty.' };
    }

    const cleanPhone = formatWhatsAppPhone(item.recipientContact, this.defaultCountryCode);
    if (!cleanPhone || cleanPhone.length < 6) {
      return {
        success: false,
        error: `Invalid phone format: "${item.recipientContact}". Minimum 6 digits required.`,
      };
    }

    const rawUrl =
      process.env.OPENWA_GATEWAY_URL || process.env.OPENWA_URL || 'http://localhost:2785';
    let targetUrl = rawUrl.trim().replace(/\/+$/, '');
    if (!targetUrl.endsWith('/api')) {
      targetUrl = `${targetUrl}/api`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const key = WhatsAppService.getOpenWaApiKey();
    if (key) {
      headers['X-API-Key'] = key;
      headers['Authorization'] = `Bearer ${key}`;
    }

    try {
      // 1. Resolve active session from OpenWA Gateway
      const listRes = await axios
        .get(`${targetUrl}/sessions`, { headers, timeout: 10000 })
        .catch(() => null);

      let activeSessionId: string | null = null;
      if (Array.isArray(listRes?.data) && listRes.data.length > 0) {
        const readySess = listRes.data.find((s: any) => {
          const st = (s.status || '').toLowerCase();
          return (
            st === 'ready' || st === 'working' || st === 'connected' || st === 'authenticated'
          );
        });
        activeSessionId = readySess?.id || listRes.data[0]?.id;
      }

      if (!activeSessionId) {
        return {
          success: false,
          error:
            'No active WhatsApp session connected on Gateway. Please connect a session in Step 1.',
        };
      }

      const formattedChatId = `${cleanPhone}@c.us`;
      const hasImage = !!(item.imageUrl && item.imageUrl.trim());

      if (hasImage) {
        if (this.simulateTyping) {
          const typingMs = Math.min(
            Math.max((item.resolvedMessage.length || 10) * 35, 1200),
            4000
          );
          await new Promise((resolve) => setTimeout(resolve, typingMs));
        }

        const sendPayload = {
          chatId: formattedChatId,
          image: { url: item.imageUrl!.trim() },
          caption: item.resolvedMessage || '',
        };

        const imgRes = await axios
          .post(
            `${targetUrl}/sessions/${encodeURIComponent(activeSessionId)}/messages/send-image`,
            sendPayload,
            { headers, timeout: 60000 }
          )
          .catch((err) => ({ data: { success: false, error: err.message } }));

        if (imgRes.data?.success) {
          return { success: true };
        }

        // Image fallback: send as plain text
        console.warn(
          '[CsvAutomationRunner] Image send failed, falling back to text:',
          imgRes.data?.error
        );
      }

      // Plain text send
      if (this.simulateTyping) {
        const typingMs = Math.min(Math.max(item.resolvedMessage.length * 35, 1000), 3500);
        await new Promise((resolve) => setTimeout(resolve, typingMs));
      }

      const textRes = await axios.post(
        `${targetUrl}/sessions/${encodeURIComponent(activeSessionId)}/messages/send-text`,
        { chatId: formattedChatId, text: item.resolvedMessage },
        { headers, timeout: 60000 }
      );

      if (textRes.data?.success) {
        return { success: true };
      }

      return {
        success: false,
        error: textRes.data?.error || `Gateway returned status ${textRes.status}`,
      };
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Gateway dispatch failed';
      return { success: false, error: String(errMsg) };
    }
  }

  /**
   * Starts background automation job on the server.
   */
  public async start(
    queue: RecipientQueueItem[],
    delaySettings?: DelaySettings,
    defaultCountryCode: string = '20',
    simulateTyping: boolean = true
  ): Promise<AutomationExecutionState> {
    this.runId += 1;
    const currentRunId = this.runId;
    this.isPaused = false;
    this.isStopped = false;

    if (delaySettings) {
      this.delaySettings = delaySettings;
    }
    this.defaultCountryCode = defaultCountryCode;
    this.simulateTyping = simulateTyping;

    const delaySec = this.getEffectiveDelaySeconds();

    this.state = {
      status: 'running',
      currentIndex: 0,
      totalRecipients: queue.length,
      sentCount: 0,
      failedCount: 0,
      remainingSecondsForNext: 0,
      queue: queue.map((q) => ({ ...q, status: 'queued', error: undefined })),
      logs: [],
      startedAt: new Date().toISOString(),
    };

    this.addLog(
      'info',
      `🚀 Background server automation started for ${queue.length} recipient(s). Pacing delay: ${delaySec}s.`
    );
    await this.persistState();

    const targetIndices = this.state.queue.map((_, i) => i);
    // Run execution loop in background without blocking response
    this.runExecutionLoop(targetIndices, currentRunId, delaySec).catch((err) => {
      console.error('[CsvAutomationRunner] run loop error:', err);
    });

    return this.state;
  }

  /**
   * Pauses the server-side runner.
   */
  public async pause(): Promise<AutomationExecutionState> {
    this.isPaused = true;
    this.state.status = 'paused';
    this.state.remainingSecondsForNext = 0;
    this.addLog('warning', '⏸️ Server automation paused. Background worker halted.');
    await this.persistState();
    return this.state;
  }

  /**
   * Resumes the server-side runner.
   */
  public async resume(): Promise<AutomationExecutionState> {
    if (this.state.status !== 'paused') return this.state;

    this.runId += 1;
    const currentRunId = this.runId;
    this.isPaused = false;
    this.isStopped = false;
    this.state.status = 'running';

    const uncompletedIndices: number[] = [];
    this.state.queue.forEach((item, idx) => {
      if (item.status === 'queued' || item.status === 'sending') {
        uncompletedIndices.push(idx);
      }
    });

    if (uncompletedIndices.length === 0) {
      this.state.status = 'completed';
      await this.persistState();
      return this.state;
    }

    const delaySec = this.getEffectiveDelaySeconds();
    this.addLog(
      'info',
      `▶️ Server automation resumed in background (${uncompletedIndices.length} remaining).`
    );
    await this.persistState();

    this.runExecutionLoop(uncompletedIndices, currentRunId, delaySec).catch((err) => {
      console.error('[CsvAutomationRunner] resume loop error:', err);
    });

    return this.state;
  }

  /**
   * Stops and resets the server runner.
   */
  public async stop(): Promise<AutomationExecutionState> {
    this.runId += 1;
    this.isPaused = false;
    this.isStopped = true;

    this.state.status = 'stopped';
    this.state.remainingSecondsForNext = 0;
    this.addLog('warning', '⏹️ Automation stopped by user.');
    await this.persistState();
    return this.state;
  }

  /**
   * Resends/Retries ALL failed numbers in background.
   */
  public async retryFailed(delaySettings?: DelaySettings): Promise<AutomationExecutionState> {
    if (delaySettings) {
      this.delaySettings = delaySettings;
    }

    const failedIndices: number[] = [];
    this.state.queue.forEach((item, idx) => {
      if (item.status === 'failed') {
        failedIndices.push(idx);
        this.state.queue[idx] = {
          ...item,
          status: 'queued',
          error: undefined,
        };
      }
    });

    if (failedIndices.length === 0) {
      return this.state;
    }

    this.runId += 1;
    const currentRunId = this.runId;
    this.isPaused = false;
    this.isStopped = false;
    this.state.status = 'running';

    const delaySec = this.getEffectiveDelaySeconds();
    this.addLog(
      'info',
      `🔄 Background retry started for ${failedIndices.length} failed number(s) with ${delaySec}s delay.`
    );
    await this.persistState();

    this.runExecutionLoop(failedIndices, currentRunId, delaySec).catch((err) => {
      console.error('[CsvAutomationRunner] retry loop error:', err);
    });

    return this.state;
  }

  /**
   * Retries a single failed recipient immediately.
   */
  public async retrySingle(
    recipientId: string
  ): Promise<{ success: boolean; state: AutomationExecutionState; error?: string }> {
    const index = this.state.queue.findIndex((q) => q.id === recipientId);
    if (index === -1) {
      return { success: false, state: this.state, error: 'Recipient not found in queue' };
    }

    const item = this.state.queue[index];
    this.state.queue[index] = { ...item, status: 'sending', error: undefined };
    this.addLog('step', `[RETRY SINGLE] Resending to ${item.recipientContact}...`, item.recipientContact);
    await this.persistState();

    const res = await this.dispatchSingleRecipient(item);
    const nowIso = new Date().toISOString();

    if (res.success) {
      if (this.state.failedCount > 0) this.state.failedCount -= 1;
      this.state.sentCount += 1;
      this.state.queue[index] = {
        ...this.state.queue[index],
        status: 'sent',
        sentAt: nowIso,
        error: undefined,
      };
      this.addLog(
        'success',
        `[SENT] Retry delivered to ${item.recipientContact} successfully!`,
        item.recipientContact
      );
    } else {
      this.state.queue[index] = {
        ...this.state.queue[index],
        status: 'failed',
        error: res.error || 'Retry failed',
      };
      this.addLog(
        'error',
        `[FAILED] Retry to ${item.recipientContact} failed: ${res.error || 'Unknown error'}`,
        item.recipientContact
      );
    }

    await this.persistState();
    return { success: res.success, state: this.state, error: res.error };
  }

  /**
   * Background execution loop that runs on the server independently of the client.
   */
  private async runExecutionLoop(
    targetIndices: number[],
    currentRunId: number,
    delaySec: number
  ): Promise<void> {
    for (let step = 0; step < targetIndices.length; step++) {
      const index = targetIndices[step];

      if (this.runId !== currentRunId || this.isPaused || this.isStopped) {
        break;
      }

      const item = this.state.queue[index];
      if (!item) continue;

      // 1. Mark sending
      this.state.currentIndex = index;
      this.state.remainingSecondsForNext = 0;
      this.state.queue[index] = { ...item, status: 'sending', error: undefined };
      this.addLog(
        'step',
        `[DISPATCH] (${step + 1}/${targetIndices.length}) Sending to ${item.recipientContact} using "${item.assignedVariation.title}"`,
        item.recipientContact,
        item.assignedVariation.title
      );
      await this.persistState();

      // 2. Dispatch
      const res = await this.dispatchSingleRecipient(item);

      if (this.runId !== currentRunId || this.isStopped) {
        break;
      }

      // 3. Record outcome
      const nowIso = new Date().toISOString();
      if (res.success) {
        if (item.status === 'failed' && this.state.failedCount > 0) {
          this.state.failedCount -= 1;
        }
        this.state.sentCount += 1;
        this.state.queue[index] = {
          ...this.state.queue[index],
          status: 'sent',
          sentAt: nowIso,
          error: undefined,
        };
        this.addLog(
          'success',
          `[SENT] Delivered to ${item.recipientContact} successfully!`,
          item.recipientContact
        );
      } else {
        if (item.status !== 'failed') {
          this.state.failedCount += 1;
        }
        this.state.queue[index] = {
          ...this.state.queue[index],
          status: 'failed',
          error: res.error || 'Send failed',
        };
        this.addLog(
          'error',
          `[FAILED] Delivery to ${item.recipientContact} failed: ${res.error || 'Unknown error'}`,
          item.recipientContact
        );
      }
      await this.persistState();

      // 4. Delay countdown before next message
      if (step < targetIndices.length - 1) {
        let remaining = delaySec;
        this.state.remainingSecondsForNext = remaining;
        this.addLog('info', `⏳ Pacing Delay: Waiting ${delaySec}s before sending next message...`);
        await this.persistState();

        while (remaining > 0) {
          if (this.runId !== currentRunId || this.isPaused || this.isStopped) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (this.runId !== currentRunId || this.isPaused || this.isStopped) {
            break;
          }
          remaining -= 1;
          this.state.remainingSecondsForNext = Math.max(0, remaining);
          // Persist every 5s or at end of countdown
          if (remaining % 5 === 0 || remaining === 0) {
            await this.persistState();
          }
        }

        if (this.runId !== currentRunId || this.isPaused || this.isStopped) {
          break;
        }
      }
    }

    // 5. Completion handling
    if (this.runId === currentRunId && !this.isPaused && !this.isStopped) {
      const remainingFailed = this.state.queue.filter((q) => q.status === 'failed').length;
      const finalSent = this.state.queue.filter((q) => q.status === 'sent').length;

      this.state.status = 'completed';
      this.state.remainingSecondsForNext = 0;
      this.state.completedAt = new Date().toISOString();
      this.addLog(
        remainingFailed > 0 ? 'warning' : 'success',
        remainingFailed > 0
          ? `⚠️ Background batch finished: ${finalSent} sent, ${remainingFailed} failed. You can click "Resend to Failed" to retry.`
          : `🎉 Bulk automation completed successfully! All ${finalSent} message(s) delivered.`
      );
      await this.persistState();
    }
  }
}
