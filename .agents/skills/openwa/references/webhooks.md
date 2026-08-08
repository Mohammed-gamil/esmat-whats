# OpenWA Webhooks

The intended way to receive events (inbound messages, delivery receipts, session status, group changes, calls, stories) — poll the REST API only for on-demand lookups, not for "new message" detection.

## Registering a webhook

```bash
curl -X POST http://localhost:2785/api/sessions/{sessionId}/webhooks \
  -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["message.received", "session.status"],
    "secret": "your-hmac-secret",
    "retryCount": 3
  }'
```

Requires `OPERATOR`. Fields: `url` (required, SSRF-guarded — private/loopback/internal targets are rejected at registration, not just delivery), `events` (defaults to `["message.received"]`; use `"*"` for everything), `secret` (write-only, used to sign deliveries), `headers` (write-only custom headers, ≤50 entries; `Content-Type` and any `X-OpenWA-*` name is stripped to prevent forging signature/idempotency headers), `filters` (optional AND pre-filter, see below), `retryCount` (0–5, default 3). Max `WEBHOOK_MAX_PER_SESSION` webhooks per session (default 16; existing ones above a lowered cap are grandfathered).

## Smart filters (optional pre-dispatch conditions)

All conditions must match (AND) for the webhook to fire:

```json
{
  "conditions": [
    { "field": "sender", "operator": "is", "value": ["1234567890@c.us"] },
    { "field": "body", "operator": "contains", "value": "invoice" }
  ]
}
```

Fields: `sender`, `recipient`, `body`, `type`, `mentions`, `fromMe`, `hasMedia`, `isGroup`. Operators: `is`, `isNot`, `contains`, `equals`. Max 20 conditions, 100 values/condition, 1000-char text values. Omit/null `filters` = fire on every subscribed event.

## Delivery payload shape

Every delivery is an HTTP `POST` with this envelope:

```json
{
  "event": "message.received",
  "timestamp": "2026-02-02T10:00:00.000Z",
  "sessionId": "my-session",
  "idempotencyKey": "msg_my-session_3EB0ABC123",
  "deliveryId": "dlv_550e8400-e29b-41d4-a716-446655440000",
  "data": { }
}
```

The same values are mirrored into headers. The HMAC signature is **not** in the body — it's in the `X-OpenWA-Signature` header.

| Header | Meaning |
|---|---|
| `X-OpenWA-Event` | Event name |
| `X-OpenWA-Idempotency-Key` | Content-derived, stable across retries of the same occurrence — dedupe on this |
| `X-OpenWA-Delivery-Id` | Fresh per delivery attempt — for tracing, not dedup |
| `X-OpenWA-Retry-Count` | `0` = first attempt |
| `X-OpenWA-Signature` | `sha256=<hex>` HMAC (only present if a `secret` was set) |

## Verifying the HMAC signature

Compute over the **raw request body bytes**, not a re-serialized parse, and compare in constant time:

```javascript
const crypto = require('crypto');

function verify(rawBody, header, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```

If your framework auto-parses JSON before you can access the raw bytes, configure it to preserve the raw body for this route (e.g. Express `express.raw()` on the webhook path, or a `verify` callback in `body-parser`/`express.json()`).

## Delivery semantics — at-least-once

A consumer can legitimately receive the same logical event more than once (engine re-fires, retried failed deliveries). **Design your handler to be idempotent, keyed on `X-OpenWA-Idempotency-Key`.** OpenWA does best-effort server-side de-dup of inbound `message.received` before dispatch, but that's defense-in-depth, not a substitute.

On failure (non-2xx, timeout — default `WEBHOOK_TIMEOUT` 10000ms, or network error), OpenWA retries up to the webhook's `retryCount` with exponential backoff from `WEBHOOK_RETRY_DELAY` (default 5000ms). Deliveries that exhaust every retry land in `GET /api/webhooks/delivery-failures` instead of vanishing.

## Event catalog

| Event | Fires when | `data` payload sketch |
|---|---|---|
| `message.received` | Inbound message arrives | Full message object: `id`, `from`, `to`, `body`, `type`, `timestamp` (epoch **seconds**), `isGroup`, `kind`, `hasMedia`, `contact{…}` |
| `message.sent` | Outbound message created/sent | Same shape as `message.received` |
| `message.ack` | Delivery/read receipt updates | `{ id, messageId, status, ack }` — `status` ∈ `pending/sent/delivered/read/failed` |
| `message.failed` | Receipt resolves to failed (fires alongside `message.ack`) | `{ id, messageId, status: "failed", ack: -1 }` |
| `message.revoked` | Message deleted/recalled | `{ id, revokedId?, chatId, from, to, type:"revoked", body:"", timestamp }` — reconcile on `revokedId`, fall back to `id` |
| `message.reaction` | Reaction added/changed/removed | `{ messageId, chatId, reaction, senderId, reactions }` — empty `reaction` = removed |
| `message.edited` | Message body/caption edited | `{ messageId, chatId, body, senderId, ..., timestamp }` (edit time, epoch seconds) |
| `session.qr` | New pairing QR generated | `{ sessionId, qr }` |
| `session.authenticated` | Session pairs and becomes ready | `{ sessionId, phone, pushName }` |
| `session.disconnected` | Session drops (not fired for API-initiated stop/logout/delete) | `{ sessionId, reason }` |
| `session.reconnect_loop` | Every 5th consecutive reconnect attempt | `{ sessionId, attempts, nextDelayMs }` |
| `session.status` | Status transitions | `{ sessionId, status }` |
| `group.join` / `group.leave` | Participants added/removed | `{ groupId, actorId?, participantIds, timestamp }` |
| `group.update` | Group metadata changes | `{ groupId, actorId?, participantIds, changes?, timestamp }` |
| `call.received` | Incoming call starts ringing | `{ callId, from, isVideo, isGroup, timestamp }` |
| `status.received` | Contact posts a story — **opt-in, must be explicitly subscribed** | `{ sessionId, statusId, contact, type, caption?, hasMedia, mediaOmitted, postedAt, expiresAt }` (epoch **milliseconds**) — no media blob; fetch via the status media endpoint |

There is no `contact.update`, `presence.update`, or `call.accepted`/`call.terminated` event.

## Media in webhook payloads

Media over `WEBHOOK_MEDIA_INLINE_MAX_BYTES` (default 1 MiB; `0` = never inline) is replaced with `media: { mimetype, filename?, omitted: true, sizeBytes }` before delivery. Fetch the actual bytes afterward via `GET /api/sessions/:sessionId/messages/:chatId/history?includeMedia=true`.

## Real-time alternative: WebSocket (Socket.IO)

Instead of/alongside webhooks, subscribe over **Socket.IO** (not a raw WebSocket) at namespace `/events`, same port as the REST API: `ws://<host>:2785/events`. Useful for a dashboard-style live feed instead of running an HTTP receiver.

**Auth:** handshake `auth: { apiKey }` (recommended) or `x-api-key` header — no query-param fallback. Missing/invalid key → `error` message with `code: "UNAUTHORIZED"`, then disconnect. The key is **re-validated on every subscribe**, and a session-scoped key can't subscribe to `"*"` or a session outside its `allowedSessions` (`FORBIDDEN_SESSION`).

Client commands go out on the Socket.IO event named `message`, flat envelope `{ type, sessionId, events, requestId }` where `type` is `subscribe` | `unsubscribe` | `ping`. Server replies and pushed events also arrive on `message`. Pushed events use a **nested** envelope (`data` lives under `payload`, no `requestId`):

```js
import { io } from 'socket.io-client';

const socket = io('ws://localhost:2785/events', { auth: { apiKey: process.env.OPENWA_API_KEY } });

socket.on('connect', () => {
  socket.emit('message', {
    type: 'subscribe',
    sessionId: 'main',        // or "*" for all sessions
    events: ['message.received', 'message.ack', 'session.status'],  // or ["*"]
    requestId: 'sub-1',
  });
});

socket.on('message', (msg) => {
  if (msg.type === 'event') {
    console.log(`[${msg.payload.event}]`, msg.payload.sessionId, msg.payload.data);
  } else {
    console.log('reply:', msg); // subscribed | unsubscribed | pong | error
  }
});
```

Subscribable event names are the same catalog above **except** `message.failed` and `session.reconnect_loop`, which are webhook-only.
