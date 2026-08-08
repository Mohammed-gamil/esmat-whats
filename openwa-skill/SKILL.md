---
name: openwa
description: Build integrations, bots, and automations against OpenWA (https://github.com/rmyndharis/OpenWA), a free self-hosted WhatsApp API Gateway (REST API + dashboard + webhooks + MCP server, built on whatsapp-web.js/Baileys). Use this skill whenever the user mentions OpenWA, wants to send/receive WhatsApp messages programmatically via a self-hosted gateway, needs to wire up WhatsApp sessions, webhooks, bulk messaging, groups, or contacts through OpenWA's REST API, wants to connect an AI agent to WhatsApp via OpenWA's MCP server, or is building/debugging a WhatsApp bot, chatbot, or notification system on top of OpenWA. Also trigger for questions about OpenWA's engines (whatsapp-web.js vs Baileys), Docker deployment, env configuration, or account-ban-risk guidance for unofficial WhatsApp automation.
---

# OpenWA — Self-Hosted WhatsApp API Gateway

OpenWA (github.com/rmyndharis/OpenWA) is an open-source, self-hosted REST API gateway for WhatsApp. It does **not** use Meta's official Cloud API — it drives WhatsApp through reverse-engineered clients (`whatsapp-web.js` or `baileys`), bundles a React dashboard, and can optionally expose an MCP server so AI agents can drive WhatsApp directly.

Read the reference files below as needed — don't try to hold the whole API surface in context at once.

- `references/endpoints.md` — full REST endpoint directory (sessions, messages, contacts, groups, templates, catalog/channels, labels/status, webhooks, auth, system, admin, search, profile, calls)
- `references/webhooks.md` — webhook payload shape, event catalog, HMAC signature verification, delivery/idempotency semantics, smart filters
- `references/mcp.md` — MCP (Model Context Protocol) server setup for connecting AI agents (Claude, Cursor, etc.) directly to WhatsApp
- `references/config.md` — key environment variables (engine choice, database, storage, rate limits, safety)

## Before writing any integration code — read this

OpenWA connects to WhatsApp through unofficial, reverse-engineered clients, not Meta's Cloud API. **Always surface this to the user before they wire up automation**, especially if they haven't mentioned it:

- **There is always a non-zero risk of account restriction or ban.** No amount of code quality removes this risk.
- **Never suggest connecting a primary personal/business number.** Recommend a dedicated number they can afford to lose — pass this on if it's for a client.
- **Two engines, different tradeoffs** (set via `ENGINE_TYPE`):
  | Engine | Ban-risk | Resource cost |
  |---|---|---|
  | `whatsapp-web.js` (default) | Lower — drives real headless Chromium | High (~300–500 MB RAM/session) |
  | `baileys` | Higher — speaks the WebSocket protocol directly, easier to fingerprint | Low (~30–80 MB RAM/session) |
- **Safe-sending guardrails to bake into any automation you write:**
  1. Warm up a fresh number for several days before bulk use (normal human behavior first).
  2. Never cold-blast first-contact messages to a large list — the single most common cause of restriction.
  3. Rate-limit sends (OpenWA ships `RATE_LIMIT_*` env vars and a `send-bulk` pacing option — use them; a few messages/minute/session is sustainable).
  4. Prefer opted-in recipients (replies, OTPs to your own users, order updates) over outbound cold messaging.
  5. Keep a non-WhatsApp fallback (SMS/email/official Cloud API) for anything login- or revenue-critical.
- For any deployment touching regulated use cases (healthcare, finance, large-scale commercial messaging, EU/EEA users under GDPR/DMA), OpenWA is **not** an approved substitute for Meta's official WhatsApp Cloud API — say so if the user's use case sounds like this.

Don't let this turn into a wall of disclaimers on every response — mention it once, proportionate to what the user is building, then get on with the implementation.

## Core concepts

- **Base URL:** every REST route is under `http://<host>:2785/api` (default port `2785`; dashboard is bundled on the same port in production).
- **Auth:** every non-public route requires `X-API-Key: owa_k1_...` header. Never pass the key as a query parameter — it's rejected. Keys carry a role (`viewer` < `operator` < `admin`) and can be scoped to specific `allowedSessions` / `allowedIps`. Mint a scoped, least-privilege key per integration rather than reusing the seeded admin key (found in the startup log / `data/.api-key`).
- **Response shape:** raw resource JSON, no `{success,data}` envelope. List routes return a bare array (unless the endpoint doc says otherwise). Errors are NestJS-standard: `{ statusCode, message, error }`.
- **Session-centric model:** almost everything hangs off a *session* (one WhatsApp-linked number). Sessions have a lifecycle: `created → initializing → qr_ready → authenticating → ready → disconnected / action_required / failed`.
- **Chat IDs:** `<phone>@c.us` for individuals, `<id>@g.us` for groups.

## Standard workflow: link a number and send a message

```bash
# 1. Create a session
curl -X POST http://localhost:2785/api/sessions \
  -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"name": "my-bot"}'
# -> { "id": "...", "status": "created" }

# 2. Start it (spins up the engine, begins QR generation)
curl -X POST http://localhost:2785/api/sessions/{id}/start -H "X-API-Key: $KEY"

# 3. Poll for the QR code and scan it with WhatsApp on the phone to link
curl http://localhost:2785/api/sessions/{id}/qr -H "X-API-Key: $KEY"
# -> { "qrCode": "data:image/png;base64,...", "status": "qr_ready" }
# (or use POST /api/sessions/{id}/pairing-code for a text code instead of a QR)

# 4. Once status is "ready" (poll GET /api/sessions/{id}, or subscribe to session.status via
#    webhook/websocket instead of polling), send a message
curl -X POST http://localhost:2785/api/sessions/{id}/messages/send-text \
  -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"chatId": "628123456789@c.us", "text": "Hello from OpenWA!"}'
```

For receiving messages, register a webhook (see `references/webhooks.md`) rather than polling — it's the intended pattern and supports HMAC-signed, filtered, at-least-once delivery.

## Quick start (deployment)

```bash
git clone https://github.com/rmyndharis/OpenWA.git && cd OpenWA
docker compose -f docker-compose.dev.yml up -d
# Dashboard + API: http://localhost:2785  ·  Swagger: http://localhost:2785/api/docs
```

Production: `docker compose up -d` (add `--profile postgres`, `--profile redis`, `--profile minio`, or `--profile full` as needed). See `references/config.md` for the env vars that matter most when moving past the dev defaults.

## When the user wants an AI agent to drive WhatsApp directly

Point them at the MCP server (`MCP_ENABLED=true`, mounted at `POST /mcp`) instead of hand-rolling REST calls from the agent — see `references/mcp.md`. Default to a read-only, session-scoped key unless they explicitly need the agent to send messages.

## Full API reference

For any endpoint not covered above — contacts, groups, message templates, catalog/channels, labels, status/stories, bulk messaging, API key management, search, health/metrics, plugins, calls — consult `references/endpoints.md` before guessing a path or payload shape; OpenWA's DTOs are strict (`whitelist`+`forbidNonWhitelisted`), so an extra or misnamed field gets a `400`, not a silent ignore. When in doubt, the running instance's own Swagger UI (`/api/docs`) and `openapi.json` are the ground truth.
