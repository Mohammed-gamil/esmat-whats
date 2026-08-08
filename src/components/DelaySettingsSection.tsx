'use client';

import React, { useState } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  Lock,
  Layers,
} from 'lucide-react';
import { DelaySettings, MessageVariation } from '@/types/automation';
import { validateAndSanitizeDelay } from '@/lib/automation-engine';

interface DelaySettingsSectionProps {
  delaySettings: DelaySettings;
  onUpdateDelay: (updated: DelaySettings) => void;
  variations: MessageVariation[];
  totalRecipients: number;
}

export function DelaySettingsSection({
  delaySettings,
  onUpdateDelay,
  variations,
  totalRecipients,
}: DelaySettingsSectionProps) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const handleMinutesChange = (val: number) => {
    const check = validateAndSanitizeDelay(val);
    if (!check.isValid && check.warning) {
      setWarningMessage(check.warning);
    } else {
      setWarningMessage(null);
    }
    onUpdateDelay({
      delayMinutes: check.sanitizedMinutes,
      customSeconds: check.totalSeconds,
    });
  };

  const handlePresetClick = (minutes: number) => {
    handleMinutesChange(minutes);
  };

  const totalSeconds = delaySettings.delayMinutes * 60;
  const estimatedTotalMinutes = Math.round(totalRecipients * delaySettings.delayMinutes);

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/35 flex items-center justify-center text-[#ff8c5a] font-bold shadow-inner">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Step 4: Delay Control & Safety Pacing</span>
              <span className="px-2 py-0.5 rounded-full bg-[#f05a28]/15 text-[#ff8c5a] text-xs border border-[#f05a28]/35 font-mono font-semibold">
                Min 1 Minute Enforced
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Configure pacing delay between outbound messages. Minimum delay rule enforces at least 60 seconds (1 minute).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-[#10b981] shrink-0" />
          <span>Anti-Spam Delay Protection Active</span>
        </div>
      </div>

      {/* Delay Settings Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Input & Presets */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#ff8c5a]" />
                Inter-Message Delay (Minutes):
              </span>
              <span className="text-xs font-mono text-[#ff8c5a] font-bold">
                {delaySettings.delayMinutes} min ({totalSeconds}s)
              </span>
            </label>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                step={1}
                value={delaySettings.delayMinutes}
                onChange={(e) => handleMinutesChange(parseFloat(e.target.value) || 1)}
                className="w-32 bg-[#081419] border border-white/10 rounded-xl p-3 text-sm font-bold font-mono text-white text-center focus:outline-none focus:border-[#f05a28] shadow-inner"
              />
              <span className="text-xs text-white/50">minute(s) between each recipient message</span>
            </div>
          </div>

          {/* Warning notice if user typed < 1 min */}
          {warningMessage && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{warningMessage}</span>
            </div>
          )}

          {/* Quick Preset Delay Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-white/50 font-medium">Select Delay Preset:</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 5, 10, 15, 30].map((mins) => {
                const isSelected = delaySettings.delayMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handlePresetClick(mins)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                      isSelected
                        ? 'bg-brand-gradient text-white border-[#ff8c5a]/50 shadow-md font-bold'
                        : 'bg-[#081419] hover:bg-[#0d2530] text-slate-200 border-white/10'
                    }`}
                  >
                    {mins} Min{mins > 1 ? 's' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Automation Queue Summary & Duplicate Guarantee */}
        <div className="space-y-3 bg-[#081419] p-4 rounded-xl border border-white/10 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#06b6d4]" />
                <span>Execution Distribution Summary</span>
              </span>
              <span className="text-[11px] text-white/50 font-mono">
                {totalRecipients} Recipient(s)
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Total Variations:</span>
                <span className="font-mono text-[#06b6d4] font-bold">{variations.length}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Configured Pacing Delay:</span>
                <span className="font-mono text-[#ff8c5a] font-bold">
                  {delaySettings.delayMinutes} min / message
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Estimated Total Batch Duration:</span>
                <span className="font-mono text-[#10b981] font-bold">
                  ~{estimatedTotalMinutes} min(s)
                </span>
              </div>
            </div>
          </div>

          {/* Guarantee Badge */}
          <div className="p-3 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] text-xs flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#10b981] shrink-0" />
            <div>
              <span className="font-bold block text-white">Zero Multi-Message Guarantee:</span>
              <span className="text-[11px] text-[#10b981]/90">
                Each recipient in your CSV receives exactly 1 message selected randomly from your variations. No duplicate deliveries.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
