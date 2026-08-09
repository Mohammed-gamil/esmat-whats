'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Layers,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { OpenWaSessionDto } from '@/types/openwa-session';
import { OpenWaClient } from '@/lib/openwa-client';
import { OpenWaSessionCard } from './OpenWaSessionCard';
import { CreateSessionModal } from './CreateSessionModal';

export function OpenWaSessionsView() {
  const [sessions, setSessions] = useState<OpenWaSessionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLivePolling, setIsLivePolling] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all sessions seamlessly via server proxy endpoint
  const fetchSessionsList = async (isManual = false) => {
    if (isManual) setLoading(true);
    setGlobalError(null);

    try {
      // 1. Try server proxy route first (zero browser CORS or mixed-content issues)
      const proxyRes = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });

      const data = await proxyRes.json();
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else if (data.error) {
        setGlobalError(data.error);
      } else {
        const client = new OpenWaClient();
        const directSessions = await client.fetchSessions();
        setSessions(directSessions);
      }
    } catch (err: any) {
      setGlobalError(
        err.message ||
          'Unable to connect to WhatsApp Gateway server. Please ensure the gateway process is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Setup live polling every 3 seconds
  useEffect(() => {
    fetchSessionsList(true);

    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    if (isLivePolling) {
      pollingTimerRef.current = setInterval(() => {
        fetchSessionsList(false);
      }, 3000);
    }

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isLivePolling]);

  // Metric Computations
  const totalSessions = sessions.length;
  const readyCount = sessions.filter((s) => {
    const st = (s.status || '').toLowerCase();
    return st === 'ready' || st === 'working' || st === 'connected';
  }).length;

  const qrReadyCount = sessions.filter(
    (s) => (s.status || '').toLowerCase() === 'qr_ready'
  ).length;

  const issueCount = sessions.filter((s) => {
    const st = (s.status || '').toLowerCase();
    return st === 'disconnected' || st === 'action_required' || st === 'failed';
  }).length;

  // Filtered Sessions List
  const filteredSessions = sessions.filter((s) => {
    const query = searchQuery.toLowerCase().trim();
    const matchQuery =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query) ||
      (s.phone && s.phone.includes(query));

    const st = (s.status || '').toLowerCase();
    let matchFilter = true;
    if (filterStatus === 'ready') matchFilter = st === 'ready' || st === 'working' || st === 'connected';
    if (filterStatus === 'qr_ready') matchFilter = st === 'qr_ready';
    if (filterStatus === 'issues') matchFilter = st === 'disconnected' || st === 'action_required' || st === 'failed';

    return matchQuery && matchFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Seamless UX Top Header Bar */}
      <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold shadow-brand-glow">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>WhatsApp Sessions Manager</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] text-xs border border-[#10b981]/30 font-mono font-semibold">
                Live Status Active
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Manage WhatsApp sessions, scan QR codes, and monitor device authentication
            </p>
          </div>
        </div>

        {/* Primary Actions & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Session</span>
          </button>

          <button
            onClick={() => setIsLivePolling(!isLivePolling)}
            className={`px-3 py-2 text-xs font-mono rounded-xl border transition-all flex items-center gap-1.5 ${
              isLivePolling
                ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 font-semibold'
                : 'bg-[#081419] text-white/50 border-white/10'
            }`}
            title="Toggle automatic status polling every 3 seconds"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLivePolling ? 'animate-spin text-[#10b981]' : ''}`} />
            <span>Polling: {isLivePolling ? 'ON (3s)' : 'PAUSED'}</span>
          </button>

          <button
            onClick={() => fetchSessionsList(true)}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#081419] hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 space-y-1 shadow-lg">
          <div className="flex items-center gap-2 font-bold text-xs text-rose-100">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>WhatsApp Gateway Error:</span>
          </div>
          <p className="text-xs text-rose-200/90 pl-6 leading-relaxed font-mono">
            {globalError}
          </p>
        </div>
      )}

      {/* Safety Notice Box */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 shadow-md">
        <div className="flex items-center gap-2 font-bold text-amber-100">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Important WhatsApp Safety Notice:</span>
        </div>
        <p className="text-xs text-amber-200/90 leading-relaxed pl-6">
          This system operates WhatsApp companion sessions using an unofficial Web protocol. We strongly advise linking a{' '}
          <strong className="text-white underline font-semibold">dedicated or burner phone number</strong> rather than your primary personal account to protect your main account from automated ban algorithms.
        </p>
      </div>

      {/* Metrics Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[10px] text-white/50 font-mono uppercase">Total Sessions</span>
            <span className="text-lg font-bold font-mono text-white block mt-0.5">{totalSessions}</span>
          </div>
          <Layers className="w-5 h-5 text-white/40" />
        </div>

        <div className="p-4 rounded-xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[10px] text-white/50 font-mono uppercase">Ready / Connected</span>
            <span className="text-lg font-bold font-mono text-[#10b981] block mt-0.5">{readyCount}</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
        </div>

        <div className="p-4 rounded-xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[10px] text-white/50 font-mono uppercase">QR Ready</span>
            <span className="text-lg font-bold font-mono text-amber-400 block mt-0.5">{qrReadyCount}</span>
          </div>
          <QrCode className="w-5 h-5 text-amber-400" />
        </div>

        <div className="p-4 rounded-xl glass-panel flex items-center justify-between">
          <div>
            <span className="text-[10px] text-white/50 font-mono uppercase">Action / Issues</span>
            <span className="text-lg font-bold font-mono text-rose-400 block mt-0.5">{issueCount}</span>
          </div>
          <AlertCircle className="w-5 h-5 text-rose-400" />
        </div>
      </div>

      {/* Search & Filter Bar */}
      {sessions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d2530] p-3.5 rounded-xl border border-white/10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions by name, UUID, or phone number..."
              className="w-full bg-[#081419] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f05a28]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-mono">Filter Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#081419] border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-[#f05a28]"
            >
              <option value="all">All Statuses ({totalSessions})</option>
              <option value="ready">Ready ({readyCount})</option>
              <option value="qr_ready">QR Ready ({qrReadyCount})</option>
              <option value="issues">Issues / Stopped ({issueCount})</option>
            </select>
          </div>
        </div>
      )}

      {/* Sessions Grid */}
      {loading && sessions.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-2xl space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#ff8c5a] mx-auto" />
          <p className="text-xs text-slate-300 font-mono">Connecting & loading WhatsApp sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#f05a28]/15 border border-[#f05a28]/30 flex items-center justify-center text-[#ff8c5a] mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">No WhatsApp Sessions Found</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              {searchQuery || filterStatus !== 'all'
                ? 'No sessions match your search filters.'
                : 'No active WhatsApp sessions exist yet.'}
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Session</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map((session) => (
            <OpenWaSessionCard
              key={session.id}
              session={session}
              baseUrl="http://localhost:2785/api"
              apiKey=""
              onRefresh={() => fetchSessionsList(false)}
              onActionError={(err) => setGlobalError(err)}
            />
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <CreateSessionModal
          baseUrl="http://localhost:2785/api"
          apiKey=""
          onClose={() => setShowCreateModal(false)}
          onSessionCreated={() => fetchSessionsList(false)}
        />
      )}
    </div>
  );
}
