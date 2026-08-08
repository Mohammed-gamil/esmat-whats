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
 * Simulates or sends a message to a recipient deterministically.
 */
export async function sendRecipientMessage(
  item: RecipientQueueItem,
  onProgressLog?: (log: ExecutionLog) => void
): Promise<{ success: boolean; error?: string }> {
  // Deterministic simulation/dispatch
  // Check if phone/contact is present
  if (!item.recipientContact || item.recipientContact.trim() === '') {
    return {
      success: false,
      error: 'Recipient contact/phone column value is empty.',
    };
  }

  // Small async tick to simulate network dispatch (e.g. gateway socket call)
  await new Promise((resolve) => setTimeout(resolve, 400));

  // 99% success rate simulation in standalone mode (unless test fails)
  const isFailed = item.recipientContact.includes('000000') || item.recipientContact.toLowerCase().includes('invalid');

  if (isFailed) {
    return {
      success: false,
      error: 'Gateway reported invalid recipient number formatting.',
    };
  }

  return { success: true };
}
