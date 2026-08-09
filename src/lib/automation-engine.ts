import {
  AutomationExecutionState,
  ExecutionLog,
  RecipientQueueItem,
} from '@/types/automation';

/**
 * Enforces the strict rule that delay cannot be lower than 1 minute (60 seconds).
 */
export function validateAndSanitizeDelay(delayMinutes: number): {
  sanitizedMinutes: number;
  totalSeconds: number;
  isValid: boolean;
  warning?: string;
} {
  if (isNaN(delayMinutes) || delayMinutes < 1) {
    return {
      sanitizedMinutes: 1,
      totalSeconds: 60,
      isValid: false,
      warning: 'Minimum delay must be at least 1 minute. Delay has been automatically set to 1 minute.',
    };
  }

  return {
    sanitizedMinutes: delayMinutes,
    totalSeconds: Math.round(delayMinutes * 60),
    isValid: true,
  };
}

/**
 * Creates an initial automation state for execution.
 */
export function createInitialExecutionState(
  queue: RecipientQueueItem[]
): AutomationExecutionState {
  return {
    status: 'idle',
    currentIndex: 0,
    totalRecipients: queue.length,
    sentCount: 0,
    failedCount: 0,
    remainingSecondsForNext: 0,
    queue: queue.map((q) => ({ ...q, status: 'queued' })),
    logs: [
      {
        id: `log_init_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `Automation session initialized with ${queue.length} queued recipient(s).`,
      },
    ],
  };
}

/**
 * Helper to add structured execution log.
 */
export function addExecutionLog(
  logs: ExecutionLog[],
  type: ExecutionLog['type'],
  message: string,
  recipientContact?: string,
  variationTitle?: string
): ExecutionLog[] {
  const newLog: ExecutionLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    recipientContact,
    variationTitle,
  };

  // Keep last 100 logs for memory performance
  return [newLog, ...logs.slice(0, 99)];
}

/**
 * Executes real message dispatch via OpenWA Gateway server proxy.
 */
export async function sendRecipientMessage(
  item: RecipientQueueItem,
  onProgressLog?: (log: ExecutionLog) => void
): Promise<{ success: boolean; error?: string }> {
  if (!item.recipientContact || item.recipientContact.trim() === '') {
    return {
      success: false,
      error: 'Recipient contact/phone column value is empty.',
    };
  }

  const cleanPhone = item.recipientContact.replace(/[^\d]/g, '');
  if (!cleanPhone || cleanPhone.length < 6) {
    return {
      success: false,
      error: `Invalid phone number format: "${item.recipientContact}". Minimum 6 digits required.`,
    };
  }

  try {
    const res = await fetch('/api/whatsapp/sessions-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-text',
        chatId: `${cleanPhone}@c.us`,
        text: item.resolvedMessage,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      return { success: true };
    }

    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: false,
      error: `Gateway returned unexpected status ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to reach OpenWA Gateway server.',
    };
  }
}
