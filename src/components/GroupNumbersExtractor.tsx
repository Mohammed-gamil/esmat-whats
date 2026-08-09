'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Phone,
  UserCheck,
} from 'lucide-react';
import { OpenWaSessionDto } from '@/types/openwa-session';
import { formatWhatsAppPhone } from '@/lib/phone-formatter';
import { parseCsv } from '@/lib/csv-parser';

interface GroupItem {
  id: string;
  name: string;
  memberCount?: number;
}

interface ParticipantItem {
  id: string;
  phone: string;
  formattedPhone: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  groupName: string;
  groupId: string;
}

interface GroupNumbersExtractorProps {
  onImportToAutomation?: () => void;
}

export function GroupNumbersExtractor({ onImportToAutomation }: GroupNumbersExtractorProps) {
  const [sessions, setSessions] = useState<OpenWaSessionDto[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);

  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'member'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [imported, setImported] = useState<boolean>(false);
  const [defaultCountryCode, setDefaultCountryCode] = useState<string>('20');

  // 1. Fetch available connected WhatsApp sessions
  const fetchSessions = async () => {
    setLoadingSessions(true);
    setError(null);
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
      } else {
        setError(data.error || 'Failed to fetch WhatsApp sessions.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to Gateway server.');
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // 2. Fetch groups for selected session
  const fetchGroups = async (sessId: string) => {
    if (!sessId) return;
    setLoadingGroups(true);
    setError(null);
    setGroups([]);
    setSelectedGroupId('');
    setParticipants([]);

    try {
      const res = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'groups', id: sessId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        const mapped: GroupItem[] = data.groups.map((g: any) => ({
          id: g.id,
          name: g.name || g.subject || g.id,
          memberCount: g.participants?.length || undefined,
        }));
        setGroups(mapped);
        if (mapped.length > 0) {
          setSelectedGroupId(mapped[0].id);
          fetchGroupParticipants(sessId, mapped[0].id, mapped[0].name);
        }
      } else {
        setError(data.error || 'No WhatsApp groups found or session not authenticated.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch WhatsApp groups.');
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchGroups(selectedSessionId);
    }
  }, [selectedSessionId]);

  // 3. Fetch participants for selected group
  const fetchGroupParticipants = async (sessId: string, grpId: string, groupName: string) => {
    if (!sessId || !grpId) return;
    setLoadingParticipants(true);
    setError(null);

    try {
      const res = await fetch('/api/whatsapp/sessions-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'group-info', id: sessId, groupId: grpId }),
      });
      const data = await res.json();
      if (data.success && data.groupInfo) {
        const rawParticipants = data.groupInfo.participants || [];
        const parsed: ParticipantItem[] = rawParticipants.map((p: any) => {
          const rawJid = String(p.id || p.user || p);
          const rawDigits = rawJid.replace(/[^\d]/g, '');
          const formatted = formatWhatsAppPhone(rawDigits, defaultCountryCode);
          return {
            id: rawJid,
            phone: rawDigits,
            formattedPhone: formatted || rawDigits,
            isAdmin: Boolean(p.isAdmin || p.admin === 'admin' || p.admin === 'superadmin'),
            isSuperAdmin: Boolean(p.isSuperAdmin || p.admin === 'superadmin'),
            groupName: groupName || data.groupInfo.subject || 'WhatsApp Group',
            groupId: grpId,
          };
        });
        setParticipants(parsed);
      } else {
        setError(data.error || 'Unable to extract group participants.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract group numbers.');
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleGroupSelect = (grpId: string) => {
    setSelectedGroupId(grpId);
    const grp = groups.find((g) => g.id === grpId);
    if (grp && selectedSessionId) {
      fetchGroupParticipants(selectedSessionId, grpId, grp.name);
    }
  };

  // Filtered Participants
  const filteredParticipants = participants.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || p.phone.includes(q) || p.formattedPhone.includes(q) || p.id.toLowerCase().includes(q);
    let matchesRole = true;
    if (filterRole === 'admin') matchesRole = p.isAdmin;
    if (filterRole === 'member') matchesRole = !p.isAdmin;
    return matchesQuery && matchesRole;
  });

  // Export CSV File
  const handleExportCsv = () => {
    if (filteredParticipants.length === 0) return;
    const currentGroup = groups.find((g) => g.id === selectedGroupId);
    const filename = `WhatsApp_Group_Members_${(currentGroup?.name || 'Group').replace(/[^a-zA-Z0-9_\-]/g, '_')}.csv`;

    let csvContent = 'phone,formatted_phone,admin_status,group_name,jid\n';
    filteredParticipants.forEach((p) => {
      const adminLabel = p.isSuperAdmin ? 'Super Admin' : p.isAdmin ? 'Admin' : 'Member';
      csvContent += `"${p.phone}","${p.formattedPhone}","${adminLabel}","${p.groupName.replace(/"/g, '""')}","${p.id}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Phone Numbers to Clipboard
  const handleCopyNumbers = () => {
    if (filteredParticipants.length === 0) return;
    const numbersList = filteredParticipants.map((p) => p.formattedPhone).join('\n');
    navigator.clipboard.writeText(numbersList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1-Click Import into CSV Automation Agent
  const handleImportToAutomationAgent = () => {
    if (filteredParticipants.length === 0) return;
    const currentGroup = groups.find((g) => g.id === selectedGroupId);
    let csvContent = 'phone,formatted_phone,admin_status,group_name\n';
    filteredParticipants.forEach((p) => {
      const adminLabel = p.isSuperAdmin ? 'Super Admin' : p.isAdmin ? 'Admin' : 'Member';
      csvContent += `"${p.phone}","${p.formattedPhone}","${adminLabel}","${p.groupName.replace(/"/g, '""')}"\n`;
    });

    const parsed = parseCsv(csvContent, `Group_${(currentGroup?.name || 'Members').replace(/\s+/g, '_')}.csv`);
    localStorage.setItem('whatsapp_agent_csv_parse_result', JSON.stringify(parsed));

    setImported(true);
    setTimeout(() => setImported(false), 2000);

    if (onImportToAutomation) {
      onImportToAutomation();
    }
  };

  const adminCount = participants.filter((p) => p.isAdmin).length;
  const regularCount = participants.length - adminCount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold shadow-brand-glow">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>WhatsApp Group Numbers Extractor</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f05a28]/15 text-[#ff8c5a] text-xs border border-[#f05a28]/30 font-mono font-semibold">
                Auto +20 Prefix Active
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Extract participant phone numbers from any WhatsApp group and import directly into campaign messaging
            </p>
          </div>
        </div>

        {/* Session Selector & Refetch */}
        <div className="flex items-center gap-3 flex-wrap">
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

          <button
            onClick={() => selectedSessionId && fetchGroups(selectedSessionId)}
            disabled={loadingGroups || loadingSessions}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#081419] hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
            <span>Reload Groups</span>
          </button>
        </div>
      </div>

      {/* Error Callout */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="text-xs font-mono">{error}</span>
        </div>
      )}

      {/* Main Grid: Left Group Selector & Right Participants Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Group List */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4 md:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#ff8c5a]" />
                <span>Your WhatsApp Groups</span>
              </h3>
              <span className="text-xs font-mono text-[#ff8c5a] font-bold">
                {groups.length} Group(s)
              </span>
            </div>

            {loadingGroups ? (
              <div className="p-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#ff8c5a] mx-auto" />
                <span className="text-xs text-white/50 font-mono">Fetching WhatsApp groups...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/40 font-mono">
                No groups found for this session.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {groups.map((grp) => {
                  const isSelected = selectedGroupId === grp.id;
                  return (
                    <button
                      key={grp.id}
                      onClick={() => handleGroupSelect(grp.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#081419] border-[#ff8c5a] text-white shadow-lg'
                          : 'bg-[#081419]/40 border-white/5 hover:border-white/20 text-white/70 hover:text-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold block truncate">{grp.name}</span>
                        <span className="text-[10px] font-mono text-white/40 block truncate">
                          {grp.id}
                        </span>
                      </div>
                      {grp.memberCount !== undefined && (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-amber-300 shrink-0">
                          {grp.memberCount} M
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Country Code Prefix Setting */}
          <div className="p-3 rounded-xl bg-[#081419] border border-white/10 space-y-1.5 text-xs">
            <span className="text-[11px] text-white/50 block font-mono">Auto Country Code Prefix:</span>
            <div className="flex items-center gap-2">
              <span className="text-white/60 font-mono font-bold">+</span>
              <input
                type="text"
                value={defaultCountryCode}
                onChange={(e) => setDefaultCountryCode(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="20"
                className="w-16 bg-[#0d2530] border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-[#f05a28]"
              />
              <span className="text-[10px] text-white/40">(Default 20 Egypt)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Participants Table & Actions */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4 md:col-span-2">
          {/* Header Controls & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#10b981]" />
                <span>Extracted Participants ({filteredParticipants.length})</span>
              </h3>
              <span className="text-xs text-white/50 font-mono">
                Admins: {adminCount} | Members: {regularCount}
              </span>
            </div>

            {/* Action Buttons: Export CSV, Copy, Import to Automation */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopyNumbers}
                disabled={filteredParticipants.length === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#081419] hover:bg-white/10 text-white/80 border border-white/10 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Numbers'}</span>
              </button>

              <button
                onClick={handleExportCsv}
                disabled={filteredParticipants.length === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#081419] hover:bg-white/10 text-white/80 border border-white/10 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleImportToAutomationAgent}
                disabled={filteredParticipants.length === 0}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-brand-gradient hover:opacity-90 text-white shadow-brand-glow disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {imported ? <Check className="w-3.5 h-3.5 text-white" /> : <Zap className="w-3.5 h-3.5 fill-white" />}
                <span>{imported ? 'Imported!' : 'Send to Bulk Agent'}</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#081419] p-3 rounded-xl border border-white/10">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone number or JID..."
                className="w-full bg-[#0d2530] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f05a28]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 font-mono">Role:</span>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="bg-[#0d2530] border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-[#f05a28]"
              >
                <option value="all">All Roles ({participants.length})</option>
                <option value="admin">Admins Only ({adminCount})</option>
                <option value="member">Members Only ({regularCount})</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-[#081419] rounded-xl border border-white/10 overflow-hidden">
            {loadingParticipants ? (
              <div className="p-12 text-center space-y-2">
                <RefreshCw className="w-7 h-7 animate-spin text-[#ff8c5a] mx-auto" />
                <span className="text-xs text-white/50 font-mono">Extracting group phone numbers...</span>
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40 font-mono">
                No participants found. Select a WhatsApp group on the left.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead className="bg-[#0d2530] text-white/50 uppercase text-[10px] sticky top-0 border-b border-white/10">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Formatted Phone (+20)</th>
                      <th className="p-3">Raw Digits</th>
                      <th className="p-3">Role Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {filteredParticipants.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-white/40">{idx + 1}</td>
                        <td className="p-3 font-bold text-emerald-400 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <span>{p.formattedPhone}</span>
                        </td>
                        <td className="p-3 text-white/70">{p.phone}</td>
                        <td className="p-3">
                          {p.isSuperAdmin ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/40 font-bold">
                              Super Admin
                            </span>
                          ) : p.isAdmin ? (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] border border-cyan-500/40 font-bold">
                              Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px]">
                              Member
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
