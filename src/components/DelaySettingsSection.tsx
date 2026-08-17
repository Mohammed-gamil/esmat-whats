'use client';

import React, { useState } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  Lock,
  Layers,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { DelaySettings, MessageVariation } from '@/types/automation';
import { validateAndSanitizeDelay } from '@/lib/automation-engine';

interface DelaySettingsSectionProps {
  delaySettings: DelaySettings;
  onUpdateDelay: (updated: DelaySettings) => void;
  variations: MessageVariation[];
  totalRecipients: number;
}

const PRESET_OPTIONS = [
  { label: '10s', seconds: 10, category: 'Fast', icon: '⚡' },
  { label: '20s', seconds: 20, category: 'Fast', icon: '⚡' },
  { label: '30s', seconds: 30, category: 'Recommended', icon: '✨' },
  { label: '45s', seconds: 45, category: 'Balanced', icon: '⏱️' },
  { label: '1 Min (60s)', seconds: 60, category: 'Safe', icon: '🛡️' },
  { label: '2 Mins', seconds: 120, category: 'Safe', icon: '🛡️' },
  { label: '5 Mins', seconds: 300, category: 'Ultra-Safe', icon: '🔒' },
];

export function DelaySettingsSection({
  delaySettings,
  onUpdateDelay,
  variations,
  totalRecipients,
}: DelaySettingsSectionProps) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Derive active delay in seconds
  const currentSeconds =
    delaySettings.delaySeconds ||
    (delaySettings.delayMinutes ? Math.round(delaySettings.delayMinutes * 60) : 30);

  const handleSecondsChange = (val: number) => {
    const check = validateAndSanitizeDelay(val);
    if (!check.isValid && check.warning) {
      setWarningMessage(check.warning);
    } else {
      setWarningMessage(null);
    }
    onUpdateDelay({
      delaySeconds: check.sanitizedSeconds,
      delayMinutes: check.sanitizedMinutes,
      customSeconds: check.totalSeconds,
    });
  };

  const handlePresetClick = (seconds: number) => {
    handleSecondsChange(seconds);
  };

  // Format seconds to human-readable string (e.g. "30s", "1m 30s", "2m")
  const formatDurationDisplay = (totalSecs: number) => {
    if (totalSecs < 60) {
      return `${totalSecs} sec(s)`;
    }
    const mins = Math.floor(totalSecs / 60);
    const remainingSecs = totalSecs % 60;
    if (remainingSecs === 0) {
      return `${mins} min(s)`;
    }
    return `${mins}m ${remainingSecs}s`;
  };

  const estimatedTotalSec = totalRecipients * currentSeconds;
  const estimatedDisplay = formatDurationDisplay(estimatedTotalSec);

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
              <span>Step 4: Delay Control & Pacing Options</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f05a28]/15 text-[#ff8c5a] text-xs border border-[#f05a28]/35 font-mono font-semibold">
                {formatDurationDisplay(currentSeconds)} Delay Active
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Set consistent timing between each recipient message (e.g. 10s, 20s, 30s, or custom seconds).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-[#10b981] shrink-0" />
          <span>Anti-Spam Pacing Guard Active</span>
        </div>
      </div>

      {/* Delay Settings Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Presets & Custom Seconds Input */}
        <div className="space-y-4">
          {/* Quick Preset Delay Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#ff8c5a]" />
                <span>Pacing Delay Presets:</span>
              </span>
              <span className="text-[11px] font-mono text-[#ff8c5a] font-bold">
                Selected: {currentSeconds}s ({formatDurationDisplay(currentSeconds)})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_OPTIONS.map((preset) => {
                const isSelected = currentSeconds === preset.seconds;
                return (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => handlePresetClick(preset.seconds)}
                    className={`p-2.5 rounded-xl text-xs font-mono transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-brand-gradient text-white border-[#ff8c5a] shadow-lg shadow-[#f05a28]/20 font-bold scale-[1.02]'
                        : 'bg-[#081419] hover:bg-[#0d2530] text-slate-200 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{preset.icon}</span>
                      <span className="font-bold">{preset.label}</span>
                    </div>
                    <span
                      className={`text-[9px] uppercase tracking-wider ${
                        isSelected ? 'text-white/80' : 'text-white/40'
                      }`}
                    >
                      {preset.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Seconds Input */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Custom Delay Duration:</span>
              <span className="text-[11px] text-white/50">Minimum 5 seconds</span>
            </label>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="number"
                  min={5}
                  max={3600}
                  step={5}
                  value={currentSeconds}
                  onChange={(e) => handleSecondsChange(parseInt(e.target.value) || 5)}
                  className="w-36 bg-[#081419] border border-white/10 rounded-xl p-3 text-sm font-bold font-mono text-white text-center focus:outline-none focus:border-[#f05a28] shadow-inner"
                />
                <span className="absolute right-3 top-3 text-xs text-white/40 font-mono pointer-events-none">
                  sec
                </span>
              </div>
              <span className="text-xs text-white/50">
                = {formatDurationDisplay(currentSeconds)} inter-message delay
              </span>
            </div>
          </div>

          {/* Warning notice if user typed < 5 sec */}
          {warningMessage && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{warningMessage}</span>
            </div>
          )}
        </div>

        {/* Right: Automation Queue Summary & Duration Calculation */}
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
                <span className="text-white/50">Inter-Message Pacing Delay:</span>
                <span className="font-mono text-[#ff8c5a] font-bold">
                  {currentSeconds}s ({formatDurationDisplay(currentSeconds)})
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Estimated Total Batch Duration:</span>
                <span className="font-mono text-[#10b981] font-bold">
                  ~{estimatedDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Guarantee Badge */}
          <div className="p-3 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] text-xs flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#10b981] shrink-0" />
            <div>
              <span className="font-bold block text-white">Consistent Timing Guarantee:</span>
              <span className="text-[11px] text-[#10b981]/90">
                Every message is dispatched with a steady, unaccumulated {currentSeconds}s countdown. Each contact receives exactly 1 variation.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
