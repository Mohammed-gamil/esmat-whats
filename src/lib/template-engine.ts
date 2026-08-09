import {
  CsvRow,
  MessageVariation,
  RecipientQueueItem,
  VariableValidationResult,
} from '@/types/automation';
import { formatWhatsAppPhone } from './phone-formatter';

/**
 * Robust Regex matching dynamic variables in English, Arabic, numbers, dots, spaces, underscores:
 * Matches: {{name}}, {name}, ${name}, {{اسم_العميل}}, {النتيجة}, {1}, {2}, etc.
 */
const VARIABLE_REGEX = /(?:\$\{?|\{\{?)\s*([^{}\r\n]+?)\s*(?:\}\}?|\}?)/g;

/**
 * Sanitizes variable key for matching (lowercasing, trimming spaces, normalizing Unicode).
 */
function normalizeKey(str: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().normalize('NFC').replace(/[\s_\-\.]+/g, '');
}

/**
 * Extracts all unique dynamic variable names from a text template string.
 * Supports English & Arabic variable names (e.g. {{اسم_العميل}}, {1}, {{result}}).
 */
export function extractVariables(text: string): string[] {
  if (!text) return [];
  const matches = new Set<string>();
  let match: RegExpExecArray | null;

  const regex = new RegExp(VARIABLE_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      const cleanVar = match[1].trim();
      if (cleanVar && !cleanVar.startsWith('#')) {
        matches.add(cleanVar);
      }
    }
  }

  return Array.from(matches);
}

/**
 * Extracts all unique variables used across multiple message variations.
 */
export function extractVariablesFromVariations(variations: MessageVariation[]): string[] {
  const allVariables = new Set<string>();
  variations.forEach((varObj) => {
    const vars = extractVariables(varObj.content);
    vars.forEach((v) => allVariables.add(v));
  });
  return Array.from(allVariables);
}

/**
 * Validates whether all variables used in message variations exist in the CSV headers list.
 */
export function validateVariablesAgainstHeaders(
  variations: MessageVariation[],
  csvHeaders: string[]
): VariableValidationResult {
  const usedVariables = extractVariablesFromVariations(variations);
  const normalizedHeaderSet = new Set(csvHeaders.map((h) => normalizeKey(h)));

  const validVariables: string[] = [];
  const missingVariables: string[] = [];

  usedVariables.forEach((variable) => {
    const normVar = normalizeKey(variable);
    // Allow numerical index variables like {1}, {2} if csvHeaders exist
    const isNumIndex = /^\d+$/.test(variable) && parseInt(variable, 10) <= csvHeaders.length;

    if (normalizedHeaderSet.has(normVar) || isNumIndex) {
      validVariables.push(variable);
    } else {
      missingVariables.push(variable);
    }
  });

  return {
    isValid: missingVariables.length === 0,
    usedVariables,
    missingVariables,
    validVariables,
  };
}

/**
 * Interpolates variables in a message text template using values from a CSV row.
 * Handles English, Arabic, dynamic headers, index-based variables ({1}, {2}), and missing fallbacks.
 */
export function renderMessageTemplate(template: string, row: CsvRow): string {
  if (!template) return '';

  const rowKeys = Object.keys(row).filter((k) => !k.startsWith('__'));

  return template.replace(new RegExp(VARIABLE_REGEX.source, 'g'), (fullMatch, rawVarName) => {
    const varName = String(rawVarName || '').trim();
    if (!varName) return fullMatch;

    // 1. Direct exact key match
    if (row[varName] !== undefined && row[varName] !== null) {
      return String(row[varName]);
    }

    // 2. Normalized key match (handles Arabic & case-insensitive matching)
    const targetNorm = normalizeKey(varName);
    const matchingKey = rowKeys.find((k) => normalizeKey(k) === targetNorm);
    if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
      return String(row[matchingKey]);
    }

    // 3. Numerical column index match ({1} -> 1st column, {2} -> 2nd column)
    if (/^\d+$/.test(varName)) {
      const colIdx = parseInt(varName, 10) - 1; // 1-based index to 0-based
      if (colIdx >= 0 && colIdx < rowKeys.length) {
        const keyAtIdx = rowKeys[colIdx];
        if (row[keyAtIdx] !== undefined && row[keyAtIdx] !== null) {
          return String(row[keyAtIdx]);
        }
      }
    }

    // 4. Fallback if not found in CSV row: return empty string if blank, or key name
    return '';
  });
}

/**
 * Builds the recipient queue by assigning exactly ONE randomly selected variation to each recipient.
 * Formats phone numbers automatically with +20 Egypt / international prefix.
 */
export function buildRecipientQueue(
  rows: CsvRow[],
  recipientColumn: string,
  variations: MessageVariation[],
  defaultCountryCode: string = '20'
): RecipientQueueItem[] {
  if (!rows || rows.length === 0 || !variations || variations.length === 0) {
    return [];
  }

  const validVariations = variations.filter((v) => v.content.trim().length > 0);
  if (validVariations.length === 0) return [];

  return rows.map((row, index) => {
    // Select variation
    const randomIndex = Math.floor(Math.random() * validVariations.length);
    const assignedVariation = validVariations[randomIndex];

    // Determine raw contact string
    const rawContact = String(row[recipientColumn] || row.__id || `Recipient #${index + 1}`);

    // Auto-format phone with +20 Egypt / country code prefix
    const formattedContact = formatWhatsAppPhone(rawContact, defaultCountryCode) || rawContact;

    // Render message text specifically for this recipient row (Arabic + English dynamic variables)
    const resolvedMessage = renderMessageTemplate(assignedVariation.content, row);

    return {
      id: `queue_${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientId: row.__id,
      recipientContact: formattedContact,
      rowData: row,
      assignedVariation,
      resolvedMessage,
      status: 'queued',
    };
  });
}
