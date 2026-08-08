import * as XLSX from 'xlsx';
import { CsvParseResult, CsvRow } from '@/types/automation';

/**
 * Keywords to identify recipient contact column
 */
const RECIPIENT_COLUMN_KEYWORDS = [
  'phone',
  'mobile',
  'contact',
  'recipient',
  'whatsapp',
  'number',
  'tel',
  'telephone',
  'email',
  'contact_number',
  'phone_number',
  'mobile_number',
];

/**
 * Parses an Excel (.xlsx / .xls) ArrayBuffer or Buffer into structured CsvParseResult.
 * Automatically discovers sheets, headers, data rows, and recipient contact columns.
 */
export function parseExcelBuffer(
  arrayBuffer: ArrayBuffer | Uint8Array,
  filename = 'uploaded.xlsx',
  targetSheetName?: string
): CsvParseResult {
  const result: CsvParseResult = {
    headers: [],
    recipientColumn: null,
    rows: [],
    totalRows: 0,
    validRowsCount: 0,
    errors: [],
    filename,
    fileType: filename.toLowerCase().endsWith('.xls') ? 'xls' : 'xlsx',
    availableSheets: [],
    selectedSheet: undefined,
  };

  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      result.errors.push('The uploaded Excel file contains no valid sheets.');
      return result;
    }

    result.availableSheets = workbook.SheetNames;
    const selectedSheet =
      targetSheetName && workbook.SheetNames.includes(targetSheetName)
        ? targetSheetName
        : workbook.SheetNames[0];
    result.selectedSheet = selectedSheet;

    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) {
      result.errors.push(`Sheet "${selectedSheet}" could not be found in the Excel workbook.`);
      return result;
    }

    // Convert sheet to 2D matrix of values
    const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (!matrix || matrix.length === 0) {
      result.errors.push(`Sheet "${selectedSheet}" is completely empty.`);
      return result;
    }

    // Row 1 is header row
    const rawHeaders: any[] = matrix[0] || [];
    const headers = rawHeaders.map((h) => String(h ?? '').trim().replace(/^[\uFEFF]/, ''));

    if (headers.length === 0 || headers.every((h) => !h)) {
      result.errors.push(
        `The first row in sheet "${selectedSheet}" is empty. Row 1 must contain column header names.`
      );
      return result;
    }

    // Unique header names
    const seenHeaders = new Set<string>();
    const sanitizedHeaders: string[] = [];

    headers.forEach((h, index) => {
      let cleanHeader = h || `column_${index + 1}`;
      let counter = 1;
      while (seenHeaders.has(cleanHeader)) {
        cleanHeader = `${h || `column_${index + 1}`}_${counter}`;
        counter++;
      }
      seenHeaders.add(cleanHeader);
      sanitizedHeaders.push(cleanHeader);
    });

    result.headers = sanitizedHeaders;

    // Detect recipient column
    let detectedRecipient: string | null = null;
    for (const keyword of RECIPIENT_COLUMN_KEYWORDS) {
      const match = sanitizedHeaders.find((h) => h.toLowerCase().trim() === keyword);
      if (match) {
        detectedRecipient = match;
        break;
      }
    }

    if (!detectedRecipient) {
      for (const keyword of RECIPIENT_COLUMN_KEYWORDS) {
        const match = sanitizedHeaders.find((h) => h.toLowerCase().includes(keyword));
        if (match) {
          detectedRecipient = match;
          break;
        }
      }
    }

    result.recipientColumn = detectedRecipient || sanitizedHeaders[0];

    // Data rows
    const dataRows = matrix.slice(1);
    const rows: CsvRow[] = [];

    dataRows.forEach((rowValues, rowIndex) => {
      if (!rowValues || rowValues.length === 0) return;

      // Skip completely empty lines
      const isEmpty = rowValues.every(
        (val) => val === null || val === undefined || String(val).trim() === ''
      );
      if (isEmpty) return;

      const rowObj: CsvRow = {
        __id: `row_${rowIndex + 1}`,
      };

      sanitizedHeaders.forEach((header, colIndex) => {
        const rawVal = rowValues[colIndex];
        rowObj[header] = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
      });

      rows.push(rowObj);
    });

    result.rows = rows;
    result.totalRows = rows.length;
    result.validRowsCount = rows.length;

    if (rows.length === 0) {
      result.errors.push(`Sheet "${selectedSheet}" contains headers but no recipient data rows.`);
    }
  } catch (err: any) {
    result.errors.push(`Failed to parse Excel file: ${err.message || String(err)}`);
  }

  return result;
}
