'use client';

import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Hash,
  Layers,
  Info,
} from 'lucide-react';
import { MessageVariation, CsvParseResult, CsvRow } from '@/types/automation';
import {
  validateVariablesAgainstHeaders,
  renderMessageTemplate,
} from '@/lib/template-engine';

interface MessageBuilderSectionProps {
  parseResult: CsvParseResult | null;
  variations: MessageVariation[];
  onUpdateVariations: (updated: MessageVariation[]) => void;
  insertedVariableSignal?: { varName: string; timestamp: number } | null;
}

export function MessageBuilderSection({
  parseResult,
  variations,
  onUpdateVariations,
  insertedVariableSignal,
}: MessageBuilderSectionProps) {
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const csvHeaders = parseResult?.headers || [];
  const rows = parseResult?.rows || [];
  const currentVariation = variations[activeVariationIndex] || variations[0];

  const validation = validateVariablesAgainstHeaders(variations, csvHeaders);

  const handleTextareaChange = (val: string) => {
    const updated = [...variations];
    updated[activeVariationIndex] = {
      ...updated[activeVariationIndex],
      content: val,
    };
    onUpdateVariations(updated);
  };

  const handleAddVariation = () => {
    const nextNum = variations.length + 1;
    const newVar: MessageVariation = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title: `Variation ${nextNum}`,
      content: `Hello {{name}}, hope you are doing well!`,
    };
    const updated = [...variations, newVar];
    onUpdateVariations(updated);
    setActiveVariationIndex(updated.length - 1);
  };

  const handleDeleteVariation = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (variations.length <= 1) return;
    const updated = variations.filter((_, i) => i !== index);
    onUpdateVariations(updated);
    if (activeVariationIndex >= updated.length) {
      setActiveVariationIndex(updated.length - 1);
    }
  };

  const insertVariableAtCursor = (varName: string) => {
    const tag = `{{${varName}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      handleTextareaChange((currentVariation?.content || '') + ' ' + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = currentVariation?.content || '';
    const newText = currentText.substring(0, start) + tag + currentText.substring(end);

    handleTextareaChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  React.useEffect(() => {
    if (insertedVariableSignal?.varName) {
      insertVariableAtCursor(insertedVariableSignal.varName);
    }
  }, [insertedVariableSignal]);

  const currentPreviewRow: CsvRow | null = rows[previewRowIndex] || rows[0] || null;
  const renderedPreviewText = currentPreviewRow
    ? renderMessageTemplate(currentVariation?.content || '', currentPreviewRow)
    : 'Upload CSV data to view live recipient preview.';

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/15 border border-[#06b6d4]/35 flex items-center justify-center text-[#06b6d4] font-bold shadow-inner">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Step 3: Message Builder & Variations</span>
              <span className="px-2 py-0.5 rounded-full bg-[#06b6d4]/15 text-[#06b6d4] text-xs border border-[#06b6d4]/30 font-mono font-semibold">
                {variations.length} Variation(s) Configured
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Compose multiple message variations. Dynamic variables like &#123;&#123;name&#125;&#125; will be auto-interpolated per recipient.
            </p>
          </div>
        </div>

        <button
          onClick={handleAddVariation}
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand-gradient hover:opacity-90 text-white transition-all flex items-center gap-1.5 shadow-md font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Add Variation</span>
        </button>
      </div>

      {/* Variable Validation Warning / Success Alert */}
      {csvHeaders.length > 0 && (
        <div>
          {!validation.isValid ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Unmapped Dynamic Variables Detected:</span>
              </div>
              <p className="text-xs text-amber-300/90 pl-6">
                The following variable tag(s) are used in your message variations but do NOT exist in the CSV headers:{' '}
                {validation.missingVariables.map((v) => (
                  <span key={v} className="font-mono bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200 font-bold mx-1">
                    &#123;&#123;{v}&#125;&#125;
                  </span>
                ))}
              </p>
            </div>
          ) : validation.usedVariables.length > 0 ? (
            <div className="p-3.5 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
                <span>
                  All dynamic variables match CSV column headers cleanly! ({validation.validVariables.length} mapped variable tags)
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Variation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10 scrollbar-thin">
        {variations.map((varObj, idx) => {
          const isActive = idx === activeVariationIndex;
          return (
            <div
              key={varObj.id}
              onClick={() => setActiveVariationIndex(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-brand-gradient text-white border-[#ff8c5a]/50 shadow-md scale-[1.02]'
                  : 'bg-[#081419] text-white/60 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{varObj.title}</span>
              {variations.length > 1 && (
                <button
                  onClick={(e) => handleDeleteVariation(idx, e)}
                  className="p-0.5 rounded hover:bg-rose-500/30 text-white/50 hover:text-white transition-colors"
                  title="Remove variation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Editor & Live Preview 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Textarea & Variable Inserter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Compose Message Content ({currentVariation?.title}):</span>
            </label>
            <span className="text-[11px] text-white/50 font-mono">
              {currentVariation?.content.length || 0} characters
            </span>
          </div>

          <textarea
            ref={textareaRef}
            value={currentVariation?.content || ''}
            onChange={(e) => handleTextareaChange(e.target.value)}
            rows={7}
            placeholder="Type your message here... Use {{name}}, {{result}}, {{phone}} to insert dynamic variables."
            className="w-full bg-[#081419] border border-white/10 rounded-xl p-4 text-xs font-sans text-white placeholder-white/30 focus:outline-none focus:border-[#f05a28] leading-relaxed shadow-inner"
          />

          {/* Quick Insert Variable Pills */}
          {csvHeaders.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-white/60 font-medium flex items-center gap-1">
                <Hash className="w-3 h-3 text-[#ff8c5a]" />
                Click to insert dynamic variable tag into message:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {csvHeaders.map((header) => (
                  <button
                    key={header}
                    type="button"
                    onClick={() => insertVariableAtCursor(header)}
                    className="px-2.5 py-1 rounded-lg bg-[#f05a28]/15 hover:bg-[#f05a28]/25 border border-[#f05a28]/35 text-[#ff8c5a] text-xs font-mono transition-all hover:scale-105"
                  >
                    + &#123;&#123;{header}&#125;&#125;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[#081419] border border-white/10 text-[11px] text-white/50 flex items-center gap-2">
              <Info className="w-4 h-4 text-white/40 shrink-0" />
              <span>Upload a CSV file in Step 1 to auto-detect variable tags like &#123;&#123;name&#125;&#125;.</span>
            </div>
          )}
        </div>

        {/* Right Column: Live Recipient Message Preview */}
        <div className="space-y-3 bg-[#081419] p-4 rounded-xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Eye className="w-4 h-4 text-[#06b6d4]" />
                <span>Live Recipient Message Preview</span>
              </div>

              {rows.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-white/50">
                    Row {previewRowIndex + 1} of {rows.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewRowIndex((prev) => Math.max(0, prev - 1))}
                      disabled={previewRowIndex === 0}
                      className="p-1 rounded bg-[#0d2530] hover:bg-white/10 disabled:opacity-30 text-white"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setPreviewRowIndex((prev) => Math.min(rows.length - 1, prev + 1))
                      }
                      disabled={previewRowIndex >= rows.length - 1}
                      className="p-1 rounded bg-[#0d2530] hover:bg-white/10 disabled:opacity-30 text-white"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Details Badge */}
            {currentPreviewRow && (
              <div className="mb-3 p-2.5 rounded-lg bg-[#0d2530] border border-white/10 text-xs font-mono flex items-center justify-between text-slate-200">
                <span className="text-white/50">Target Recipient:</span>
                <span className="text-[#10b981] font-bold">
                  {currentPreviewRow[parseResult?.recipientColumn || 'phone'] ||
                    currentPreviewRow.name ||
                    currentPreviewRow.__id}
                </span>
              </div>
            )}

            {/* Simulated Chat Bubble */}
            <div className="relative p-4 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/30 text-slate-100 text-xs leading-relaxed space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-[10px] text-[#10b981] font-mono border-b border-[#10b981]/20 pb-1.5">
                <span className="font-semibold">{currentVariation?.title}</span>
                <span>Rendered Message</span>
              </div>
              <p className="whitespace-pre-wrap font-sans">{renderedPreviewText}</p>
            </div>
          </div>

          <p className="text-[11px] text-white/40 italic mt-3">
            Note: During execution, each recipient receives exactly 1 randomly selected variation from your configured list.
          </p>
        </div>
      </div>
    </div>
  );
}
