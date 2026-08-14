/**
 * CSV-Based Bulk Message Automation Agent Types
 */

export interface CsvHeader {
  name: string;
  isRecipientColumn: boolean;
  sampleValues: string[];
}

export interface CsvRow {
  __id: string; // Unique recipient identifier (1-indexed row)
  [columnName: string]: string;
}

export interface CsvParseResult {
  headers: string[];
  recipientColumn: string | null;
  rows: CsvRow[];
  totalRows: number;
  validRowsCount: number;
  errors: string[];
  filename?: string;
  fileType?: 'csv' | 'xlsx' | 'xls';
  availableSheets?: string[];
  selectedSheet?: string;
  rawBuffer?: ArrayBuffer;
}

export interface MessageVariation {
  id: string;
  title: string;
  content: string;
  imageUrl?: string; // Optional image URL per variation (sent via OpenWA send-image)
}

export interface VariableValidationResult {
  isValid: boolean;
  usedVariables: string[];
  missingVariables: string[];
  validVariables: string[];
}

export interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  variations: MessageVariation[];
  requiredVariables: string[];
  createdAt: string; // ISO string
  updatedAt: string;
}

export interface DelaySettings {
  delayMinutes: number; // Minimum 1 minute
  customSeconds?: number; // Calculated total seconds (minimum 60s)
}

export interface RecipientQueueItem {
  id: string;
  recipientId: string;
  recipientContact: string; // Phone / Email / Name
  rowData: CsvRow;
  assignedVariation: MessageVariation;
  resolvedMessage: string;
  imageUrl?: string; // Resolved image URL from the assigned variation
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';
  sentAt?: string;
  error?: string;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'step';
  message: string;
  recipientContact?: string;
  variationTitle?: string;
}

export interface AutomationExecutionState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  currentIndex: number;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  remainingSecondsForNext: number;
  queue: RecipientQueueItem[];
  logs: ExecutionLog[];
  startedAt?: string;
  completedAt?: string;
}
