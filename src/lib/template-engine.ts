import {
  CsvRow,
  MessageVariation,
  RecipientQueueItem,
  VariableValidationResult,
} from '@/types/automation';

/**
 * Regular expression to match dynamic variable placeholders like {{variable_name}}
 */
const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g;

/**
 * Extracts all unique dynamic variable names from a text string.
 * Example: "Hello {{name}}, your result is {{result}}" -> ["name", "result"]
 */
export function extractVariables(text: string): string[] {
  if (!text) return [];
  const matches = new Set<string>();
  let match: RegExpExecArray | null;

  // Reset regex state
  const regex = new RegExp(VARIABLE_REGEX);
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      matches.add(match[1].trim());
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
  const headerSet = new Set(csvHeaders.map((h) => h.toLowerCase().trim()));

  const validVariables: string[] = [];
  const missingVariables: string[] = [];

  usedVariables.forEach((variable) => {
    const lowerVar = variable.toLowerCase().trim();
    if (headerSet.has(lowerVar)) {
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
 * Replaces {{var_name}} case-insensitively with row values.
 */
export function renderMessageTemplate(template: string, row: CsvRow): string {
  if (!template) return '';

  return template.replace(VARIABLE_REGEX, (fullMatch, varName) => {
    const trimmedVar = varName.trim();

    // Direct match
    if (row[trimmedVar] !== undefined && row[trimmedVar] !== null) {
      return row[trimmedVar];
    }

    // Case-insensitive fallback match
    const lowerVar = trimmedVar.toLowerCase();
    const matchingKey = Object.keys(row).find((k) => k.toLowerCase() === lowerVar);
    if (matchingKey && row[matchingKey] !== undefined) {
      return row[matchingKey];
    }

    return `[${trimmedVar}]`; // Fallback placeholder if missing
  });
}

/**
 * Builds the recipient queue by assigning exactly ONE randomly selected variation to each recipient.
 * Ensures zero duplicate messages per recipient.
 */
export function buildRecipientQueue(
  rows: CsvRow[],
  recipientColumn: string,
  variations: MessageVariation[]
): RecipientQueueItem[] {
  if (!rows || rows.length === 0 || !variations || variations.length === 0) {
    return [];
  }

  const validVariations = variations.filter((v) => v.content.trim().length > 0);
  if (validVariations.length === 0) return [];

  return rows.map((row, index) => {
    // Randomly select 1 variation from available non-empty variations
    const randomIndex = Math.floor(Math.random() * validVariations.length);
    const assignedVariation = validVariations[randomIndex];

    // Determine recipient contact string (e.g. phone or email)
    const recipientContact = row[recipientColumn] || row.__id || `Recipient #${index + 1}`;

    // Render message text specifically for this recipient row
    const resolvedMessage = renderMessageTemplate(assignedVariation.content, row);

    return {
      id: `queue_${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientId: row.__id,
      recipientContact,
      rowData: row,
      assignedVariation,
      resolvedMessage,
      status: 'queued',
    };
  });
}
