'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Link,
  FolderPlus,
  RefreshCw,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { OpenWaSessionDto } from '@/types/openwa-session';
import { GroupNumbersExtractor } from '../GroupNumbersExtractor';
import { AutoGroupJoiner } from './AutoGroupJoiner';
import { BulkMemberAdder } from './BulkMemberAdder';
import { BulkGroupGenerator } from './BulkGroupGenerator';

interface GroupSuiteManagerProps {
  onImportToAutomation?: () => void;
}

export function GroupSuiteManager({ onImportToAutomation }: GroupSuiteManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'extractor' | 'joiner' | 'adder' | 'generator'>('extractor');
  const [sessions, setSessions] = useState<OpenWaSessionDto[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);

  // Fetch connected sessions
  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        const readySession = data.sessions.find((s: OpenWaSessionDto) => {
          const st = (s.status || '').toLowerCase();
          return st === 'ready' || st === 'working' || st === 'connected' || st === 'authenticated';
        });
        if (readySession) {
          setSelectedSessionId(readySession.id);
        } else if (data.sessions.length > 0) {
          setSelectedSessionId(data.sessions[0].id);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Sub-Navigation Header Bar for the 4 Group Features */}
      <div className="glass-panel rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold shadow-brand-glow">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>OpenWA WhatsApp Group Feature Suite</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs border border-emerald-500/30 font-mono font-semibold">
                4-in-1 Toolkit
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Extract group members, auto-join invite links, bulk-add participants, and generate populated groups
            </p>
          </div>
        </div>

        {/* Global Active Session Selector & Sub-Tab Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Session Picker */}
          <div className="flex items-center gap-2 bg-[#081419] border border-white/10 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-white/50 font-mono">Session:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              disabled={loadingSessions}
              className="bg-transparent text-white text-xs font-mono font-bold focus:outline-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#081419] text-white">
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Tab Selector Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#081419] border border-white/10">
            <button
              onClick={() => setActiveSubTab('extractor')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'extractor'
                  ? 'bg-brand-gradient text-white shadow-md font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>1. Group Extractor</span>
            </button>

            <button
              onClick={() => setActiveSubTab('joiner')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'joiner'
                  ? 'bg-brand-gradient text-white shadow-md font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>2. Auto Group Joiner</span>
            </button>

            <button
              onClick={() => setActiveSubTab('adder')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'adder'
                  ? 'bg-brand-gradient text-white shadow-md font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>3. Bulk Member Adder</span>
            </button>

            <button
              onClick={() => setActiveSubTab('generator')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'generator'
                  ? 'bg-brand-gradient text-white shadow-md font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>4. Group Generator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Render Active Sub-Feature */}
      {activeSubTab === 'extractor' && (
        <GroupNumbersExtractor onImportToAutomation={onImportToAutomation} />
      )}

      {activeSubTab === 'joiner' && (
        <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Link className="w-5 h-5 text-[#ff8c5a]" />
              <span>Feature #2: Auto Group Joiner</span>
            </h3>
            <p className="text-xs text-white/50">
              Join multiple WhatsApp groups sequentially with randomized safety pacing from a list of invite codes or links.
            </p>
          </div>
          <AutoGroupJoiner sessions={sessions} selectedSessionId={selectedSessionId} />
        </div>
      )}

      {activeSubTab === 'adder' && (
        <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <span>Feature #3: Bulk Member Adder</span>
            </h3>
            <p className="text-xs text-white/50">
              Add participants from CSV/XLSX to an existing WhatsApp group in paced chunks with detailed failure reason reporting.
            </p>
          </div>
          <BulkMemberAdder sessions={sessions} selectedSessionId={selectedSessionId} />
        </div>
      )}

      {activeSubTab === 'generator' && (
        <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-cyan-400" />
              <span>Feature #4: Bulk Group Generator</span>
            </h3>
            <p className="text-xs text-white/50">
              Create a new WhatsApp group, populate members in paced chunks, set description, and fetch instant invite link.
            </p>
          </div>
          <BulkGroupGenerator sessions={sessions} selectedSessionId={selectedSessionId} />
        </div>
      )}
    </div>
  );
}
