'use client';

import React, { useState } from 'react';
import {
  Zap,
  Smartphone,
  FileSpreadsheet,
  Send,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Users,
  Code2,
  Layers,
  Clock,
  LayoutList,
  Compass,
  ArrowRight,
  ShieldCheck,
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
import { OpenWaSessionsView } from './OpenWaSessionsView';
import { parseCsv, SAMPLE_CSV_DATASETS } from '@/lib/csv-parser';

export type JourneyStep = 1 | 2 | 3;
export type ViewMode = 'guided' | 'full';

export function JourneyPlatform() {
  const [activeStep, setActiveStep] = useState<JourneyStep>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('guided');

  // Shared automation state
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

  const stepsInfo = [
    {
      id: 1 as JourneyStep,
      number: '01',
      title: 'Gateway Session',
      subtitle: 'WhatsApp Link & QR',
      icon: Smartphone,
      badge: 'Step 1',
    },
    {
      id: 2 as JourneyStep,
      number: '02',
      title: 'Upload Data & Tags',
      subtitle: 'CSV / Excel & Variables',
      icon: FileSpreadsheet,
      badge: 'Step 2',
    },
    {
      id: 3 as JourneyStep,
      number: '03',
      title: 'Compose & Execute',
      subtitle: 'Variations, Pacing & Run',
      icon: Send,
      badge: 'Step 3',
    },
  ];

  return (
    <div className="min-h-screen text-white p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Platform App Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold shadow-brand-glow ring-1 ring-[#ff8c5a]/40">
            <Zap className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>WhatsApp Automation Journey</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f05a28]/15 text-[#ff8c5a] text-xs border border-[#f05a28]/35 font-mono font-semibold">
                3-Part Sequential Flow
              </span>
            </h1>
            <p className="text-xs text-white/60 mt-0.5">
              Guided 3-Stage Journey: Session Connection → CSV Upload → Automated Batch Campaign
            </p>
          </div>
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#081419] border border-white/10">
          <button
            type="button"
            onClick={() => setViewMode('guided')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'guided'
                ? 'bg-brand-gradient text-white shadow-md font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Guided Step Journey</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('full')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'full'
                ? 'bg-brand-gradient text-white shadow-md font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span>All-in-One View</span>
          </button>
        </div>
      </header>

      {/* 3-Part Journey Stepper Navigation Bar */}
      <nav aria-label="Journey Progress" className="glass-panel rounded-2xl p-4 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative">
          {stepsInfo.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const isCompleted = activeStep > step.id;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`relative flex items-center gap-3.5 p-3.5 rounded-xl transition-all border text-left cursor-pointer group ${
                  isActive
                    ? 'bg-[#0d2530] border-[#f05a28] shadow-brand-glow ring-1 ring-[#f05a28]/40'
                    : isCompleted
                    ? 'bg-[#0d2530]/60 border-[#10b981]/40 hover:border-[#10b981]'
                    : 'bg-[#081419]/50 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Step Icon Badge */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-all ${
                    isActive
                      ? 'bg-brand-gradient text-white shadow-md'
                      : isCompleted
                      ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>

                {/* Step Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isActive
                          ? 'text-[#ff8c5a]'
                          : isCompleted
                          ? 'text-[#10b981]'
                          : 'text-white/40'
                      }`}
                    >
                      Part {step.number}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f05a28] animate-ping" />
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-white truncate">{step.title}</h3>
                  <p className="text-[11px] text-white/50 truncate">{step.subtitle}</p>
                </div>

                {/* Arrow Connector indicator for desktop */}
                {idx < 2 && (
                  <ChevronRight className="hidden md:block w-4 h-4 text-white/20 absolute -right-2 top-1/2 -translate-y-1/2 z-10" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Guided View Mode Content */}
      {viewMode === 'guided' ? (
        <div className="space-y-6">
          {/* STEP 1: WhatsApp Gateway Sessions */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-4 rounded-2xl glass-panel border border-[#f05a28]/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/30 flex items-center justify-center text-[#ff8c5a]">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Part 1: WhatsApp Gateway Session Link</h2>
                    <p className="text-xs text-white/60">
                      Link your WhatsApp phone line using QR Code scan or 8-digit Pairing Code.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 rounded-xl bg-brand-gradient hover:opacity-90 text-xs font-bold text-white flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105"
                >
                  <span>Proceed to Part 2: Upload CSV</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <OpenWaSessionsView />

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-brand-gradient hover:opacity-90 text-xs font-bold text-white flex items-center gap-2 shadow-lg cursor-pointer transition-all hover:scale-105"
                >
                  <span>Proceed to Part 2: Upload Recipient Data</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CSV Data & Dynamic Variables */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-4 rounded-2xl glass-panel border border-[#06b6d4]/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#06b6d4]/15 border border-[#06b6d4]/30 flex items-center justify-center text-[#06b6d4]">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Part 2: Upload CSV / Excel Recipient Data</h2>
                    <p className="text-xs text-white/60">
                      Select phone column, verify dynamic tags, and pair message templates.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="px-3.5 py-2 rounded-xl bg-[#081419] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Part 1</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="px-4 py-2 rounded-xl bg-brand-gradient hover:opacity-90 text-xs font-bold text-white flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105"
                  >
                    <span>Proceed to Part 3: Compose & Run</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Metrics Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl glass-panel flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider block">
                      Recipients
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                      {activeRecipientsCount}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl glass-panel flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider block">
                      Dynamic Tags
                    </span>
                    <span className="text-xl font-bold font-mono text-[#ff8c5a] mt-0.5 block">
                      {detectedHeadersCount} Tags
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/30 flex items-center justify-center text-[#ff8c5a]">
                    <Code2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl glass-panel flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider block">
                      Variations
                    </span>
                    <span className="text-xl font-bold font-mono text-[#06b6d4] mt-0.5 block">
                      {variations.length}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/15 border border-[#06b6d4]/30 flex items-center justify-center text-[#06b6d4]">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>

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

              {/* CSV Uploader */}
              <CsvUploader
                parseResult={parseResult}
                onCsvParsed={setParseResult}
                onVariableClick={handleVariableClick}
                onSelectRecipientColumn={handleSelectRecipientColumn}
              />

              {/* Saved Templates */}
              <SavedTemplatesSection
                csvHeaders={parseResult?.headers || []}
                onApplyTemplate={handleApplyTemplate}
                currentVariations={variations}
              />

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-[#081419] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Part 1: Gateway Session</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-5 py-2.5 rounded-xl bg-brand-gradient hover:opacity-90 text-xs font-bold text-white flex items-center gap-2 shadow-lg cursor-pointer transition-all hover:scale-105"
                >
                  <span>Proceed to Part 3: Compose & Run</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Message Builder, Delay Control & Execution Monitor */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-4 rounded-2xl glass-panel border border-[#10b981]/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Part 3: Compose Message & Execute Campaign</h2>
                    <p className="text-xs text-white/60">
                      Draft variation templates, set anti-ban inter-message pacing, and start live batch delivery.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-3.5 py-2 rounded-xl bg-[#081419] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Part 2: CSV Data</span>
                </button>
              </div>

              {/* Message Builder Section */}
              <MessageBuilderSection
                parseResult={parseResult}
                variations={variations}
                onUpdateVariations={setVariations}
                insertedVariableSignal={insertedVarSignal}
              />

              {/* Delay Control Settings */}
              <DelaySettingsSection
                delaySettings={delaySettings}
                onUpdateDelay={setDelaySettings}
                variations={variations}
                totalRecipients={activeRecipientsCount}
              />

              {/* Automation Monitor */}
              <AutomationMonitorSection
                parseResult={parseResult}
                variations={variations}
                delaySettings={delaySettings}
              />
            </div>
          )}
        </div>
      ) : (
        /* Full All-in-One Sequential View */
        <div className="space-y-10 animate-in fade-in duration-200">
          {/* SECTION 1: Gateway Session */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0d2530] border border-[#f05a28]/40 text-xs font-bold text-white">
              <span className="w-6 h-6 rounded-lg bg-brand-gradient flex items-center justify-center text-white font-mono text-[11px]">
                01
              </span>
              <Smartphone className="w-4 h-4 text-[#ff8c5a]" />
              <span>Part 1: WhatsApp Gateway Sessions & QR Authentication</span>
            </div>
            <OpenWaSessionsView />
          </section>

          {/* SECTION 2: CSV Data & Variables */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0d2530] border border-[#06b6d4]/40 text-xs font-bold text-white">
              <span className="w-6 h-6 rounded-lg bg-[#06b6d4] flex items-center justify-center text-white font-mono text-[11px]">
                02
              </span>
              <FileSpreadsheet className="w-4 h-4 text-[#06b6d4]" />
              <span>Part 2: Upload Recipient CSV/Excel Data & Dynamic Variables</span>
            </div>

            <CsvUploader
              parseResult={parseResult}
              onCsvParsed={setParseResult}
              onVariableClick={handleVariableClick}
              onSelectRecipientColumn={handleSelectRecipientColumn}
            />

            <SavedTemplatesSection
              csvHeaders={parseResult?.headers || []}
              onApplyTemplate={handleApplyTemplate}
              currentVariations={variations}
            />
          </section>

          {/* SECTION 3: Message Builder, Delay & Execution Monitor */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0d2530] border border-[#10b981]/40 text-xs font-bold text-white">
              <span className="w-6 h-6 rounded-lg bg-[#10b981] flex items-center justify-center text-white font-mono text-[11px]">
                03
              </span>
              <Send className="w-4 h-4 text-[#10b981]" />
              <span>Part 3: Compose Message Variations, Anti-Ban Pacing & Live Monitor</span>
            </div>

            <MessageBuilderSection
              parseResult={parseResult}
              variations={variations}
              onUpdateVariations={setVariations}
              insertedVariableSignal={insertedVarSignal}
            />

            <DelaySettingsSection
              delaySettings={delaySettings}
              onUpdateDelay={setDelaySettings}
              variations={variations}
              totalRecipients={activeRecipientsCount}
            />

            <AutomationMonitorSection
              parseResult={parseResult}
              variations={variations}
              delaySettings={delaySettings}
            />
          </section>
        </div>
      )}
    </div>
  );
}
