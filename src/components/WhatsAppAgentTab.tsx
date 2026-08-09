'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  Sliders,
  Play,
  Search,
  X,
  Pencil,
  Phone,
  Circle,
  ArrowUpRight,
  ChevronRight,
  Zap,
  User,
  SlidersHorizontal,
  Bot,
  ShieldCheck,
  Plus,
  Check,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppSession {
  id: string;
  sessionId: string;
  engine: string;
  phoneNumber?: string;
  status: string;
  qrCodeUrl?: string;
  updatedAt: string;
}

interface WhatsAppOutreach {
  id: string;
  leadId: string;
  leadType: string;
  contactPhone: string;
  recipientName?: string;
  status: string;
  initialHook?: string;
  sentiment?: string;
  updatedAt: string;
  messages: {
    id: string;
    direction: 'inbound' | 'outbound';
    body: string;
    senderJid: string;
    createdAt: string;
  }[];
  session: WhatsAppSession;
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WhatsAppAgentTab() {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [outreaches, setOutreaches] = useState<WhatsAppOutreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutreach, setSelectedOutreach] = useState<WhatsAppOutreach | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [dispatchingBatch, setDispatchingBatch] = useState(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'sessions' | 'settings'>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [pairingMode, setPairingMode] = useState<'qr' | 'code'>('qr');
  const [pairingPhoneInput, setPairingPhoneInput] = useState('');
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
  const [customName, setCustomName] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [customJobTitle, setCustomJobTitle] = useState('');
  const [customSector, setCustomSector] = useState('');
  const [customHook, setCustomHook] = useState('');
  const [autoSend, setAutoSend] = useState(true);

  const generateEgyptianHookPreview = () => {
    const comp = customCompany.trim() || customName.trim() || 'شركتكم الموقرة';
    const sec = customSector.trim() || 'مجال أعمالكم';
    const nameGreeting = customName.trim() ? ` ${customName.trim()}` : '';
    setCustomHook(
      `أهلاً بك يا فندم${nameGreeting} 👋\n\nأنا (AI Agent) وكيل ذكاء اصطناعي ومستشار حلول في Reference Agency (استشارات الـ HR والذكاء الاصطناعي للأعمال).\n\nقرأت عن نجاح وتوسعات ${comp} في ${sec}.\n\nبنساعد الشركات على إعادة هيكلة وإصلاح دورات العمل والـ HR الأول، ثم بناء AI Solution مخصص يضمن 100% خصوصية للبيانات.\n\nبنقدم جلسة مجانية مدتها 30 دقيقة لتقييم وهيكلة العمليات وجاهزية الذكاء الاصطناعي (Free AI Readiness & Workflow Assessment).\n\nهل يناسبك نحدد موعد سرييع للجلسة؟`
    );
  };

  const generateEnglishHookPreview = () => {
    const comp = customCompany.trim() || 'your team';
    const sec = customSector.trim() || 'your sector';
    const nameGreeting = customName.trim() ? ` ${customName.trim()}` : '';
    setCustomHook(
      `Hi${nameGreeting}! 👋\n\nI'm an AI Agent & Solution Specialist with Reference Agency (HR & B2B AI Consulting).\n\nNoticed ${comp}'s expansion in ${sec}.\n\nWe re-engineer and fix manual business & HR workflows first, then deploy tailored AI solutions to eliminate bottlenecks with 100% data privacy.\n\nWe're offering a Free 30-Min AI Readiness & Workflow Assessment Meeting to evaluate your operations.\n\nOpen to a quick free session this week?`
    );
  };

  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [clientDossier, setClientDossier] = useState<any>(null);

  const handleFetchDossier = async (outreachId: string) => {
    setShowDossierModal(true);
    setDossierLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/outreach/${outreachId}/dossier`).then((r) => r.json());
      if (res.success) {
        setClientDossier(res.dossier);
      } else {
        setClientDossier(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDossierLoading(false);
    }
  };

  const handleGenerateAiDorkPrompt = async (outreachId: string) => {
    setDossierLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/outreach/${outreachId}/dossier`, {
        method: 'POST',
      }).then((r) => r.json());
      if (res.success) {
        setClientDossier(res.dossier);
      } else {
        alert(res.error || 'Failed to generate AI Dork prompt');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to generate AI Dork prompt');
    } finally {
      setDossierLoading(false);
    }
  };

  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState({
    gatewayUrl: 'http://localhost:2785',
    systemPrompt:
      'You are an expert B2B AI Solution Engineer & Sales Representative for Reference Agency — an HR & AI Consulting Agency. Your goal is to engage potential B2B clients warmly on WhatsApp, understand their operational/HR/technical challenges, present our custom agentic solutions (D4G Framework) with technical precision and anti-buzzword clarity, answer architecture & integration questions, handle objections (IP, escrow, local hosting), and invite them to book a Free 30-Minute AI Readiness & Architecture Assessment Meeting before discussing custom pricing. (Respond in natural Egyptian Arabic first if contact is Egyptian/Arab).',
    delaySeconds: 5,
    autoReply: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, outRes, setRes] = await Promise.all([
        fetch('/api/whatsapp/sessions').then((r) => r.json()),
        fetch('/api/whatsapp/outreach').then((r) => r.json()),
        fetch('/api/whatsapp/settings').then((r) => r.json()),
      ]);

      if (sessRes.success) setSessions(sessRes.sessions);
      if (outRes.success) setOutreaches(outRes.outreaches);
      if (setRes.success && setRes.settings) setSettings(setRes.settings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Prevent window page auto-scrolling on state changes
  useEffect(() => {
    if (chatEndRef.current && chatEndRef.current.parentElement) {
      chatEndRef.current.parentElement.scrollTop = chatEndRef.current.parentElement.scrollHeight;
    }
  }, [selectedOutreach?.messages?.length]);

  const activeSession = sessions[0] || null;
  const isConnected = activeSession?.status === 'WORKING';

  const queuedCount = useMemo(() => {
    return outreaches.filter((o) => o.status === 'queued').length;
  }, [outreaches]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setOutreaches((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
    if (selectedOutreach?.id === id) {
      setSelectedOutreach((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleStartCustomChat = async () => {
    if (!customPhone.trim()) return;
    setIsConnecting(true);
    try {
      const res = await fetch('/api/whatsapp/connect-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: [customPhone.trim()],
          leadType: 'maps_lead',
          customName: customName.trim() || undefined,
          customPhone: customPhone.trim() || undefined,
          customCompany: customCompany.trim() || undefined,
          customJobTitle: customJobTitle.trim() || undefined,
          customSector: customSector.trim() || undefined,
          customHook: customHook.trim() || undefined,
          autoSend: autoSend,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setShowCustomModal(false);
        setCustomPhone('');
        setCustomName('');
        setCustomCompany('');
        setCustomJobTitle('');
        setCustomSector('');
        setCustomHook('');
        setActiveTab('pipeline');
        await loadData();
        if (res.outreaches && res.outreaches.length > 0) {
          setSelectedOutreach(res.outreaches[0]);
        }
      } else {
        alert(res.error || 'Failed to start custom chat');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to start chat');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'sales-agent-1' }),
      }).then((r) => r.json());

      if (res.success) {
        await loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    setLoading(true);
    setStatusMsg('Resetting WhatsApp session & generating new QR code...');
    try {
      const activeSess = sessions[0] || { sessionId: 'sales-agent-1' };
      const res = await fetch('/api/whatsapp/sessions/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSess.sessionId }),
      }).then((r) => r.json());

      if (res.success) {
        setStatusMsg('Session reset successfully! Scan the new QR code below.');
        await loadData();
      } else {
        setStatusMsg(`Reset failed: ${res.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error(e);
      setStatusMsg(`Reset error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!pairingPhoneInput.trim()) {
      alert('Please enter your full WhatsApp phone number with country code (e.g. 201012345678)');
      return;
    }
    setPairingLoading(true);
    setStatusMsg('Requesting 8-digit WhatsApp pairing code from OpenWA...');
    try {
      const activeSess = sessions[0] || { sessionId: 'sales-agent-1' };
      const res = await fetch('/api/whatsapp/sessions/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSess.sessionId, phoneNumber: pairingPhoneInput }),
      }).then((r) => r.json());

      if (res.success && res.pairingCode) {
        setPairingCodeResult(res.pairingCode);
        setStatusMsg('8-Digit Pairing Code generated! Open WhatsApp on phone -> Linked Devices -> Link with Phone Number.');
        await loadData();
      } else {
        alert(res.error || 'Failed to generate pairing code');
        setStatusMsg(`Pairing error: ${res.error || 'Failed to generate code'}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to generate pairing code');
      setStatusMsg(`Pairing error: ${e.message}`);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleSendReply = async (overrideText?: string) => {
    const text = overrideText || replyText;
    if (!selectedOutreach || !text.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/whatsapp/chats/${selectedOutreach.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      }).then((r) => r.json());

      if (res.success) {
        if (!overrideText) setReplyText('');
        setSelectedOutreach((prev) =>
          prev
            ? {
                ...prev,
                status: 'sent',
                messages: [
                  ...prev.messages,
                  {
                    id: Math.random().toString(),
                    direction: 'outbound',
                    body: text.trim(),
                    senderJid: 'sdr_agent',
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null
        );
        await loadData();
      } else {
        alert(`Failed to send WhatsApp message: ${res.error}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleDispatchQueued = async (targetOutreachId?: string) => {
    setDispatchingBatch(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/whatsapp/outreach/send-queued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetOutreachId ? { outreachId: targetOutreachId } : {}),
      }).then((r) => r.json());

      if (res.success) {
        const msg = targetOutreachId
          ? 'Dispatched initial hook message!'
          : `Dispatched ${res.dispatchedCount} queued message(s)!`;
        setStatusMsg(msg);
        setTimeout(() => setStatusMsg(null), 3000);
        await loadData();

        if (selectedOutreach && targetOutreachId === selectedOutreach.id) {
          setSelectedOutreach((prev) => (prev ? { ...prev, status: 'sent' } : null));
        }
      } else {
        alert(`Dispatch Error: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Dispatch Failed: ${e.message}`);
    } finally {
      setDispatchingBatch(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await fetch('/api/whatsapp/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      alert('WhatsApp AI Settings saved.');
    } catch (e) {
      console.error(e);
    }
  };

  const filteredOutreaches = outreaches.filter((o) => {
    const matchSearch =
      (o.recipientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.contactPhone.includes(searchQuery);
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4 font-sans text-zinc-100 antialiased outline-none">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11131c]/80 backdrop-blur-md border border-zinc-800/40 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-1.5 bg-[#0a0b0e] p-1 rounded-lg border border-zinc-800/40">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 outline-none',
              activeTab === 'pipeline'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Conversations</span>
            {outreaches.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-700/60 text-white text-[10px] font-mono">
                {outreaches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 outline-none',
              activeTab === 'sessions'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>Connection & QR</span>
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              )}
            />
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 outline-none',
              activeTab === 'settings'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Settings</span>
          </button>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {queuedCount > 0 && (
            <button
              onClick={() => handleDispatchQueued()}
              disabled={dispatchingBatch}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md outline-none"
            >
              {dispatchingBatch ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-950" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-current text-zinc-950" />
              )}
              <span>Send Queued Messages ({queuedCount})</span>
            </button>
          )}

          <button
            onClick={() => setShowCustomModal(true)}
            className="px-3 py-1.5 rounded-lg bg-[#0a0b0e] hover:bg-zinc-800/60 border border-zinc-800/40 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors outline-none"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New Chat</span>
          </button>

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-zinc-800/40 bg-[#0a0b0e] text-zinc-400 hover:text-white transition-colors outline-none"
            title="Refresh Conversations"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="flex flex-col lg:flex-row h-[600px] min-h-[550px] bg-[#11131c]/80 backdrop-blur-md rounded-xl border border-zinc-800/40 overflow-hidden shadow-sm">
          <div className="w-full lg:w-[360px] border-r border-zinc-800/40 flex flex-col bg-[#0a0b0e]/60 flex-shrink-0">
            <div className="p-3 border-b border-zinc-800/40 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search contact or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#11131c] border border-zinc-800/40 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {['all', 'queued', 'sent', 'replied', 'closed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors outline-none',
                      filterStatus === st
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/30">
              {filteredOutreaches.length === 0 ? (
                <div className="p-10 text-center text-zinc-500 text-xs space-y-2">
                  <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto stroke-1" />
                  <div className="text-zinc-400 font-medium">No conversations found</div>
                  <p className="text-zinc-600 text-[11px]">Click &quot;New Chat&quot; to start messaging.</p>
                </div>
              ) : (
                filteredOutreaches.map((o) => {
                  const isActive = selectedOutreach?.id === o.id;
                  const lastMsg = o.messages?.length > 0 ? o.messages[o.messages.length - 1] : null;

                  return (
                    <div
                      key={o.id}
                      onClick={() => setSelectedOutreach(o)}
                      className={cn(
                        'p-3 cursor-pointer transition-colors space-y-1.5',
                        isActive
                          ? 'bg-[#181a26] border-l-2 border-l-emerald-400'
                          : 'hover:bg-[#12141e]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-emerald-400 shrink-0 uppercase">
                            {(o.recipientName || o.contactPhone)?.[0] || '?'}
                          </div>
                          <span className="text-xs font-semibold text-white truncate">
                            {o.recipientName || 'Lead'}
                          </span>
                        </div>

                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {timeAgo(o.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-zinc-400 truncate max-w-[200px]">
                          {lastMsg ? lastMsg.body : o.initialHook || 'No messages yet'}
                        </p>

                        <span
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0',
                            o.status === 'replied' && 'bg-emerald-950 text-emerald-300 border border-emerald-800/40',
                            o.status === 'sent' && 'bg-indigo-950 text-indigo-300 border border-indigo-800/40',
                            o.status === 'queued' && 'bg-amber-950 text-amber-300 border border-amber-800/40',
                            o.status === 'closed' && 'bg-zinc-900 text-zinc-500'
                          )}
                        >
                          {o.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                        <span>{o.contactPhone}</span>
                        {o.status === 'queued' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDispatchQueued(o.id);
                            }}
                            className="text-[10px] text-emerald-400 hover:underline font-sans font-medium"
                          >
                            Send Hook Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-[#090a0f] relative">
            {selectedOutreach ? (
              <>
                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/40 bg-[#11131c]/60">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      {selectedOutreach.recipientName || 'Lead'}
                    </h3>
                    <span className="text-xs font-mono text-zinc-400">
                      {selectedOutreach.contactPhone}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectedOutreach && handleFetchDossier(selectedOutreach.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 flex items-center gap-1.5 transition-colors outline-none cursor-pointer"
                      title="View Client Custom AI System Prompt & Knowledge Base Dossier"
                    >
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Custom System Prompt</span>
                    </button>

                    {selectedOutreach.status === 'queued' && (
                      <button
                        onClick={() => handleDispatchQueued(selectedOutreach.id)}
                        disabled={dispatchingBatch}
                        className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors outline-none"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Send Initial Hook Now</span>
                      </button>
                    )}

                    <select
                      value={selectedOutreach.status}
                      onChange={(e) => handleStatusChange(selectedOutreach.id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0a0b0e] border border-zinc-800/40 text-zinc-200 outline-none cursor-pointer"
                    >
                      <option value="queued">Queued</option>
                      <option value="sent">Sent</option>
                      <option value="replied">Replied</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
                  {selectedOutreach.initialHook && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-semibold uppercase text-[10px] tracking-wider flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5" /> Generated Initial Outreach Hook
                        </span>
                        {selectedOutreach.status === 'queued' && (
                          <button
                            type="button"
                            onClick={() => handleSendReply(selectedOutreach.initialHook)}
                            disabled={sending}
                            className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Send className="w-3 h-3 text-emerald-400" />
                            Send Hook Now
                          </button>
                        )}
                      </div>
                      <p className="text-zinc-200 leading-relaxed italic bg-[#0a0b0e] p-2.5 rounded-lg border border-zinc-800/40">
                        &quot;{selectedOutreach.initialHook}&quot;
                      </p>
                    </div>
                  )}

                  {selectedOutreach.messages &&
                    selectedOutreach.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'flex',
                          m.direction === 'outbound' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm',
                            m.direction === 'outbound'
                              ? 'bg-[#0f2219] border border-emerald-900/40 text-emerald-100 rounded-br-none'
                              : 'bg-[#181a24] border border-zinc-800/40 text-zinc-200 rounded-bl-none'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <span className="block text-[10px] text-zinc-400 mt-1 text-right font-mono">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-zinc-800/40 bg-[#11131c]/60">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type WhatsApp reply message..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      className="flex-1 px-3.5 py-2 bg-[#0a0b0e] border border-zinc-800/40 rounded-xl text-xs text-white placeholder:text-zinc-500 outline-none focus:outline-none"
                    />
                    <button
                      onClick={() => handleSendReply()}
                      disabled={sending || !replyText.trim()}
                      className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors outline-none"
                    >
                      {sending ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-2">
                <MessageSquare className="w-10 h-10 text-zinc-600 stroke-1" />
                <div className="text-zinc-300 font-medium text-sm">Select a Conversation</div>
                <p className="text-zinc-500 text-xs">Choose a contact on the left to start chatting.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="bg-[#11131c]/80 backdrop-blur-md border border-zinc-800/40 rounded-xl p-5 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/40 pb-3 gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                OpenWA Gateway Session & Device Pairing
              </h3>
              <p className="text-xs text-zinc-400">
                Pair your WhatsApp account via QR Code scan or 8-Digit Phone Pairing Code.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleStartSession}
                disabled={loading}
                className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-zinc-700 outline-none cursor-pointer"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                <span>Check Status</span>
              </button>

              <button
                onClick={handleResetSession}
                disabled={loading}
                className="px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm outline-none cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-zinc-950" />
                <span>⚡ Force Re-Generate Fresh QR</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#0a0b0e] p-1.5 rounded-xl border border-zinc-800/40 w-fit">
            <button
              onClick={() => setPairingMode('qr')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                pairingMode === 'qr'
                  ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>1. Scan QR Code</span>
            </button>

            <button
              onClick={() => setPairingMode('code')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                pairingMode === 'code'
                  ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>2. Link via 8-Digit Code</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-[#0a0b0e] p-5 rounded-xl border border-zinc-800/40 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Session ID</span>
                <span className="font-mono text-zinc-200 font-semibold">sales-agent-1</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Gateway Endpoint</span>
                <span className="font-mono text-indigo-400 font-semibold">{settings.gatewayUrl}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Engine Type</span>
                <span className="font-mono text-zinc-300">whatsapp-web.js (Headless)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Connection Status</span>
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize',
                    isConnected
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                      : activeSession?.status === 'FAILED'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                  )}
                >
                  {activeSession?.status || 'Disconnected'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Linked Phone Number</span>
                <span className="font-mono text-emerald-300 font-semibold">
                  {activeSession?.phoneNumber ? `+${activeSession.phoneNumber}` : 'Not Paired'}
                </span>
              </div>

              <div className="pt-3 border-t border-zinc-800/40 space-y-2">
                <button
                  onClick={handleResetSession}
                  disabled={loading}
                  className="w-full py-2.5 px-3 rounded-lg bg-rose-500 hover:bg-rose-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md outline-none cursor-pointer"
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                  <span>⚡ Force Reset & Re-Generate Fresh QR Code</span>
                </button>
              </div>
            </div>

            <div className="bg-[#0a0b0e] p-5 rounded-xl border border-zinc-800/40 text-center space-y-4 flex flex-col items-center justify-center min-h-[260px]">
              {isConnected ? (
                <div className="space-y-2 text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <div className="text-sm font-semibold text-white">WhatsApp Agent Connected & Ready</div>
                  <p className="text-xs text-zinc-400">Your phone is linked. Ready to perform automated outreach.</p>
                </div>
              ) : pairingMode === 'qr' ? (
                activeSession?.qrCodeUrl ? (
                  <div className="space-y-3">
                    <img
                      src={activeSession.qrCodeUrl}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 mx-auto rounded-xl border border-zinc-700 bg-white p-2 shadow-xl"
                    />
                    <p className="text-xs text-amber-300 font-medium">
                      Scan with WhatsApp on phone (Menu &gt; Linked Devices &gt; Link a Device)
                    </p>
                    <button
                      onClick={handleResetSession}
                      disabled={loading}
                      className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer block mx-auto"
                    >
                      QR Code expired or not reading? Regenerate Fresh QR Code
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-center text-zinc-400 text-xs py-4">
                    <Bot className="w-8 h-8 text-zinc-600 mx-auto" />
                    <div>Session disconnected or generating QR code...</div>
                    <button
                      onClick={handleResetSession}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 mx-auto transition-colors outline-none cursor-pointer shadow-md"
                    >
                      <QrCode className="w-4 h-4 text-zinc-950" />
                      <span>Generate Fresh QR Code</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="w-full space-y-4 text-left">
                  <div className="space-y-1 text-center">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Link via 8-Digit Phone Code</h4>
                    <p className="text-[11px] text-zinc-400">Enter your full international WhatsApp phone number.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 201012345678 (Country code + number)"
                      value={pairingPhoneInput}
                      onChange={(e) => setPairingPhoneInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleRequestPairingCode}
                      disabled={pairingLoading}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors shrink-0 outline-none"
                    >
                      {pairingLoading ? 'Generating...' : 'Get Code'}
                    </button>
                  </div>

                  {pairingCodeResult && (
                    <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-center space-y-2">
                      <div className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Your Pairing Code</div>
                      <div className="text-2xl font-bold font-mono text-emerald-400 tracking-widest bg-zinc-900 py-2 px-4 rounded-lg border border-emerald-500/30 w-fit mx-auto select-all">
                        {pairingCodeResult}
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        Open WhatsApp on phone &gt; Linked Devices &gt; Link a Device &gt; <b>Link with phone number instead</b> &gt; Enter code above.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-[#11131c]/80 backdrop-blur-md border border-zinc-800/40 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="border-b border-zinc-800/40 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              WhatsApp AI Sales Agent Settings
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configure system prompts, dispatch delays, and auto-reply parameters.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-zinc-300 font-medium">Gateway URL</label>
              <input
                type="text"
                value={settings.gatewayUrl}
                onChange={(e) => setSettings({ ...settings, gatewayUrl: e.target.value })}
                className="w-full bg-[#0a0b0e] border border-zinc-800/40 rounded-lg px-3.5 py-2 text-xs text-white font-mono outline-none focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-300 font-medium">AI SDR System Prompt</label>
              <textarea
                rows={5}
                value={settings.systemPrompt}
                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                className="w-full bg-[#0a0b0e] border border-zinc-800/40 rounded-lg p-3 text-xs text-zinc-200 font-mono leading-relaxed outline-none focus:outline-none resize-y"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-zinc-300 font-medium">Pacing Delay (Seconds per message)</label>
                <input
                  type="number"
                  value={settings.delaySeconds}
                  onChange={(e) => setSettings({ ...settings, delaySeconds: parseInt(e.target.value, 10) || 5 })}
                  className="w-full bg-[#0a0b0e] border border-zinc-800/40 rounded-lg px-3.5 py-2 text-xs text-white font-mono outline-none focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="auto-reply-chk"
                  checked={settings.autoReply}
                  onChange={(e) => setSettings({ ...settings, autoReply: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="auto-reply-chk" className="text-zinc-200 font-medium cursor-pointer">
                  Enable AI Auto-Reply on Inbound Leads
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-xs transition-colors shadow-sm outline-none"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#11131c] border border-zinc-800/80 rounded-2xl p-5 w-full max-w-lg space-y-4 shadow-2xl animate-in fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3 shrink-0">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                Start New Direct WhatsApp Outreach
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-zinc-500 hover:text-white text-xs outline-none p-1 rounded-lg hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium flex items-center gap-1">
                    <span>Phone Number *</span>
                    <span className="text-zinc-500 text-[10px]">(with country code)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +201092314597"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-zinc-800/60 rounded-lg px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium">Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Hassan / م. أحمد"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-zinc-800/60 rounded-lg px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px] font-medium">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={customCompany}
                    onChange={(e) => setCustomCompany(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px] font-medium">Job Title / Role</label>
                  <input
                    type="text"
                    placeholder="e.g. HR Director"
                    value={customJobTitle}
                    onChange={(e) => setCustomJobTitle(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px] font-medium">Industry / Niche</label>
                  <input
                    type="text"
                    placeholder="e.g. Logistics / IT"
                    value={customSector}
                    onChange={(e) => setCustomSector(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-200 font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Initial WhatsApp Outreach Hook</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={generateEgyptianHookPreview}
                      className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-medium transition-colors"
                    >
                      ⚡ Auto Egyptian (مصر)
                    </button>
                    <button
                      type="button"
                      onClick={generateEnglishHookPreview}
                      className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-medium transition-colors"
                    >
                      ⚡ Auto English
                    </button>
                  </div>
                </div>

                <textarea
                  rows={6}
                  placeholder="Enter or auto-generate the custom first message to be sent..."
                  value={customHook}
                  onChange={(e) => setCustomHook(e.target.value)}
                  className="w-full bg-[#0a0b0e] border border-zinc-800/60 rounded-xl p-3 text-xs text-emerald-300 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 leading-relaxed font-sans resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoSendHook"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="autoSendHook" className="text-xs text-zinc-300 font-medium cursor-pointer select-none">
                  Send Initial Hook Message Immediately via WhatsApp
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/40 shrink-0">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartCustomChat}
                disabled={isConnecting || !customPhone.trim()}
                className="px-4 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors outline-none cursor-pointer shadow-md"
              >
                {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 fill-current" />}
                <span>{autoSend ? 'Send & Start Chat' : 'Save to Queue'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#11131c] border border-cyan-900/50 rounded-2xl w-full max-w-2xl p-5 space-y-4 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Client Custom System Prompt & Intelligence Dossier</h3>
                  <p className="text-[11px] text-zinc-400">
                    Auto-generated AI Sales Representative instructions and knowledge base for this exact client.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white bg-zinc-900/60 border border-zinc-800/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs text-zinc-300 pr-1">
              {dossierLoading ? (
                <div className="p-10 text-center text-zinc-400 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400" />
                  <div>Generating Client Custom System Prompt...</div>
                </div>
              ) : clientDossier ? (
                <div className="space-y-3">
                  <div className="p-3 bg-[#0a0b0e] border border-cyan-900/40 rounded-xl space-y-2 text-cyan-200 text-xs font-sans">
                    <div className="font-semibold text-cyan-400 flex items-center justify-between">
                      <span>Business: {clientDossier.companyName}</span>
                      <span className="text-zinc-400 text-[11px] font-mono">{clientDossier.location}</span>
                    </div>
                    <div>Sector: <span className="text-zinc-300">{clientDossier.sector}</span></div>
                    <div>Primary Contact: <span className="text-zinc-200 font-semibold">{clientDossier.recipientName}</span> ({clientDossier.jobTitle || 'Executive'})</div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block font-sans">
                      Complete Auto-Generated System Instruction Prompt
                    </label>
                    <textarea
                      readOnly
                      rows={14}
                      value={clientDossier.customSystemInstruction}
                      className="w-full bg-[#07080c] border border-zinc-800/60 rounded-xl p-3 text-xs text-emerald-300 font-mono leading-relaxed resize-none outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  Could not load dossier instructions for this conversation.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40 shrink-0">
              <button
                type="button"
                onClick={() => selectedOutreach && handleGenerateAiDorkPrompt(selectedOutreach.id)}
                disabled={dossierLoading}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-all outline-none"
              >
                {dossierLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                <span>⚡ Run Live AI Dorks & Synthesize System Prompt</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
