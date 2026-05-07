---
title: Management API
description: Programmatic admin surface for minting per-end-user tokens, rotating them, and revoking them. Bearer-authenticated, gated by an explicit kill-switch in admin settings.
---

The Management API lets your application **mint, rotate, and revoke** PromptGate API tokens programmatically — typically one token per end-user of your downstream app, so each user gets isolated logs, budgets, and rate limits.

## The threat model

The flow is the same one Stripe / Auth0 / OpenAI use:

1. A long-lived **bootstrap token** with the `tokens:write` scope lives **on your server** (env var, secrets manager). Never in browser code, never in mobile clients.
2. Your server calls `POST /api/{uuid}/admin/tokens` with the bootstrap token and gets back a fresh **per-user token** with narrow scopes.
3. Your server hands the per-user token to the client. The bootstrap token never leaves the server.

If a per-user token leaks, you revoke that one (via `DELETE /api/{uuid}/admin/tokens/{tokenUuid}`) and continue. If the bootstrap leaks, you rotate it from the UI immediately and audit-log the blast radius.

## Two kill-switches

**`Settings → Management API`** in the user menu has two checkboxes:

- **Management REST API** — gates the `/api/{uuid}/admin/*` REST endpoints.
- **MCP Control Plane** — gates the `POST /api/control/mcp` JSON-RPC surface.

Both default **off**. Self-hosting admins consciously enable the surface they want before any traffic can hit it.

## Scopes

Six runtime scopes drive request handling:

| Scope | Purpose |
|---|---|
| `chat` | Execute AI Gateway endpoints |
| `models` | List models |
| `proxy` | Forward through API Gateway endpoints |
| `mcp` | Speak MCP/JSON-RPC over the bridge or gateway |

Four management scopes drive the admin surface:

| Scope | Purpose |
|---|---|
| `admin` | Legacy: full access (still supported, but prefer granular scopes) |
| `tokens:write` | Create, rotate, revoke API tokens |
| `endpoints:write` | Create, update, deactivate endpoints |
| `credentials:read` | List credentials (no plaintext) |

Privilege-escalation rule: a caller can only mint **management** scopes it already owns. Runtime scopes (`chat`, `models`, `proxy`, `mcp`) can be issued freely by any `tokens:write` caller. So a `tokens:write` token can mint user tokens with `chat` access — but it **can't** mint another `tokens:write` token unless its caller has `admin`.

## Endpoints

### Create a token

```http
POST /api/{projectUuid}/admin/tokens
Authorization: Bearer pg_live_<bootstrap-token>
Content-Type: application/json

{
  "name": "user-1842 prod token",
  "env": "live",
  "scopes": ["chat"],
  "subject_id": "user_1842"
}
```

```json
201 Created
{
  "ok": true,
  "data": {
    "token": "pg_live_<plaintext-shown-once>",
    "uuid": "1f4d…",
    "name": "user-1842 prod token",
    "env": "live",
    "scopes": ["chat"],
    "created_at": "2026-05-07T13:00:00+00:00",
    "note": "Store this token now. It is shown only once."
  }
}
```

`subject_id` is an optional free-form field your application can use to map the token back to one of your users (it's also recorded in the audit entry).

### Rotate

```http
POST /api/{projectUuid}/admin/tokens/{tokenUuid}/rotate
```

Returns `data.token` containing the new plaintext. The old hash is invalidated immediately.

### Revoke

```http
DELETE /api/{projectUuid}/admin/tokens/{tokenUuid}
```

Marks the target token inactive. A token cannot revoke itself — use a different caller (or rotate first).

## Hardening checklist

- Set up an **IP allowlist** on the bootstrap token by deploying it from a known network.
- Subscribe to the **`token.created` audit event** via webhook to monitor unusual issuance volume.
- Use **Anomaly Alerts** on the bootstrap token's projects — a sudden burst of token-creation calls trips the spend or error-rate detector.
- Rotate the bootstrap token every 90 days from the UI.
- Mint per-user tokens with **only the scopes they need** — most app users need only `chat`.

## Audit

Every action writes a row to `audit_logs`:

| Event | Severity | Triggers |
|---|---|---|
| `token.created` | ok | Successful creation |
| `token.rotated` | warn | Rotation |
| `token.revoked` | warn | Revoke |
| `settings.management.api` | warn | Toggle flipped |
| `settings.management.mcp` | warn | Toggle flipped |

Filter `audit_logs` for `via=management_api` to see the programmatically-driven entries.

---

> © Akyros Labs LLC. All rights reserved.
