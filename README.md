# esmat-whats

# WhatsApp AI Sales Agent — Standalone Project

Autonomous, multi-provider AI sales representative and WhatsApp outreach platform built with **Next.js 15 App Router**, **Prisma 6**, **TypeScript**, **OpenWA (whatsapp-web.js)**, and **Redis**.

This project was isolated as a standalone codebase from `leadscrape-ai` to serve as an independent starter template for custom WhatsApp AI Sales Representative and Lead Conversion pipelines.

---

## 🌟 Key Features

1. **Autonomous Multi-Provider Sales AI Engine (`WhatsAppAiAgent`)**:
   - Multi-LLM provider support: Google Gemini, OpenAI, Anthropic Claude, and OpenRouter with automatic provider fallback.
   - Live B2B Lead Intelligence Dossier generation with Google Dorking search via Serper API.
   - PDF Sales Brochure dispatcher and Google Calendar 30-Minute Demo slot booking intent detection.
   - Strategic objection handling (IP privacy, local hosting, custom pricing).
   - Natural Egyptian Arabic / Local dialect prioritization for Arab leads (`+20` numbers).

2. **OpenWA WhatsApp Web Gateway Integration**:
   - Puppeteer-driven headless WhatsApp Web socket gateway (port 2785).
   - Dual linking modes: **QR Code scan** and **8-Digit Phone Pairing Code**.
   - Automatic webhook registration and session health watchdog.

3. **Production Outreach & Anti-Ban Architecture**:
   - Paced sending queue with randomized delays (8–18s for hooks, 0.5–1.5s for fast human jitter replies).
   - Spintax template resolution (`{Hi|Hello}`) and zero-width character fingerprinting.
   - Human takeover detection (`human_takeover`) to pause AI auto-reply when a human representative intervenes.

4. **Voice Note & PTT Transcription**:
   - Inbound voice note transcription via Deepgram Nova-2 and OpenAI Whisper.

5. **CRM Synchronization**:
   - Automatic Zoho CRM lead qualification and payload syncing for high-intent prospects (score >= 60).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.x or v20.x
- **npm**: v9.x or higher
- **Redis** (Optional): If Redis is not running on `localhost:6379`, the system automatically uses an in-memory KV fallback.

### 2. Installation & Setup
```bash
# Navigate to standalone project root
cd whatsapp-agent-standalone

# Install dependencies
npm install

# Copy environment preset
cp .env.example .env

# Sync database schema (Prisma SQLite)
npx prisma db push
```

### 3. Launching Services
Run the master startup script:
```bash
./start.sh
```
This script automatically:
1. Verifies/starts Redis KV server.
2. Launches OpenWA NestJS Gateway on `http://localhost:2785`.
3. Syncs the SQLite database (`prisma/dev.db`).
4. Starts the Next.js standalone application on `http://localhost:3000`.

---

## 📂 Project Architecture & File Structure

```
whatsapp-agent-standalone/
├── .env.example                    # Environment variable configuration presets
├── package.json                    # Standalone npm dependencies
├── tsconfig.json                    # TypeScript path aliases (@/*)
├── next.config.ts                   # Server external packages setup
├── prisma/
│   └── schema.prisma               # Prisma data models (Session, Outreach, Message, Settings)
├── openwa/                          # OpenWA NestJS WhatsApp Web socket gateway
├── src/
│   ├── app/                        # Next.js 15 App Router
│   │   ├── api/whatsapp/           # API Endpoints (sessions, webhook, chats, outreach)
│   │   ├── page.tsx                # Standalone Sales Agent UI Dashboard
│   │   ├── layout.tsx              # Root HTML layout
│   │   └── globals.css             # Tailwind CSS styles
│   ├── domain/whatsapp/            # Core Sales Domain Logic
│   │   ├── ai-agent.ts             # Autonomous sales agent & LLM reasoning engine
│   │   ├── conversation-memory.ts  # Turn history & dossier prompt builder
│   │   ├── lead-dossier-generator.ts # Live Dork synthesis & lead profile builder
│   │   ├── types.ts                # Domain type interfaces
│   │   └── validation.ts           # Zod payload validation schemas
│   ├── application/whatsapp/       # Application Use Cases
│   │   └── process-inbound-webhook.use-case.ts # Inbound webhook processor
│   ├── services/                   # Infrastructure & Background Services
│   │   ├── whatsapp-service.ts     # OpenWA gateway communicator & lead queue manager
│   │   ├── send-queue.ts           # Anti-ban background queue worker with Redis lock
│   │   ├── voice-transcription-service.ts # Deepgram/Whisper voice note transcriber
│   │   ├── calendar-booking-service.ts # Google Calendar booking integration
│   │   └── zoho-service.ts         # Zoho CRM lead synchronizer
│   ├── lib/                        # Core Utilities
│   │   ├── prisma.ts               # Singleton Prisma client
│   │   ├── redis.ts                # Dual-mode Redis / Memory KV store
│   │   ├── chat-store.ts           # Chat metadata store & deduplication
│   │   └── zoho-client.ts          # Zoho OAuth token manager
│   └── components/
│       └── WhatsAppAgentTab.tsx    # Complete WhatsApp Sales Agent UI Dashboard
└── start.sh                        # Master startup script
```

---

## 🔑 Environment Variables Configuration

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API Key | Required for Gemini AI |
| `OPENAI_API_KEY` | OpenAI API Key (Whisper & GPT-4o) | Optional |
| `ANTHROPIC_API_KEY` | Anthropic Claude API Key | Optional |
| `OPENROUTER_API_KEY` | OpenRouter API Key | Optional |
| `DEEPGRAM_API_KEY` | Deepgram Voice Transcription API Key | Optional |
| `SERPER_API_KEY` | Serper Google Dork Search API Key | Optional |
| `OPENWA_URL` | OpenWA NestJS Gateway URL | `http://localhost:2785` |
| `REDIS_URL` | Redis Connection URL | `redis://localhost:6379` |
| `DATABASE_URL` | SQLite Database Path | `file:./dev.db` |

---

## 🧪 Testing

Run unit tests:
```bash
npm test
```

---

## 📜 License
MIT License.
