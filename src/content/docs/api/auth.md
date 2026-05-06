---
title: API Authentication
description: Bearer tokens with scopes — the wire-level reference.
---

Every public API request carries:

```
Authorization: Bearer <token>
```

Where `<token>` is a `pg_live_…` or `pg_test_…` plaintext from project sidebar → API Tokens.

## The `AuthenticateApiToken` middleware

Every protected route is wrapped in this middleware. It:

1. Extracts the bearer token from `Authorization`.
2. Rejects with **401** if missing or wrong format.
3. SHA-256-hashes the plaintext, looks up `api_tokens.token_hash`.
4. Rejects with **401** if not found or `is_active=false`.
5. Checks the route's required scope is in the token's scopes — **403** if not.
6. Touches `last_used_at` (no audit row).
7. Sets `request.attributes.api_token` and `request.attributes.project` for the controller.

## Scope matrix

| Path | Required scope |
|---|---|
| `POST /api/{uuid}/{slug}` | `chat` |
| `POST /api/{uuid}/chat/completions` | `chat` |
| `POST /api/{uuid}/v1/chat/completions` | `chat` |
| `GET /api/{uuid}/v1/models` | `chat` |
| `GET /api/{uuid}/models` | `models` |
| `GET /api/{uuid}/info` | `admin` |
| `GET /api/{uuid}/endpoints` | `admin` |
| `GET /api/{uuid}/tokens` | `admin` |
| `ANY /api/{uuid}/proxy/{slug}/{any?}` | `proxy` |
| `POST /api/{uuid}/mcp` | `mcp` |
| `POST /api/control/mcp` | `admin` |

A token with `[chat, models]` can hit chat completions and the `models` discovery, but **cannot** hit `/info` (no `admin` scope).

## Project scoping

The token's `project_id` must match the URL's `{uuid}`. Cross-project access returns **403**:

```json
{ "ok": false, "error": "Token does not belong to this project." }
```

The MCP Control Plane (`/api/control/mcp`) is **not project-scoped** — the token's project is irrelevant for routing. The token still has to exist (and have `admin` scope), but it can be any project's `admin`-scoped token.

## Failure modes

| Status | Body |
|---|---|
| **401** | `{"ok": false, "error": "Missing Bearer token."}` |
| **401** | `{"ok": false, "error": "Invalid token format."}` |
| **401** | `{"ok": false, "error": "Invalid or revoked token."}` |
| **403** | `{"ok": false, "error": "Missing required scope: 'admin'. Token has: chat."}` |
| **403** | `{"ok": false, "error": "Token does not belong to this project."}` |

## Discovery: `GET /api/{uuid}/info`

Per-project info — a quick "is my token good and scoped to this project?" probe.

```bash
curl $PG_URL/api/$PG_UUID/info \
  -H "Authorization: Bearer $PG_TOKEN"
```

Requires `admin` scope.

```json
{
  "ok": true,
  "data": {
    "id": 7,
    "uuid": "...",
    "name": "Quickstart",
    "project_type": "ai_gateway",
    "env": "prod",
    "endpoints_count": 3,
    "tokens_count": 1
  }
}
```

## Discovery: `GET /api/{uuid}/endpoints`

Lists AI endpoints in the project. Requires `admin` scope.

```json
{
  "ok": true,
  "data": [
    {
      "uuid": "abc-123",
      "name": "Hello World",
      "slug": "hello-world",
      "is_active": true,
      "expose_as_mcp_tool": false
    }
  ]
}
```

For API Gateway / MCP Gateway projects, this returns an empty list — the corresponding inventories live elsewhere (use the Control Plane's `pg_list_endpoints` for those types).

## Discovery: `GET /api/{uuid}/tokens`

Lists tokens for the project, **without plaintexts**. Requires `admin` scope.

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "Mobile App Prod",
      "prefix": "pg_live_a1b2…",
      "env": "live",
      "scopes": ["chat"],
      "is_active": true,
      "last_used_at": "2026-05-06T10:14:22Z"
    }
  ]
}
```

## Discovery: `GET /api/{uuid}/models`

Returns the models exposed by this project. The exact shape depends on project type:

- **AI Wrapper**: aliases + `provider:*` placeholders for enabled providers.
- **AI Gateway**: provider/model pairs configured on active endpoints.
- **Other types**: empty list.

Requires `models` scope.

```json
{
  "object": "list",
  "data": [
    { "id": "fast", "object": "model", "owned_by": "promptgate", "is_alias": true },
    { "id": "openai:*", "object": "model", "owned_by": "promptgate", "is_alias": false }
  ]
}
```

## CORS

The public API does not currently send CORS headers — it's bearer-token gated and intended for server-to-server calls. If you need to call PromptGate from a browser, put your own auth-aware proxy in front. Browser-direct CORS support is roadmap.

---

Next: **[Gateway API](/api/gateway/)**.

---

> © Akyros Labs LLC. All rights reserved.
