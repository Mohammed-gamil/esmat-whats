# 🚀 Production & DevOps Deployment Guide

This guide provides end-to-end instructions for DevOps engineers to deploy the **WhatsApp AI Sales Agent Platform** and **OpenWA Gateway API** to production environments.

---

## 🏗️ Architecture Overview

The system consists of three primary services:

1. **Next.js Web Dashboard & Automation Agent** (`Port 3000`):
   - Handles CSV/XLSX bulk messaging, campaign creation, lead management, and AI agent execution.
   - Built with Next.js 15, Prisma 6 (SQLite/Postgres), and TailwindCSS.

2. **OpenWA NestJS WhatsApp Gateway** (`Port 2785`):
   - Handles headless WhatsApp companion device linking, QR code generation, 8-digit pairing codes, and message dispatch.
   - Automatically stores its seeded master API key in `openwa/data/.api-key`.

3. **Redis Key-Value & Queue Store** (`Port 6379`, Optional):
   - Accelerates send queue throttling and chat caching. Falls back automatically to in-memory KV store if Redis is unreachable.

---

## ⚡ Option 1: Docker Compose Quickstart (Recommended)

To deploy the entire production stack in Docker:

```bash
# 1. Clone & enter repository
git clone https://github.com/Mohammed-gamil/esmat-whats.git
cd esmat-whats

# 2. Copy environment template and set your LLM API Keys
cp .env.example .env
nano .env

# 3. Build & start all services in background
docker compose up -d --build

# 4. Check status & logs
docker compose ps
docker compose logs -f
```

### Access Points:
- **Web Dashboard**: `http://<your-server-ip>:3000`
- **Gateway REST API**: `http://<your-server-ip>:2785`
- **Gateway Swagger UI**: `http://<your-server-ip>:2785/api/docs`

---

## 🖥️ Option 2: Bare Metal / VPS Deployment (PM2 / Systemd)

### Prerequisites:
- **Node.js**: `>= 22.13.0`
- **npm**: `>= 10.0.0`
- **Chromium / Puppeteer Dependencies**: Required for OpenWA headless browser engine.

```bash
# Ubuntu/Debian Puppeteer dependencies installation
sudo apt update && sudo apt install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

### Installation & Launch:

```bash
# 1. Install workspace dependencies
npm install

# 2. Sync database schema
npx prisma db push

# 3. Launch both Gateway and Web App using master launcher
./start.sh
```

---

## 🔒 Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Next.js web application port |
| `DATABASE_URL` | `file:./dev.db` | SQLite database connection string (or Postgres) |
| `OPENWA_URL` | `http://localhost:2785` | OpenWA Gateway API base URL |
| `OPENWA_API_KEY` | Auto-populated | Master API key for gateway authentication |
| `WHATSAPP_WEBHOOK_URL` | `http://localhost:3000/api/whatsapp/webhook` | Webhook URL for incoming messages & receipts |
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `GEMINI_API_KEY` | — | Google Gemini LLM API key |
| `OPENAI_API_KEY` | — | OpenAI GPT-4o API key |
| `ANTHROPIC_API_KEY` | — | Anthropic Claude 3.5 API key |

---

## 💾 Data Persistence & Backup

DevOps engineers must back up the following persistent directories:

1. `./prisma/dev.db` — SQLite database containing lead intelligence, outreaches, and chat history.
2. `./openwa/data/` — Gateway configuration and master API key (`.api-key`).
3. `./openwa/.wwebjs_auth/` — Authenticated WhatsApp session tokens.

---

## 🩺 Health Checks & Monitoring

- **App Health**: `GET http://localhost:3000/api/whatsapp/chats` (Returns HTTP 200 OK)
- **Gateway Health**: `GET http://localhost:2785/api/health` (Returns `{"status": "ok"}`)
- **Gateway Metrics**: `GET http://localhost:2785/api/metrics`
