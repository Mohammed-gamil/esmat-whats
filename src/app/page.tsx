'use client';

import React, { useState } from 'react';
import { CsvAutomationAgent } from '@/components/CsvAutomationAgent';
import { OpenWaSessionsView } from '@/components/OpenWaSessionsView';
import { ShieldCheck, Zap, Sliders, Layers, FileSpreadsheet } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'automation' | 'sessions'>('automation');

  return (
    <main className="min-h-screen text-white p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* App Header adhering to COLOR_SYSTEM.md Brand (#f05a28) & Surface (#0a191e / #0d2530) tokens */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold shadow-brand-glow ring-1 ring-[#ff8c5a]/40">
            <Zap className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>WhatsApp Automation Platform</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f05a28]/15 text-[#ff8c5a] text-xs border border-[#f05a28]/35 font-mono font-semibold">
                v1.0 Automation Agent
              </span>
            </h1>
            <p className="text-xs text-white/60 mt-0.5">
              CSV & Excel Dynamic Variable Bulk Automation & WhatsApp Gateway Sessions Management
            </p>
          </div>
        </div>

        {/* Navigation Tabs Header Switcher */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[#081419] border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('automation')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'automation'
                ? 'bg-brand-gradient text-white shadow-md font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV & Excel Automation Agent</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sessions'
                ? 'bg-brand-gradient text-white shadow-md font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>WhatsApp Gateway Sessions</span>
          </button>
        </div>
      </header>

      {/* Tab Content Rendering */}
      {activeTab === 'automation' ? (
        <CsvAutomationAgent />
      ) : (
        <OpenWaSessionsView />
      )}
    </main>
  );
}
