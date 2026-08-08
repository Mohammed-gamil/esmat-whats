# OpenWA REST API — Endpoint Directory

Base URL: `http://<host>:2785/api` · Auth: `X-API-Key: owa_k1_...` header on every route below unless noted `(public)`.

All request bodies are validated with NestJS `whitelist` + `forbidNonWhitelisted`: an unknown or misnamed field returns `400`, not a silent ignore. Responses are the raw resource/array — no `{success,data}` envelope. Session `status` wire values are lowercase: `created | initializing | qr_ready | authenticating | ready | disconnected | action_required | failed`.

For full request/response schemas, field constraints, and error tables beyond the one-liners here, check the running instance's Swagger UI at `/api/docs` or its `openapi.json`. Endpoints requiring `OPERATOR` or `ADMIN` role are noted; everything else accepts any valid key (`viewer` included).

## Sessions (`/api/sessions`)

| Method & Path | Role | What it does |
|---|---|---|
| GET `/api/sessions` | any | List all sessions, scoped to the API key's `allowedSessions`, newest first. |
| GET `/api/sessions/:id` | any | Get a single session by ID. |
| GET `/api/sessions/:id/qr` | OPERATOR | Get the QR code (PNG data URL) for session authentication. |
| GET `/api/sessions/:id/groups` | any | Get all groups the session is a member of (paginated). |
| GET `/api/sessions/:id/chats` | any | Get active chats for a session, most-recent first (paginated). |
| GET `/api/sessions/stats/overview` | any | Session statistics for multi-session monitoring. |
| POST `/api/sessions` | OPERATOR, unscoped key | Create a new WhatsApp session. Body: `{ name, config?, proxyUrl?, proxyType? }`. `name`: 3-50 chars, `[a-zA-Z0-9-]+`. |
| POST `/api/sessions/:id/start` | OPERATOR | Start a session and initialize the WhatsApp connection. |
| POST `/api/sessions/:id/stop` | OPERATOR | Stop a session and disconnect WhatsApp. |
| POST `/api/sessions/:id/logout` | OPERATOR | Attempt an engine-native unlink of the companion device, then tear down locally. |
| POST `/api/sessions/:id/force-kill` | OPERATOR | Force-kill a stuck session (SIGKILL the wedged engine). |
| POST `/api/sessions/:id/pairing-code` | OPERATOR | Request an 8-char pairing code to link via phone number (alternative to QR). |
| POST `/api/sessions/:id/chats/read` | OPERATOR | Mark a chat as read/seen. |
| POST `/api/sessions/:id/chats/unread` | OPERATOR | Mark a chat as unread. |
| POST `/api/sessions/:id/chats/delete` | OPERATOR | Delete a chat from the chat list. |
| POST `/api/sessions/:id/chats/typing` | OPERATOR | Send a typing/recording presence indicator (or clear with `paused`). |
| DELETE `/api/sessions/:id` | OPERATOR | Delete a session. |

## Messages (`/api/sessions/:sessionId/messages`)

| Method & Path | What it does |
|---|---|
| GET `/messages` | Persisted message history from the local DB (paginated, filterable) — does not hit WhatsApp. |
| GET `/messages/:chatId/history` | Live chat history fetched from WhatsApp, bypassing the local DB. |
| GET `/messages/:chatId/:messageId/reactions` | Reactions for a message, grouped by emoji with senders. |
| GET `/messages/batch/:batchId` | Processing status/progress of a bulk batch. |
| POST `/messages/send-text` | Send plain text. Body: `{ chatId, text (max 4096), mentions? }`. `chatId` = `phone@c.us` or `groupId@g.us`. |
| POST `/messages/send-template` | Render a stored template (`{{vars}}` substituted) and send as text. |
| POST `/messages/send-image` | Send an image (URL or base64) with optional caption. |
| POST `/messages/send-video` | Send a video (URL or base64) with optional caption. |
| POST `/messages/send-audio` | Send audio. Set `ptt: true` for a real voice-note bubble (needs `audio/ogg; codecs=opus`, especially on Baileys which doesn't transcode). |
| POST `/messages/send-document` | Send a document/file (URL or base64). |
| POST `/messages/send-location` | Send a location pin. |
| POST `/messages/send-contact` | Send a contact card (vCard). |
| POST `/messages/send-sticker` | Send a sticker (URL or base64, typically webp). |
| POST `/messages/send-poll` | Send a native WhatsApp poll. |
| POST `/messages/reply` | Reply to a message, quoting a prior message. |
| POST `/messages/forward` | Forward a message from one chat to another. |
| POST `/messages/react` | Add/remove a reaction (empty emoji removes it). |
| POST `/messages/delete` | Delete a message for everyone; flags the stored record `revoked`. |
| POST `/messages/edit` | Edit the text of a message this account sent. |
| POST `/messages/send-bulk` | Async batch send, max 100 items, returns `202` immediately. See below. |
| POST `/messages/batch/:batchId/cancel` | Cancel a pending/processing bulk batch. |

All send-* routes require `OPERATOR`. Media DTOs accept `{ url? | base64?, mimetype?, filename? }`; a `201` response means the engine accepted the send, not that WhatsApp delivered it — track delivery via `message.ack` webhooks/websocket.

**Bulk send** body shape:
```json
{
  "messages": [
    { "chatId": "628111111111@c.us", "type": "text", "content": { "text": "Hi {{name}}" }, "variables": { "name": "Alice" } },
    { "chatId": "628222222222@c.us", "type": "image", "content": { "image": { "url": "https://example.com/promo.jpg" }, "caption": "Promo" } }
  ],
  "options": { "delayBetweenMessages": 3000, "randomizeDelay": true, "stopOnError": false }
}
```
`delayBetweenMessages` is clamped 1000–60000ms (default 3000). Max 100 items/batch; duplicate `chatId`s collapse to first occurrence. Use this pacing rather than looping `send-text` yourself — see the safety guardrails in SKILL.md.

## Contacts (`/api/sessions/:sessionId/contacts`)

| Method & Path | What it does |
|---|---|
| GET `/contacts` | List all contacts (in-memory paginated window). |
| GET `/contacts/check/:number` | Check whether a number exists on WhatsApp; returns its canonical WA id if so. |
| GET `/contacts/:contactId` | Get a single contact. |
| GET `/contacts/:contactId/profile-picture` | Profile picture URL for a contact (best-effort). |
| GET `/contacts/profile-pictures` | Batch-resolve profile pictures for many contacts in one call. |
| GET `/contacts/:contactId/phone` | Resolve a contact id (e.g. `@lid`) to a phone number, best-effort. |
| POST `/contacts/:contactId/block` | Block a contact. |
| DELETE `/contacts/:contactId/block` | Unblock a contact. |

## Groups (`/api/sessions/:sessionId/groups`)

| Method & Path | What it does |
|---|---|
| GET `/groups` | List all groups (paginated). |
| GET `/groups/:groupId` | Detailed group info including participants. |
| GET `/groups/:groupId/invite-code` | Get invite code + full invite link. |
| POST `/groups` | Create a group with initial participants. |
| POST `/groups/:groupId/participants` | Add participants. |
| DELETE `/groups/:groupId/participants` | Remove participants (DELETE with a JSON body). |
| POST `/groups/:groupId/participants/promote` | Promote participants to admin. |
| POST `/groups/:groupId/participants/demote` | Demote participants from admin. |
| PUT `/groups/:groupId/subject` | Change group name/subject. |
| PUT `/groups/:groupId/description` | Change description (empty string clears it). |
| POST `/groups/:groupId/leave` | Leave a group. |
| POST `/groups/:groupId/invite-code/revoke` | Revoke and regenerate the invite code. |
| POST `/groups/join` | Join via invite code (the part after `chat.whatsapp.com/`). |
| GET `/groups/:groupId/settings` | Read admin-only settings + disappearing-message timer. |
| PUT `/groups/:groupId/settings` | Update settings (caller must be a group admin). |

## Message Templates (`/api/sessions/:sessionId/templates`)

CRUD for reusable templates with `{{variable}}` placeholders: `GET /templates`, `GET /templates/:id`, `POST /templates`, `PUT /templates/:id`, `DELETE /templates/:id`.

## Catalog & Channels (`/api/sessions/:sessionId/...`)

| Method & Path | What it does |
|---|---|
| GET `/catalog` | Business catalog info for the account. |
| GET `/catalog/products` | List catalog products (paginated). |
| GET `/catalog/products/:productId` | A specific product. |
| POST `/messages/send-product` | Send a product card to a chat. |
| POST `/messages/send-catalog` | Send the business catalog link. |
| GET `/channels` | Subscribed channels/newsletters. |
| GET `/channels/:channelId` | A single channel. |
| GET `/channels/:channelId/messages` | Recent messages from a channel. |
| POST `/channels/subscribe` | Subscribe via invite code. |
| DELETE `/channels/:channelId` | Unsubscribe. |

## Labels & Status/Stories (`/api/sessions/:sessionId/...`)

| Method & Path | What it does |
|---|---|
| GET `/labels` | List labels (WhatsApp Business accounts only). |
| GET `/labels/:labelId` | A single label. |
| GET `/labels/chat/:chatId` | Labels assigned to a chat. |
| POST `/labels/chat/:chatId` | Add a label to a chat. |
| DELETE `/labels/chat/:chatId/:labelId` | Remove a label from a chat. |
| GET `/status` | Contact status updates (stories) visible to the session (24h TTL store). |
| GET `/status/:contactId` | Status updates from a specific contact. |
| GET `/status/:statusId/media` | Stream a stored status's media bytes. |
| POST `/status/send-text` \| `/send-image` \| `/send-video` | Post a status/story. Recipients allow-list honored on Baileys only; whatsapp-web.js broadcasts per account's status-privacy audience. |
| DELETE `/status/:statusId` | Delete one of the session's own posted statuses. |

## Webhooks (management) — see `references/webhooks.md` for payload/HMAC/event details

| Method & Path | What it does |
|---|---|
| GET `/api/sessions/:sessionId/webhooks` | List webhooks for a session. |
| GET `/api/sessions/:sessionId/webhooks/:id` | A single webhook. |
| GET `/api/webhooks` | List webhooks visible to the calling key across its allowed sessions. |
| GET `/api/webhooks/delivery-failures` | Dead-letter trail: deliveries that exhausted every retry. |
| POST `/api/sessions/:sessionId/webhooks` | Create a webhook. Body: `{ url, events?, secret?, headers?, filters?, retryCount? }`. Max `WEBHOOK_MAX_PER_SESSION` (default 16) per session. |
| PUT `/api/sessions/:sessionId/webhooks/:id` | Partial update — only fields present change. |
| POST `/api/sessions/:sessionId/webhooks/:id/test` | Send a synthetic test payload and report the result. |
| DELETE `/api/sessions/:sessionId/webhooks/:id` | Delete a webhook. |

## API Keys (`/api/auth`) — ADMIN only unless noted

| Method & Path | What it does |
|---|---|
| GET `/api/auth/api-keys` | List all keys, newest first. Plaintext never returned. |
| GET `/api/auth/api-keys/:id` | A single key's details. |
| POST `/api/auth/api-keys` | Create a key; returns the full **plaintext key exactly once**. |
| PUT `/api/auth/api-keys/:id` | Update mutable fields (not `isActive` — use revoke). |
| POST `/api/auth/api-keys/:id/revoke` | Revoke without deleting. |
| DELETE `/api/auth/api-keys/:id` | Hard delete. |
| POST `/api/auth/validate` | (any key) Validate the supplied key and report validity + role. |

## System (`/api/health`, `/api/metrics`, `/api/stats`, `/api/settings`, `/api/audit`)

| Method & Path | What it does |
|---|---|
| GET `/api/health` (public) | Basic health check: status, timestamp, app version. |
| GET `/api/health/live` (public) | K8s liveness probe — process liveness only, no dependency checks. |
| GET `/api/health/ready` (public) | Readiness probe — checks DB datasources respond to `SELECT 1`; `503` while draining. |
| GET `/api/metrics` | Prometheus scrape; gated by `METRICS_TOKEN` bearer (disabled if unset). |
| GET `/api/stats/overview` | Cross-session aggregate stats. |
| GET `/api/stats/messages` | Message stats: time series, by type, by session, top chats. |
| GET `/api/stats/sessions/:sessionId` | Stats for one session incl. 24h hourly activity. |
| GET `/api/settings` | Application settings (env-derived). |
| PUT `/api/settings` | Not implemented — always `501` (settings are read-only at runtime). |
| GET `/api/audit` | Audit-log entries, newest first (key lifecycle, session/message/webhook events, ADMIN infra ops). |

## Administration (`/api/infra`, `/api/plugins`) — ADMIN only

Infra: `GET /infra/health`, `GET /infra/status`, `GET /infra/engines`, `GET /infra/engines/current`, `GET /infra/config`, `PUT /infra/config`, `POST /infra/restart`, `GET /infra/export-data`, `POST /infra/import-data` (destructive, transactional), `GET /infra/storage/files/count`, `GET /infra/storage/export`, `POST /infra/storage/import`.

Plugins: `GET /plugins`, `GET /plugins/catalog`, `GET /plugins/:id`, `GET /plugins/:id/config-ui`, `GET /plugins/:id/health`, `POST /plugins/install` (zip upload), `POST /plugins/install-url` (HTTPS only, SSRF-guarded, 5MB cap), `POST /plugins/:id/enable`, `POST /plugins/:id/disable`, `PUT /plugins/:id/config`, `PUT /plugins/:id/config/:sessionId`, `PUT /plugins/:id/sessions` (full-replacement activation set), `POST /plugins/:id/update`, `DELETE /plugins/:id`.

Official plugins (Chatwoot, Typebot, etc.) live at [OpenWA-plugins](https://github.com/rmyndharis/OpenWA-plugins).

## MCP transport

`POST /mcp` — see `references/mcp.md`.

## Search

`GET /api/search` (OPERATOR+) — cross-session full-text search. Query params: `q` (required), `sessionId?`, `chatId?`, `direction?`, `type?`, `from?`, `dateFrom?`/`dateTo?` (epoch ms), `limit?` (default 50, capped by `SEARCH_LIMIT_MAX`), `offset?`. A scoped key's `allowedSessions` is enforced server-side and cannot be widened via query params.

## Profile (own account)

`PUT /api/sessions/:sessionId/profile/name` (max 25 chars) · `PUT /profile/status` (max 139 chars, empty clears it) · `PUT /profile/picture` (URL or base64).

## Calls

`POST /api/sessions/:sessionId/calls/:callId/reject` — reject a currently ringing call; the id is only valid while ringing.
