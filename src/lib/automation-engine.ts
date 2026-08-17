import {
  AutomationExecutionState,
  ExecutionLog,
  RecipientQueueItem,
} from '@/types/automation';
import { formatWhatsAppPhone } from './phone-formatter';

/**
 * Validates and sanitizes delay setting (in seconds or minutes).
 * Minimum delay allowed is 5 seconds to prevent rate-limit flooding while giving full flexibility (10s, 20s, 30s, etc.).
 */
export function validateAndSanitizeDelay(
  delay: number,
  isMinutes: boolean = false
): {
  sanitizedSeconds: number;
  sanitizedMinutes: number;
  totalSeconds: number;
  isValid: boolean;
  warning?: string;
} {
  const MIN_DELAY_SECONDS = 5;
  const rawSeconds = isMinutes ? delay * 60 : delay;

  if (isNaN(rawSeconds) || rawSeconds < MIN_DELAY_SECONDS) {
    return {
      sanitizedSeconds: MIN_DELAY_SECONDS,
      sanitizedMinutes: Math.round((MIN_DELAY_SECONDS / 60) * 100) / 100,
      totalSeconds: MIN_DELAY_SECONDS,
      isValid: false,
      warning: `Minimum delay must be at least ${MIN_DELAY_SECONDS} seconds for delivery safety. Delay set to ${MIN_DELAY_SECONDS}s.`,
    };
  }

  const roundedSeconds = Math.round(rawSeconds);
  return {
    sanitizedSeconds: roundedSeconds,
    sanitizedMinutes: Math.round((roundedSeconds / 60) * 100) / 100,
    totalSeconds: roundedSeconds,
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
 * Executes real message dispatch via OpenWA Gateway server proxy with human typing simulation & auto +20 prefix.
 */
export async function sendRecipientMessage(
  item: RecipientQueueItem,
  simulateTyping: boolean = true,
  defaultCountryCode: string = '20'
): Promise<{ success: boolean; error?: string }> {
  if (!item.recipientContact || item.recipientContact.trim() === '') {
    return {
      success: false,
      error: 'Recipient contact/phone column value is empty.',
    };
  }

  // Format phone with +20 Egypt / country code auto-prefix
  const cleanPhone = formatWhatsAppPhone(item.recipientContact, defaultCountryCode);
  if (!cleanPhone || cleanPhone.length < 6) {
    return {
      success: false,
      error: `Invalid phone number format: "${item.recipientContact}". Minimum 6 digits required.`,
    };
  }

  try {
    // Determine if this message has an image attachment
    const hasImage = !!(item.imageUrl && item.imageUrl.trim());

    if (hasImage) {
      // Send the image (with caption = the message text for context)
      const imageRes = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-image',
          chatId: `${cleanPhone}@c.us`,
          imageUrl: item.imageUrl!.trim(),
          caption: item.resolvedMessage || '',
          simulateTyping: simulateTyping,
          defaultCountryCode: defaultCountryCode,
        }),
      });

      const imageData = await imageRes.json().catch(() => ({}));

      if (!imageRes.ok || !imageData.success) {
        // Fallback: if image send fails, try sending as plain text instead
        console.warn('[automation-engine] Image send failed, falling back to text-only:', imageData.error);
        const textRes = await fetch('/api/whatsapp/sessions-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-text',
            chatId: `${cleanPhone}@c.us`,
            text: item.resolvedMessage,
            simulateTyping: simulateTyping,
            defaultCountryCode: defaultCountryCode,
          }),
        });
        const textData = await textRes.json().catch(() => ({}));
        if (textRes.ok && textData.success) {
          return { success: true };
        }
        return { success: false, error: imageData.error || textData.error || 'Image and text fallback both failed' };
      }

      return { success: true };
    }

    // No image — standard text-only send
    const res = await fetch('/api/whatsapp/sessions-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-text',
        chatId: `${cleanPhone}@c.us`,
        text: item.resolvedMessage,
        simulateTyping: simulateTyping,
        defaultCountryCode: defaultCountryCode,
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
