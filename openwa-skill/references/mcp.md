# OpenWA MCP Server (AI Agents)

OpenWA can expose a curated set of tools over the Model Context Protocol so agents (Claude, Cursor, etc.) can drive WhatsApp directly, without the agent hand-rolling REST calls. It's off by default and purely additive — every REST route keeps working unchanged.

## Enabling it

```bash
MCP_ENABLED=true npm run start:prod   # or set MCP_ENABLED=true in .env / docker-compose
```

This mounts a stateless Streamable-HTTP JSON-RPC 2.0 transport at **`POST /mcp`** — note: no `/api` prefix, it's mounted straight on Express, not through the Nest controller layer.

- **Read-only by default.** Only read-tier tools are registered unless `MCP_READONLY=false` — set that only when the agent genuinely needs to send messages or mutate state.
- ~39 curated tools (sessions, messaging, contacts, basic group ops, webhook reads) — a focused surface, not the full REST API, so agents aren't overwhelmed and destructive operations stay off the agent path by default.
- Per-key rate limit: `MCP_RATE_LIMIT_MAX` (default 60) per `MCP_RATE_LIMIT_WINDOW_MS` (default 60000).
- Pre-auth per-IP throttle: `MCP_IP_RATE_LIMIT_MAX` (default 120) / `MCP_IP_RATE_LIMIT_WINDOW_MS` (default 60000).

## Connecting a client

For Claude Code, add a `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "openwa": {
      "type": "http",
      "url": "http://localhost:2785/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

The key can be sent as `Authorization: Bearer <key>` or `X-Api-Key: <key>`. Auth is enforced **per tool call inside the MCP layer**, not by the global Nest guard — so an auth failure surfaces in-band as an `isError:true` result, not an HTTP `401`. Every tool call goes through the same API-key auth, role, and per-session scoping as REST.

## Raw JSON-RPC shape (for building a custom client)

```json
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "session_send_text", "arguments": { "sessionId": "default", "to": "6281234567890", "text": "Hello from MCP" } } }
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": { "content": [ { "type": "text", "text": "{\"success\":true,\"messageId\":\"…\"}" } ] }
}
```

Methods: `initialize`, `tools/list`, `tools/call`, plus standard MCP lifecycle methods. Unknown method → `-32601`. Invalid params/unknown tool → `-32602`. Parse error → `-32700`. All JSON-RPC errors ride on HTTP `200`; a `500` only happens if the transport throws before headers are sent; `404` if `MCP_ENABLED` isn't `true`.

## Security guidance (from the maintainers)

- **Mint a dedicated, least-privilege key for the agent** — a non-admin, **session-scoped** key, `OPERATOR` role at most. The plaintext key is shown only once at creation (`POST /api/auth/api-keys`); to rotate, create a new one and revoke/delete the old.
- The key **must not** carry an `allowedIps` restriction — there's no genuine client IP over MCP, so such a key is rejected outright.
- Set `MCP_READONLY=true` to mount only read tools (no sends/writes) for observer-style agents.
- **Do not expose `/mcp` to the public internet** without a fronting auth proxy. For a self-hosted, locally-reached deployment the static API key is appropriate; public exposure should use OAuth 2.1 (not yet built into OpenWA).

Full tool catalog (names, tiers, zod schemas) lives in the repo's `docs/24-mcp-integration.md` — fetch it from the running instance or the repo if you need exact tool names/schemas beyond `tools/list`.
