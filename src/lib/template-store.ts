import { SavedTemplate, MessageVariation } from '@/types/automation';
import { extractVariablesFromVariations } from './template-engine';

const STORAGE_KEY = 'csv_bulk_automation_saved_templates_v1';

/**
 * Built-in default saved templates
 */
export const DEFAULT_SAVED_TEMPLATES: SavedTemplate[] = [
  {
    id: 'tpl_exam_results',
    name: 'Academic Exam Results Broadcast',
    description: 'Compatible with CSV files containing name, phone, course, result, grade.',
    requiredVariables: ['name', 'result', 'course'],
    variations: [
      {
        id: 'var_1',
        title: 'Variation 1 (Friendly & Direct)',
        content: 'Hello {{name}}, your final exam result for {{course}} is now published: {{result}} (Grade: {{grade}}). Congratulations!',
      },
      {
        id: 'var_2',
        title: 'Variation 2 (Formal Announcement)',
        content: 'Dear {{name}}, this is an official update regarding your {{course}} assessment. Status: {{result}} with Grade {{grade}}.',
      },
      {
        id: 'var_3',
        title: 'Variation 3 (Encouraging Tone)',
        content: 'Hi {{name}}! Great news regarding your {{course}} course. Your official result is {{result}}. Keep up the great work!',
      },
    ],
    createdAt: new Date('2026-08-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T10:00:00Z').toISOString(),
  },
  {
    id: 'tpl_b2b_outreach',
    name: 'B2B Cold Outreach Campaign',
    description: 'Compatible with CSV files containing name, phone, company, offer.',
    requiredVariables: ['name', 'company', 'offer'],
    variations: [
      {
        id: 'var_b2b_1',
        title: 'Variation 1 (Direct Value Prop)',
        content: 'Hi {{name}}, noticed your work at {{company}}. We are currently offering {{offer}} for team growth. Would love to share details!',
      },
      {
        id: 'var_b2b_2',
        title: 'Variation 2 (Short Inquiry)',
        content: 'Hello {{name}}, hope all is well at {{company}}. We have an exclusive update regarding {{offer}}. Let me know if you would like a quick overview.',
      },
    ],
    createdAt: new Date('2026-08-02T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-02T12:00:00Z').toISOString(),
  },
  {
    id: 'tpl_billing_notice',
    name: 'Billing & Invoice Reminders',
    description: 'Compatible with CSV files containing name, mobile, invoice_id, amount, due_date.',
    requiredVariables: ['name', 'invoice_id', 'amount', 'due_date'],
    variations: [
      {
        id: 'var_bill_1',
        title: 'Standard Reminder',
        content: 'Hi {{name}}, friendly reminder that invoice {{invoice_id}} for {{amount}} is due on {{due_date}}. Thank you!',
      },
      {
        id: 'var_bill_2',
        title: 'Urgent Notification',
        content: 'Hello {{name}}, your account statement {{invoice_id}} totaling {{amount}} is scheduled for {{due_date}}. Please verify payment.',
      },
    ],
    createdAt: new Date('2026-08-03T14:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-03T14:00:00Z').toISOString(),
  },
];

/**
 * Retrieves all saved templates from localStorage combined with default presets.
 */
export function getSavedTemplates(): SavedTemplate[] {
  if (typeof window === 'undefined') {
    return DEFAULT_SAVED_TEMPLATES;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SAVED_TEMPLATES));
      return DEFAULT_SAVED_TEMPLATES;
    }
    const parsed: SavedTemplate[] = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error('Failed to parse saved templates from localStorage', err);
    return DEFAULT_SAVED_TEMPLATES;
  }
}

/**
 * Saves a new template or updates an existing template in localStorage.
 */
export function saveTemplate(
  name: string,
  variations: MessageVariation[],
  description?: string,
  existingId?: string
): SavedTemplate {
  const templates = getSavedTemplates();
  const requiredVariables = extractVariablesFromVariations(variations);

  const now = new Date().toISOString();

  let targetTemplate: SavedTemplate;

  if (existingId) {
    const index = templates.findIndex((t) => t.id === existingId);
    if (index !== -1) {
      targetTemplate = {
        ...templates[index],
        name,
        description: description || templates[index].description,
        variations,
        requiredVariables,
        updatedAt: now,
      };
      templates[index] = targetTemplate;
    } else {
      targetTemplate = {
        id: existingId,
        name,
        description,
        variations,
        requiredVariables,
        createdAt: now,
        updatedAt: now,
      };
      templates.push(targetTemplate);
    }
  } else {
    targetTemplate = {
      id: `tpl_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      description,
      variations,
      requiredVariables,
      createdAt: now,
      updatedAt: now,
    };
    templates.unshift(targetTemplate);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }

  return targetTemplate;
}

/**
 * Deletes a template by ID from localStorage.
 */
export function deleteTemplate(id: string): SavedTemplate[] {
  const templates = getSavedTemplates();
  const filtered = templates.filter((t) => t.id !== id);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  return filtered;
}

export interface TemplateCompatibility {
  template: SavedTemplate;
  isCompatible: boolean;
  matchingVariables: string[];
  missingVariables: string[];
  compatibilityPercentage: number;
}

/**
 * Finds all compatible saved templates based on matching CSV column names.
 * A template is 100% compatible if all requiredVariables are present in csvHeaders.
 */
export function findCompatibleTemplates(
  csvHeaders: string[],
  templates: SavedTemplate[]
): TemplateCompatibility[] {
  if (!csvHeaders || csvHeaders.length === 0) {
    return templates.map((t) => ({
      template: t,
      isCompatible: false,
      matchingVariables: [],
      missingVariables: t.requiredVariables,
      compatibilityPercentage: 0,
    }));
  }

  const csvHeaderSet = new Set(csvHeaders.map((h) => h.toLowerCase().trim()));

  return templates.map((tpl) => {
    if (tpl.requiredVariables.length === 0) {
      return {
        template: tpl,
        isCompatible: true,
        matchingVariables: [],
        missingVariables: [],
        compatibilityPercentage: 100,
      };
    }

    const matching: string[] = [];
    const missing: string[] = [];

    tpl.requiredVariables.forEach((reqVar) => {
      if (csvHeaderSet.has(reqVar.toLowerCase().trim())) {
        matching.push(reqVar);
      } else {
        missing.push(reqVar);
      }
    });

    const isCompatible = missing.length === 0;
    const compatibilityPercentage = Math.round(
      (matching.length / tpl.requiredVariables.length) * 100
    );

    return {
      template: tpl,
      isCompatible,
      matchingVariables: matching,
      missingVariables: missing,
      compatibilityPercentage,
    };
  });
}
