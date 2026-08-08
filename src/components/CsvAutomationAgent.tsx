'use client';

import React, { useState } from 'react';
import {
  Clock,
  Layers,
  Users,
  Code2,
} from 'lucide-react';
import {
  CsvParseResult,
  DelaySettings,
  MessageVariation,
  SavedTemplate,
} from '@/types/automation';
import { CsvUploader } from './CsvUploader';
import { SavedTemplatesSection } from './SavedTemplatesSection';
import { MessageBuilderSection } from './MessageBuilderSection';
import { DelaySettingsSection } from './DelaySettingsSection';
import { AutomationMonitorSection } from './AutomationMonitorSection';
import { parseCsv, SAMPLE_CSV_DATASETS } from '@/lib/csv-parser';

export function CsvAutomationAgent() {
  const defaultSample = SAMPLE_CSV_DATASETS[0];
  const initialParse = parseCsv(defaultSample.csv, `${defaultSample.id}.csv`);

  const [parseResult, setParseResult] = useState<CsvParseResult | null>(initialParse);

  const [variations, setVariations] = useState<MessageVariation[]>([
    {
      id: 'var_default_1',
      title: 'Variation 1 (Friendly & Direct)',
      content:
        'Hello {{name}}, your final exam result for {{course}} is now published: {{result}} (Grade: {{grade}}). Congratulations!',
    },
    {
      id: 'var_default_2',
      title: 'Variation 2 (Formal Announcement)',
      content:
        'Dear {{name}}, this is an official academic update regarding your {{course}} assessment. Status: {{result}} with Grade {{grade}}.',
    },
  ]);

  const [delaySettings, setDelaySettings] = useState<DelaySettings>({
    delayMinutes: 1,
    customSeconds: 60,
  });

  const [insertedVarSignal, setInsertedVarSignal] = useState<{
    varName: string;
    timestamp: number;
  } | null>(null);

  const handleVariableClick = (varName: string) => {
    setInsertedVarSignal({
      varName,
      timestamp: Date.now(),
    });
  };

  const handleSelectRecipientColumn = (column: string) => {
    if (parseResult) {
      setParseResult({
        ...parseResult,
        recipientColumn: column,
      });
    }
  };

  const handleApplyTemplate = (template: SavedTemplate) => {
    setVariations(template.variations);
  };

  const activeRecipientsCount = parseResult?.validRowsCount || 0;
  const detectedHeadersCount = parseResult?.headers.length || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Stats Metric Cards using COLOR_SYSTEM.md tokens */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Recipients (Emerald Status Accent #10b981) */}
        <div className="p-4 rounded-2xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider block">
              Recipients Detected
            </span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">
              {activeRecipientsCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Mapped Variables (Brand Orange #f05a28) */}
        <div className="p-4 rounded-2xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider block">
              Dynamic Variables
            </span>
            <span className="text-xl font-bold font-mono text-[#ff8c5a] mt-0.5 block">
              {detectedHeadersCount} Tags
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/30 flex items-center justify-center text-[#ff8c5a]">
            <Code2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Variations (Cyan Accent #06b6d4) */}
        <div className="p-4 rounded-2xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider block">
              Message Variations
            </span>
            <span className="text-xl font-bold font-mono text-[#06b6d4] mt-0.5 block">
              {variations.length} Variation(s)
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/15 border border-[#06b6d4]/30 flex items-center justify-center text-[#06b6d4]">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Delay Setting (Brand Accent) */}
        <div className="p-4 rounded-2xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider block">
              Pacing Delay
            </span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">
              {delaySettings.delayMinutes} Min(s)
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/30 flex items-center justify-center text-[#ff8c5a]">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Step 1: CSV File Upload & Dynamic Variables */}
      <section id="step-csv-upload">
        <CsvUploader
          parseResult={parseResult}
          onCsvParsed={setParseResult}
          onVariableClick={handleVariableClick}
          onSelectRecipientColumn={handleSelectRecipientColumn}
        />
      </section>

      {/* Step 2: Saved Templates & Compatibility Matching */}
      <section id="step-saved-templates">
        <SavedTemplatesSection
          csvHeaders={parseResult?.headers || []}
          onApplyTemplate={handleApplyTemplate}
          currentVariations={variations}
        />
      </section>

      {/* Step 3: Message Builder & Variations */}
      <section id="step-message-builder">
        <MessageBuilderSection
          parseResult={parseResult}
          variations={variations}
          onUpdateVariations={setVariations}
          insertedVariableSignal={insertedVarSignal}
        />
      </section>

      {/* Step 4: Delay Control Settings */}
      <section id="step-delay-control">
        <DelaySettingsSection
          delaySettings={delaySettings}
          onUpdateDelay={setDelaySettings}
          variations={variations}
          totalRecipients={activeRecipientsCount}
        />
      </section>

      {/* Step 5: Deterministic Execution & Live Batch Monitor */}
      <section id="step-automation-monitor">
        <AutomationMonitorSection
          parseResult={parseResult}
          variations={variations}
          delaySettings={delaySettings}
        />
      </section>
    </div>
  );
}
