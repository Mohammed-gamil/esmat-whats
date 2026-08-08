# WhatsApp AI Sales Agent Architecture

## System Overview

The WhatsApp AI Sales Agent is structured into three primary architectural tiers:

```
+-----------------------------------------------------------------------------------+
|                              1. DASHBOARD & UI LAYER                              |
|   Next.js 15 Standalone Dashboard (`/src/app/page.tsx` & `WhatsAppAgentTab.tsx`)  |
+-----------------------------------------------------------------------------------+
                                         │ REST API / SWR
                                         ▼
+-----------------------------------------------------------------------------------+
|                        2. SALES ENGINE & DOMAIN LOGIC                             |
|  - Inbound Webhook Processor (`process-inbound-webhook.use-case.ts`)              |
|  - Autonomous Multi-Provider LLM Engine (`WhatsAppAiAgent` in `ai-agent.ts`)      |
|  - Conversation Memory & Live Google Dork Dossier Synthesizer                     |
|  - Anti-Ban Paced Send Queue (`send-queue.ts` + Redis/Memory KV)                  |
|  - Voice Transcription (`Deepgram` / `Whisper`)                                   |
|  - Zoho CRM Sync (`zoho-service.ts`) & Calendar Booking                           |
+-----------------------------------------------------------------------------------+
                                         │ HTTP REST Webhook / API
                                         ▼
+-----------------------------------------------------------------------------------+
|                           3. GATEWAY & INFRASTRUCTURE                             |
|  - OpenWA NestJS Gateway (`openwa/` running on http://localhost:2785)             |
|  - WhatsApp Web Socket Session Manager (`whatsapp-web.js` / Puppeteer)            |
|  - Dual Linking: QR Code & 8-Digit Phone Pairing Code                             |
|  - SQLite Database (`prisma/dev.db`)                                              |
+-----------------------------------------------------------------------------------+
```

---

## 🔄 Detailed Message Execution Flow

### Inbound Message Flow:
1. Prospect sends a WhatsApp message (Text or Voice PTT note).
2. OpenWA Gateway captures socket event and posts webhook payload to `http://localhost:3000/api/whatsapp/webhook`.
3. `processInboundWebhook` handler validates event idempotency via `chat-store.ts`.
4. If message is voice PTT, `VoiceTranscriptionService` transcribes audio via Deepgram or OpenAI Whisper.
5. If human representative has taken over the chat (`human_takeover`), auto-reply is skipped.
6. Conversation history and prospect dossier are assembled via `ConversationMemory`.
7. `WhatsAppAiAgent.evaluateTurn` generates sales decision via LLM (Gemini/OpenAI/Anthropic/OpenRouter).
8. If decision is `REPLY`, response is enqueued in `send-queue.ts` with human-jitter delay (0.5s–1.5s).
9. Background worker executes send request through OpenWA API endpoint (`/api/sessions/:id/messages/send-text`).
10. Lead interest score is updated (`applyLeadScore`). If score >= 60, lead status is upgraded to `qualified` and synced to Zoho CRM.

---

## 🛡️ Anti-Ban & Pacing Controls

- **Cold Hook Outreach Pacing**: Enforces 8 to 18 seconds randomized delay between outbound hook messages.
- **Inbound AI Reply Pacing**: Fast human jitter (0.5s to 1.5s).
- **Spintax Personalization**: Randomizes words using `{Hi|Hello}` syntax.
- **Zero-Width Character Fingerprinting**: Appends randomized zero-width Unicode characters (`\u200B`, `\u200C`, `\u200D`) to prevent message template hash detection by WhatsApp algorithms.
