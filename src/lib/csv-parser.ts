import { CsvParseResult, CsvRow } from '@/types/automation';
import { parseExcelBuffer } from './excel-parser';

export { parseExcelBuffer } from './excel-parser';

/**
 * Common column headers that indicate a recipient contact (phone, email, contact, etc.)
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
 * Parses raw CSV string content into structured CSV headers and data rows.
 * Implements deterministic quote handling, delimiter detection, and recipient column auto-detection.
 */
export function parseCsv(csvText: string, filename = 'uploaded.csv'): CsvParseResult {
  const result: CsvParseResult = {
    headers: [],
    recipientColumn: null,
    rows: [],
    totalRows: 0,
    validRowsCount: 0,
    errors: [],
    filename,
    fileType: 'csv',
  };

  if (!csvText || !csvText.trim()) {
    result.errors.push('The uploaded CSV file is completely empty.');
    return result;
  }

  // Parse lines considering quotes and escaped newlines
  const parsedGrid = parseCsvRows(csvText);

  if (parsedGrid.length === 0) {
    result.errors.push('No readable rows found in the CSV file.');
    return result;
  }

  // Row 1 is the header row
  const rawHeaders = parsedGrid[0];
  const headers = rawHeaders.map((h) => h.trim().replace(/^[\uFEFF]/, '')); // Strip BOM if present

  if (headers.length === 0 || headers.every((h) => !h)) {
    result.errors.push('CSV header row is empty. The first row must contain column header names.');
    return result;
  }

  // Ensure unique header names
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

  // Secondary check: partial match (e.g., "user_phone" or "customer_email")
  if (!detectedRecipient) {
    for (const keyword of RECIPIENT_COLUMN_KEYWORDS) {
      const match = sanitizedHeaders.find((h) => h.toLowerCase().includes(keyword));
      if (match) {
        detectedRecipient = match;
        break;
      }
    }
  }

  // Fallback: Default to the first column if no keyword match
  result.recipientColumn = detectedRecipient || sanitizedHeaders[0];

  // Parse data rows
  const rawDataRows = parsedGrid.slice(1);
  const rows: CsvRow[] = [];

  rawDataRows.forEach((rowCells, rowIndex) => {
    // Skip empty lines
    if (rowCells.length === 1 && !rowCells[0].trim()) {
      return;
    }

    const rowObj: CsvRow = {
      __id: `row_${rowIndex + 1}`,
    };

    sanitizedHeaders.forEach((header, colIndex) => {
      rowObj[header] = (rowCells[colIndex] || '').trim();
    });

    rows.push(rowObj);
  });

  result.rows = rows;
  result.totalRows = rows.length;
  result.validRowsCount = rows.length;

  // Validation checks
  if (rows.length === 0) {
    result.errors.push('CSV file contains headers but no recipient data rows were found.');
  }

  if (!result.recipientColumn) {
    result.errors.push('Could not detect a valid recipient column (e.g. phone, mobile, email) in headers.');
  }

  return result;
}

/**
 * Format-aware file parser for CSV, XLSX, and XLS inputs.
 */
export function parseFileBuffer(
  buffer: ArrayBuffer,
  filename: string,
  targetSheetName?: string
): CsvParseResult {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const excelRes = parseExcelBuffer(buffer, filename, targetSheetName);
    excelRes.rawBuffer = buffer;
    return excelRes;
  }

  // Treat as CSV / Text file
  const text = new TextDecoder('utf-8').decode(buffer);
  const csvRes = parseCsv(text, filename);
  csvRes.rawBuffer = buffer;
  return csvRes;
}

/**
 * Low-level CSV state machine parser supporting quotes, commas, and line breaks.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentToken = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // Escaped double quote ("")
        currentToken += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      // End of column
      currentRow.push(currentToken);
      currentToken = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      // End of row
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n in CRLF
      }
      currentRow.push(currentToken);
      currentToken = '';
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentToken += char;
    }
  }

  // Push remaining token & row if any
  if (currentToken || currentRow.length > 0) {
    currentRow.push(currentToken);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Built-in Sample Datasets for instant 1-click testing
 */
export const SAMPLE_CSV_DATASETS = [
  {
    id: 'exam_results',
    name: 'Student Exam Results',
    description: 'Contains student names, phone numbers, courses, and exam grade results.',
    csv: `name,phone,result,course,grade
Sarah Johnson,+12025550143,Passed,Computer Science,A
Mohamed Ahmed,+201234567890,Passed,Data Science,A+
Alex Rivera,+14155550188,Distinction,Software Engineering,A
Emma Watson,+442079460912,Passed,Artificial Intelligence,B+
Omar Hassan,+201098765432,Pending,Cloud Computing,In Progress`,
  },
  {
    id: 'b2b_outreach',
    name: 'B2B Sales Prospects',
    description: 'Contains lead names, contacts, company names, and custom offer angles.',
    csv: `name,phone,company,industry,offer
John Doe,+13125550199,TechCorp,SaaS,20% Enterprise Automation Discount
Layla Mahmoud,+201122334455,Al-Amal Logistics,Supply Chain,Free 1-on-1 Operations Audit
David Miller,+447700900077,Apex Dynamics,Fintech,Custom WhatsApp Gateway Trial
Nour El-Din,+201555443322,Smart Retail,E-Commerce,Automated Customer Support Integration`,
  },
  {
    id: 'customer_billing',
    name: 'Customer Billing Notifications',
    description: 'Contains customer names, mobile numbers, invoice amounts, and due dates.',
    csv: `name,mobile,invoice_id,amount,due_date
Michael Scott,+15550192834,INV-2026-881,$450.00,2026-08-15
Fatima Al-Sayed,+201200112233,INV-2026-882,$1,200.00,2026-08-18
Robert Chen,+14155550122,INV-2026-883,$750.00,2026-08-20`,
  },
];
