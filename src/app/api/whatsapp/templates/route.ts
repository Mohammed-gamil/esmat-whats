import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SavedTemplate } from '@/types/automation';
import { DEFAULT_SAVED_TEMPLATES } from '@/lib/template-store';

export const dynamic = 'force-dynamic';

const TEMPLATES_FILE = path.join(process.cwd(), 'prisma', 'templates.json');

function ensureTemplatesFile(): SavedTemplate[] {
  try {
    const dir = path.dirname(TEMPLATES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(TEMPLATES_FILE)) {
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(DEFAULT_SAVED_TEMPLATES, null, 2), 'utf-8');
      return DEFAULT_SAVED_TEMPLATES;
    }
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SAVED_TEMPLATES;
  } catch (e) {
    return DEFAULT_SAVED_TEMPLATES;
  }
}

export async function GET() {
  const templates = ensureTemplatesFile();
  return NextResponse.json({ success: true, templates });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, template, id } = body;

    let templates = ensureTemplatesFile();

    if (action === 'save' && template && template.name) {
      const existingIdx = templates.findIndex((t) => t.id === template.id);
      if (existingIdx !== -1) {
        templates[existingIdx] = { ...template, updatedAt: new Date().toISOString() };
      } else {
        templates.unshift({
          ...template,
          id: template.id || `tpl_srv_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
      return NextResponse.json({ success: true, templates });
    }

    if (action === 'delete' && id) {
      templates = templates.filter((t) => t.id !== id);
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
      return NextResponse.json({ success: true, templates });
    }

    return NextResponse.json({ success: false, error: 'Invalid action or template payload' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to save template' }, { status: 500 });
  }
}
