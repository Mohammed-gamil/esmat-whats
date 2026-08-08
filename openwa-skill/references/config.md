# OpenWA Configuration Reference

Precedence: `process environment` > `.env` > `data/.env.generated` (dashboard-managed). Anything you uncomment in `.env` **pins** that setting — the dashboard control keeps moving/saving but the running value never changes. Copy `.env.example` to `.env` and only uncomment what you intend to manage by hand.

## Core

| Var | Default | Notes |
|---|---|---|
| `PORT` / `API_PORT` | `2785` | `PORT` is the bind port (bare metal); `API_PORT` is the Docker Compose host-side mapping. |
| `LOG_LEVEL` | `info` | `error \| warn \| info \| debug` |
| `AUTO_START_SESSIONS` | `false` (prod compose) | Auto-start previously authenticated sessions on boot. Good for single-instance prod; risky for multi-replica (double-resurrect → forced logout/ban). |
| `MAX_CONCURRENT_SESSIONS` | `0` (unlimited) | Cap on concurrently running/initializing sessions. |
| `DOMAIN`, `BASE_URL`, `DASHBOARD_URL` | — | Public URL config for banners/external access. |
| `CORS_ORIGINS` | `*` | Wildcard only allowed in dev; production refuses `*` — set explicit origins. |

## Engine (whatsapp-web.js vs Baileys)

| Var | Notes |
|---|---|
| `ENGINE_TYPE` | `whatsapp-web.js` (default, via dashboard) or `baileys`. Setting it here always wins over the dashboard selection. |
| `PUPPETEER_EXECUTABLE_PATH` | Path to system Chromium — required in the Docker image and on hosts without a bundled browser (Alpine/ARM). |
| `PUPPETEER_ARGS` | **Replaces** the default flag list rather than adding to it — keep `--no-sandbox` or Chromium won't launch in a container. |
| `SIMULATE_TYPING` | `true` by default — shows "typing…" and pauses briefly before single text sends (anti-ban humanizing). `SIMULATE_TYPING_MAX_MS` caps the pause (default 5000). Doesn't affect bulk sends (those use `delayBetweenMessages`). |
| `BAILEYS_MARK_ONLINE_ON_CONNECT` | `true` by default — suppresses phone push notifications while the gateway is connected. Set `false` to keep the linked phone's notifications working for a 24/7 gateway. |
| `BAILEYS_SYNC_FULL_HISTORY` | `false` by default — pulling full history on connect is expensive. |
| `RESOLVE_LID_TO_PHONE` | `false` by default — attach best-effort `senderPhone` when a sender is identified by `@lid` instead of a phone number. |

Resource ceilings (Docker Compose only): `OPENWA_MEM_LIMIT` (default `2g` — raise for multi-session `whatsapp-web.js`, which runs a full Chromium per session; Baileys is far lighter), `OPENWA_PIDS_LIMIT` (default `2048`).

## Database

| Var | Notes |
|---|---|
| `DATABASE_TYPE` | `sqlite` (zero-config default) or `postgres`. |
| `DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD` | Postgres only. `DATABASE_PASSWORD` has no default — production refuses to start with an empty/placeholder value when using Postgres. |
| `DATABASE_SYNCHRONIZE` | **Must be `false` in production.** |
| `DATABASE_SSL` | `true` for managed Postgres (Supabase/Heroku/Render/Railway). |

## Storage

`STORAGE_TYPE`: `local` (default) or `s3` (works with MinIO too — set `S3_ENDPOINT` for any S3-compatible store; leave unset for real AWS S3). `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` have no defaults — production refuses to start with empty/placeholder values when `STORAGE_TYPE=s3`. **Message media is returned inline to API/webhook consumers; it is not automatically persisted to the storage backend** unless you're relying on the DB-cached copy.

## Webhooks

| Var | Default | Notes |
|---|---|---|
| `WEBHOOK_TIMEOUT` | `10000` ms | Per-delivery timeout before it counts as failed. |
| `WEBHOOK_RETRY_DELAY` | `5000` ms | Exponential-backoff base between retries. |
| `WEBHOOK_MAX_PER_SESSION` | `16` | New registrations at/over the cap get `400`; existing ones are grandfathered. |
| `WEBHOOK_SSRF_PROTECT` | `true` | Blocks webhook URLs resolving to internal/private/loopback ranges. Only disable on closed networks. |
| `WEBHOOK_MEDIA_INLINE_MAX_BYTES` | `1048576` (1 MiB) | Media over this is sent as an `omitted` marker instead of inline base64. `0` = never inline. |
| `WEBHOOK_CONTACT_DETAILS` | `false` | Opt into the full sender `contact` object on `message.received` instead of just `{ name, pushName }`. |

## Rate limiting (anti-ban relevant)

`RATE_LIMIT_MEDIUM_TTL`/`_LIMIT` (default 60000ms / 100 req), `RATE_LIMIT_SHORT_TTL`/`_LIMIT` (1000ms / 10 req burst), `RATE_LIMIT_LONG_TTL`/`_LIMIT` (3600000ms / 1000 req). These bound the REST API itself — the send-bulk endpoint's own `delayBetweenMessages` option is the primary anti-ban pacing lever for actual message throughput (see `references/endpoints.md`).

## MCP

`MCP_ENABLED` (off by default), `MCP_READONLY` (`true` recommended for observer agents), `MCP_RATE_LIMIT_MAX`/`_WINDOW_MS`, `MCP_IP_RATE_LIMIT_MAX`/`_WINDOW_MS`. See `references/mcp.md`.

## Security

| Var | Notes |
|---|---|
| `API_MASTER_KEY` | Leave empty to disable, or set a secure value. |
| `API_KEY_PEPPER` | Optional HMAC-SHA256 pepper for API-key hashing — recommended in production. **Setting/changing it invalidates all existing key hashes**; re-issue keys after enabling. |
| `METRICS_TOKEN` | Set to enable `GET /api/metrics`; scrapers send `Authorization: Bearer <token>`. Unset = disabled. |
| `ENABLE_SWAGGER` | `true` by default — set `false` to disable `/api/docs` on exposed deployments. |

## Ports summary

| Service | Port |
|---|---|
| API & Dashboard (production, bundled) | `2785` |
| Swagger | `2785/api/docs` |
| Dashboard (dev, Vite hot reload) | `2886` |

Full annotated list: the repo's `.env.example` is the single source of truth and documents every variable inline — fetch it directly when you need something not covered here.
