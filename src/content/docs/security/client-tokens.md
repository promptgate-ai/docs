---
title: Client Tokens
description: Bearer tokens with scopes — pg_live_ / pg_test_, SHA-256 hashed, project-scoped, rotatable.
---

API tokens are how clients authenticate to PromptGate's public API. They're **project-scoped**, **scope-tagged**, and **SHA-256 hashed** at rest.

## Token format

```
pg_live_a1b2c3d4e5f6789...
└─┬──┘
  │
  └── Environment prefix
```

| Prefix | Environment | Use |
|---|---|---|
| `pg_live_` | `live` | Production |
| `pg_test_` | `test` | Testing / staging / dev |

The prefix is purely a hint for humans (and log scanners). Both formats route through the same auth path.

## Scopes

A token carries a list of scopes. The required scope per route:

| Route group | Required scope |
|---|---|
| AI Gateway endpoint exec (`POST /api/{uuid}/{slug}`) | `chat` |
| AI Gateway chat completions (`POST /api/{uuid}/chat/completions`) | `chat` |
| AI Wrapper (`POST /api/{uuid}/v1/chat/completions`, `GET /api/{uuid}/v1/models`) | `chat` |
| Models discovery (`GET /api/{uuid}/models`) | `models` |
| Admin / introspection (`GET /api/{uuid}/info`, `/endpoints`, `/tokens`) | `admin` |
| Control Plane (`POST /api/control/mcp`) | `admin` |
| API Gateway proxy (`ANY /api/{uuid}/proxy/...`) | `proxy` |
| MCP (`POST /api/{uuid}/mcp`) | `mcp` |

A token can have **any combination** of scopes. The middleware checks that the token has the scope required by the route — anything else is irrelevant.

| Token scopes | Can hit `/chat` | Can hit `/v1/models` | Can hit `/info` |
|---|---|---|---|
| `[chat]` | ✅ | ❌ | ❌ |
| `[chat, models]` | ✅ | ✅ | ❌ |
| `[admin]` | ❌ | ❌ | ✅ |
| `[chat, admin]` | ✅ | ❌ | ✅ |

## Creating a token

Project sidebar → **API Tokens** → **+ New token**.

![Token create — placeholder](#)

| Field | Notes |
|---|---|
| **Name** | Descriptive — `Mobile App Prod`, `nightly-batch`, etc. |
| **Environment** | `live` or `test`. Tags the token for log filtering and prefix. |
| **Scopes** | Tick the scopes the token will need. Principle of least privilege. |

After save, the **plaintext token is shown ONCE** in a yellow banner with a copy button.

:::caution[Once-only display]
PromptGate stores the SHA-256 hash and **discards the plaintext**. There is no recovery — if you lose it, rotate the token to mint a new plaintext (same row, new hash, old plaintext invalid).
:::

## Storage

```
api_tokens
├── token_hash       SHA-256(plaintext) — what we compare against
├── token_prefix     "pg_live_a1b2…" — short preview shown in UI
├── env              "live" | "test"
├── scopes           ["chat", "models"]
├── last_used_at     updated on every successful auth
├── is_active        false = revoked
└── project_id       FK
```

Why SHA-256 and not bcrypt? Tokens are random 32-byte strings — entropy ~256 bits. bcrypt's slowness defends against weak passwords; tokens don't have that problem. SHA-256 is constant-time-comparable and fast enough to authenticate every request.

## Project scoping

A token belongs to **exactly one project**. The middleware resolves the token, then enforces:

- The URL's `{uuid}` matches the token's `project_id` → 403 if not.
- The required scope is in the token's scopes → 403 if not.

So a `chat`-scoped token from Project A cannot hit Project B's `/api/B/...` even if the URL is correct.

## Listing tokens

Project sidebar → **API Tokens** shows:

- Name, prefix, env
- Scopes (chips)
- `last_used_at`
- Active / revoked status
- Rotate / Revoke / Edit actions

The **Edit** action lets you rename the token and adjust scopes. The plaintext is **not** shown — you can change scopes without seeing the secret.

## Rotating

Click **Rotate** on a token row.

- A fresh plaintext is generated.
- The hash is updated; the old plaintext is now invalid.
- The new plaintext is shown once.
- All other fields (name, scopes, env, last_used_at) are preserved.

Useful when you suspect a token has leaked but want to keep the row + audit history.

## Revoking

Click **Revoke**. Sets `is_active = false`. The token is rejected on the next request with a 401.

Revoking is **soft** (the row stays for audit). To delete entirely, use Tinker:

```php
\App\Models\ApiToken::query()->where('id', 42)->delete();
```

## Token API surface

For programmatic introspection (admin scope):

```http
GET /api/{uuid}/tokens
Authorization: Bearer <admin-scoped-token>
```

Returns each token's metadata (no plaintexts):

```json
{
  "ok": true,
  "data": [
    {
      "id": 7,
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

## Audit

Every token CRUD action writes to `audit_logs`:

- `token.created`
- `token.rotated`
- `token.revoked`
- `token.deleted`

Every successful authentication touches `last_used_at` but does NOT write an audit row (would be too noisy for high-traffic gateways). Auth failures DO write — `auth.token_invalid`, `auth.token_revoked`, `auth.scope_missing`.

## Programmatic provisioning

The **MCP Control Plane** has tools for token CRUD — useful for automation:

- `pg_create_token(project_uuid, name, scopes, env)` → returns plaintext once
- `pg_rotate_token(token_id)` → returns new plaintext, invalidates old
- `pg_revoke_token(token_id)`

See **[Control Plane API](/api/control-plane/)**.

## Best practices

- **Issue narrow tokens** — give a Mobile App a `[chat]` token, not `[chat, admin, mcp]`.
- **Per-environment** — separate tokens for dev / staging / prod, prefixed appropriately.
- **Per-application** — one token per consuming app makes revocation surgical.
- **Rotate quarterly** — even uncompromised tokens should age out.
- **Watch `last_used_at`** — tokens unused for 90+ days are candidates for revocation.
- **Don't log them** — though they're hashed in DB, anyone with the plaintext gets in.

---

Next: **[Guardrails](/security/guardrails/)**.

---

> © Akyros Labs LLC. All rights reserved.
