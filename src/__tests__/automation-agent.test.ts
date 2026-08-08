import { parseCsv, SAMPLE_CSV_DATASETS } from '@/lib/csv-parser';
import {
  extractVariables,
  extractVariablesFromVariations,
  validateVariablesAgainstHeaders,
  renderMessageTemplate,
  buildRecipientQueue,
} from '@/lib/template-engine';
import { findCompatibleTemplates, DEFAULT_SAVED_TEMPLATES } from '@/lib/template-store';
import { validateAndSanitizeDelay } from '@/lib/automation-engine';

describe('CSV Parsing & Auto-Detection Engine', () => {
  it('should auto-detect column headers and recipient column', () => {
    const csv = `name,phone,result\nAlice,+123456789,Pass\nBob,+987654321,Fail`;
    const parsed = parseCsv(csv);

    expect(parsed.headers).toEqual(['name', 'phone', 'result']);
    expect(parsed.recipientColumn).toBe('phone');
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0].name).toBe('Alice');
    expect(parsed.rows[0].result).toBe('Pass');
  });

  it('should validate CSV headers and rows presence', () => {
    const emptyCsv = ``;
    const parsed = parseCsv(emptyCsv);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.headers.length).toBe(0);
  });

  it('should correctly parse sample datasets', () => {
    const sample = SAMPLE_CSV_DATASETS[0];
    const parsed = parseCsv(sample.csv);
    expect(parsed.headers).toContain('name');
    expect(parsed.headers).toContain('result');
    expect(parsed.rows.length).toBe(5);
  });
});

describe('Message Builder & Dynamic Variables Engine', () => {
  it('should extract variables enclosed in double curly brackets', () => {
    const template = 'Hello {{name}}, your result is {{result}}. Call {{phone}}.';
    const vars = extractVariables(template);
    expect(vars).toEqual(['name', 'result', 'phone']);
  });

  it('should validate that all message variables exist in CSV headers', () => {
    const csvHeaders = ['name', 'phone', 'result'];
    const variations = [
      { id: '1', title: 'V1', content: 'Hello {{name}}, result: {{result}}' },
      { id: '2', title: 'V2', content: 'Hi {{name}}, missing var: {{discount}}' },
    ];

    const validation = validateVariablesAgainstHeaders(variations, csvHeaders);
    expect(validation.isValid).toBe(false);
    expect(validation.validVariables).toEqual(['name', 'result']);
    expect(validation.missingVariables).toEqual(['discount']);
  });

  it('should interpolate template variables with row data', () => {
    const row = { __id: 'row_1', name: 'Sarah', result: 'Passed' };
    const template = 'Hello {{name}}, you {{result}}!';
    const rendered = renderMessageTemplate(template, row);
    expect(rendered).toBe('Hello Sarah, you Passed!');
  });
});

describe('Multiple Variations & Distribution Rules', () => {
  it('should assign exactly one variation to each recipient with no duplicates', () => {
    const rows = [
      { __id: 'r1', phone: '+1001', name: 'User 1' },
      { __id: 'r2', phone: '+1002', name: 'User 2' },
      { __id: 'r3', phone: '+1003', name: 'User 3' },
    ];
    const variations = [
      { id: 'v1', title: 'Var 1', content: 'Hello {{name}} - Option A' },
      { id: 'v2', title: 'Var 2', content: 'Hi {{name}} - Option B' },
    ];

    const queue = buildRecipientQueue(rows, 'phone', variations);
    expect(queue.length).toBe(3);

    // Each recipient should have exactly 1 assigned variation
    queue.forEach((item) => {
      expect(item.assignedVariation).toBeDefined();
      expect(item.resolvedMessage).toContain('User');
      expect(item.status).toBe('queued');
    });
  });
});

describe('Delay Control Minimum Rule Enforcement', () => {
  it('should enforce a minimum delay of 1 minute (60s)', () => {
    const invalidDelay = validateAndSanitizeDelay(0.5);
    expect(invalidDelay.isValid).toBe(false);
    expect(invalidDelay.sanitizedMinutes).toBe(1);
    expect(invalidDelay.totalSeconds).toBe(60);

    const validDelay = validateAndSanitizeDelay(3);
    expect(validDelay.isValid).toBe(true);
    expect(validDelay.sanitizedMinutes).toBe(3);
    expect(validDelay.totalSeconds).toBe(180);
  });
});

describe('Saved Templates Compatibility Matching', () => {
  it('should detect compatible templates based on matching CSV column names', () => {
    const csvHeaders = ['name', 'phone', 'course', 'result', 'grade'];
    const matches = findCompatibleTemplates(csvHeaders, DEFAULT_SAVED_TEMPLATES);

    const examTpl = matches.find((m) => m.template.id === 'tpl_exam_results');
    expect(examTpl?.isCompatible).toBe(true);
    expect(examTpl?.compatibilityPercentage).toBe(100);

    const billingTpl = matches.find((m) => m.template.id === 'tpl_billing_notice');
    expect(billingTpl?.isCompatible).toBe(false); // Missing invoice_id, amount
    expect(billingTpl?.missingVariables).toContain('invoice_id');
  });
});
