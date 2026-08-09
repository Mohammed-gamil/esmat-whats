'use client';

import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Sparkles,
  Trash2,
  Save,
  Check,
  ArrowRight,
} from 'lucide-react';
import { SavedTemplate, MessageVariation } from '@/types/automation';
import {
  getSavedTemplates,
  fetchServerTemplates,
  saveTemplate,
  deleteTemplate,
  findCompatibleTemplates,
  TemplateCompatibility,
} from '@/lib/template-store';

interface SavedTemplatesSectionProps {
  csvHeaders: string[];
  onApplyTemplate: (template: SavedTemplate) => void;
  currentVariations: MessageVariation[];
}

export function SavedTemplatesSection({
  csvHeaders,
  onApplyTemplate,
  currentVariations,
}: SavedTemplatesSectionProps) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [compatibilities, setCompatibilities] = useState<TemplateCompatibility[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [justAppliedId, setJustAppliedId] = useState<string | null>(null);

  const loadTemplates = async () => {
    const list = await fetchServerTemplates();
    setTemplates(list);
    const comps = findCompatibleTemplates(csvHeaders, list);
    setCompatibilities(comps);
  };

  useEffect(() => {
    loadTemplates();
  }, [csvHeaders]);

  const handleSaveCurrentBuilder = () => {
    if (!newTemplateName.trim()) return;
    saveTemplate(newTemplateName.trim(), currentVariations, newTemplateDesc.trim());
    setNewTemplateName('');
    setNewTemplateDesc('');
    setIsSaveModalOpen(false);
    loadTemplates();
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(id);
      loadTemplates();
    }
  };

  const handleApply = (tpl: SavedTemplate) => {
    onApplyTemplate(tpl);
    setJustAppliedId(tpl.id);
    setTimeout(() => setJustAppliedId(null), 2000);
  };

  const compatibleCount = compatibilities.filter((c) => c.isCompatible).length;

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/35 flex items-center justify-center text-[#ff8c5a] font-bold shadow-inner">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Step 2: Saved Templates & Matching Engine</span>
              {csvHeaders.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-mono border ${
                    compatibleCount > 0
                      ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 font-semibold'
                      : 'bg-[#0d2530] text-white/50 border-white/10'
                  }`}
                >
                  {compatibleCount} Compatible Found
                </span>
              )}
            </h2>
            <p className="text-xs text-white/50">
              Save template presets and auto-match templates compatible with your CSV schema headers.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSaveModalOpen(true)}
          disabled={currentVariations.every((v) => !v.content.trim())}
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#f05a28]/15 hover:bg-[#f05a28]/25 border border-[#f05a28]/35 text-[#ff8c5a] disabled:opacity-40 transition-all flex items-center gap-2"
        >
          <Save className="w-4 h-4 text-[#ff8c5a]" />
          <span>Save Current Builder as Template</span>
        </button>
      </div>

      {/* Compatible Templates List */}
      <div className="space-y-3">
        {csvHeaders.length > 0 && compatibleCount > 0 && (
          <div className="p-3.5 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center gap-2 text-xs text-[#10b981] font-medium">
            <Sparkles className="w-4 h-4 text-[#10b981] shrink-0" />
            <span>
              {compatibleCount} saved template(s) match 100% of your uploaded CSV dynamic variables!
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {compatibilities.map(({ template, isCompatible, missingVariables, compatibilityPercentage }) => {
            const isJustApplied = justAppliedId === template.id;
            return (
              <div
                key={template.id}
                onClick={() => isCompatible && handleApply(template)}
                className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isCompatible
                    ? 'bg-[#0d2530] hover:bg-[#0d2530]/90 border-[#10b981]/40 hover:border-[#10b981]/70 shadow-lg'
                    : 'bg-[#081419]/60 border-white/10 opacity-75 hover:opacity-100'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-[#ff8c5a] transition-colors line-clamp-1">
                      {template.name}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCompatible ? (
                        <span className="px-2 py-0.5 rounded-md bg-[#10b981]/20 text-[#10b981] text-[10px] font-mono font-semibold border border-[#10b981]/40">
                          100% Match
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-[#081419] text-white/50 text-[10px] font-mono border border-white/10">
                          {compatibilityPercentage}% Match
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className="p-1 rounded text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-xs text-white/50 mt-1 line-clamp-2">{template.description}</p>
                  )}

                  {/* Required variables tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.requiredVariables.map((v) => {
                      const isPresent = csvHeaders.some((h) => h.toLowerCase() === v.toLowerCase());
                      return (
                        <span
                          key={v}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                            isPresent
                              ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          &#123;&#123;{v}&#125;&#125;
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-white/50 font-mono">
                    {template.variations.length} Variation(s)
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApply(template);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      isJustApplied
                        ? 'bg-[#10b981] text-[#081419] font-bold'
                        : isCompatible
                        ? 'bg-brand-gradient hover:opacity-90 text-white shadow-md'
                        : 'bg-[#081419] hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isJustApplied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Applied!</span>
                      </>
                    ) : (
                      <>
                        <span>Apply Template</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d2530] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-[#ff8c5a]" />
              <span>Save Message Template</span>
            </h3>

            <p className="text-xs text-white/60">
              Save your current {currentVariations.length} message variation(s) for quick reuse on compatible CSV files.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Monthly Exam Results Broadcast"
                  className="w-full bg-[#081419] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#f05a28]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1">
                  Optional Description
                </label>
                <textarea
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="e.g., Requires name, result, and course columns"
                  rows={3}
                  className="w-full bg-[#081419] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#f05a28]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-white/50 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentBuilder}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-brand-gradient hover:opacity-90 text-white font-bold disabled:opacity-50 transition-all shadow-md"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
