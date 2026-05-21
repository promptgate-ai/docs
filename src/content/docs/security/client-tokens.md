---
title: Client Tokens
description: Project-scoped bearer tokens with per-endpoint allowlist, per-token rate + budget caps, deactivate / reactivate flow, and arbitrary operator metadata.
---

API tokens are how external clients authenticate to PromptGate. They are **project-scoped**, **SHA-256 hashed** at rest, and now carry their own **endpoint allowlist**, **rate-limit caps**, **monthly budget cap**, and **arbitrary metadata** independently of the endpoint they call.

## Token format

```
pg_live_a1b2c3d4e5f6789...
└─┬──┘
  │
  └── Static prefix
```

All tokens carry the `pg_live_` prefix. The legacy `pg_test_` mode existed only as a UI hint and has been retired.

## Scope ↔ project type

Scopes are no longer chosen per token in the in-project UI. The project's type determines what the gateway needs:

| Project type | Scope set |
|---|---|
| `ai_gateway`, `ai_wrapper`, `agent_proxy` | `chat`, `models` |
| `api_gateway` | `proxy` |
| `mcp_gateway` | `mcp` |

Management scopes (`admin`, `tokens:write`, `endpoints:write`, `credentials:read`) only apply to tokens minted via the Management API and live under a separate admin surface.

## Endpoint allowlist

Each token can optionally restrict itself to a subset of endpoints in its project:

- **Empty / null** → every endpoint in the project is reachable (permissive default).
- **Set** → only endpoints whose `id` appears in the list. Requests against any other endpoint return `403 Forbidden`.

The allowlist is stored on `api_tokens.endpoint_ids` as a JSON array of ints. The check lives in the gateway controllers right after the endpoint lookup, so it covers slug-based, chat-completions, and wrapper paths uniformly.

## Per-token limits

Seven independent caps can be set per token. **Per-field override semantics**: a field set on the token *replaces* the endpoint's value for that field; `null` falls back to the endpoint default. Never `min()`, never both — a permissive token can grant more headroom than the endpoint, a strict one tightens it.

| Field | Effect |
|---|---|
| `rate_limit_per_minute` | Token-keyed bucket. Returns 429 + `Retry-After` when tripped. |
| `rate_limit_per_hour` | Token-keyed hour bucket. Same surface. |
| `monthly_budget_usd_cap` | **Pre-flight kill-switch**: month-to-date `cost_usd` + estimated cost of the current request. If the sum would breach the cap, refuses with **402 Payment Required**. Cross-surface (Gateway / Wrapper / Agent Proxy). |
| `daily_token_cap` | **Pre-flight raw-token cap**: sum of `total_tokens` for today + estimated `prompt + max_output` tokens for this request. 402 on breach. Resets at midnight in `APP_TIMEZONE`. |
| `daily_budget_usd_cap` | Same idea, USD-denominated. 402 on breach. |

**IP allowlist and time-of-day restrictions are not token columns — they're [policy guardrails](/security/guardrails/) that flow through the 4-level merge cascade** (Global → Project → Endpoint → Token). A `time_window` set at project level applies to every token in the project; a token can override per field. Same pattern as PII / secret-scanner / etc.

## Lifecycle states

| State | How you get there | Effect at request time |
|---|---|---|
| **Active** (`is_active = true`) | Default at create. Reactivate from the menu. | Token passes auth. |
| **Inactive** (`is_active = false`, reversible) | "Deactivate" in the row menu. | Token returns `401 Invalid or revoked token`. Endpoint surface stays untouched. |
| **Revoked** (`is_active = false`, permanent) | "Revoke (permanent)" in the row menu. | Same effect as Inactive but framed as final — same DB state, the modal text just signals intent. |

Reactivating an inactive token restores it; revoke is the operator's "burn it down" affordance with the matching confirm.

## Metadata

Tokens carry an arbitrary `metadata` JSON object — pass-through, never interpreted by the gateway. Use it to correlate a PromptGate token back to your own app's user / tenant / department model.

In the in-project UI it's a JSON textarea. The Management API accepts it as a structured object on token creation.

```json
{
  "app_user_id": 42,
  "tenant": "acme-inc",
  "department": "marketing"
}
```

The metadata is returned in:

- The Management API create + rotate response body.
- The Management API `GET /api/{uuid}/tokens` listing.
- `gateway_logs.request_body` is never tagged with metadata — it stays a property of the *token*, not the request.

## Management API

Apps that mint tokens for their own end-users use `POST /api/{uuid}/admin/tokens` (gated by the `tokens:write` scope and the global management toggle). The body accepts every field listed above plus the legacy `scopes` override:

```json
{
  "name": "Ada's app token",
  "endpoint_ids": [12, 17],
  "rate_limit_per_minute": 30,
  "monthly_budget_usd_cap": 5.00,
  "metadata": {
    "app_user_id": 42,
    "tenant": "acme-inc"
  }
}
```

Response (HTTP 201) contains the plaintext token *once* plus every input back:

```json
{
  "ok": true,
  "data": {
    "token": "pg_live_...",
    "uuid": "0a1b2c3d-...",
    "name": "Ada's app token",
    "scopes": ["chat", "models"],
    "endpoint_ids": [12, 17],
    "rate_limit_per_minute": 30,
    "monthly_budget_usd_cap": 5.0,
    "metadata": {"app_user_id": 42, "tenant": "acme-inc"},
    "created_at": "2026-05-15T13:01:08+00:00",
    "note": "Store this token now. It is shown only once."
  }
}
```

When `scopes` is omitted, the response uses the project type's default set. Privilege-escalation guard still applies: a caller can only issue management scopes it already owns.

## Project-level kill switch

Deactivating the **project** (`/projects` → three-dot menu → Deactivate) blocks **every** token in that project with `403 Project is inactive` at the auth-middleware layer, regardless of token state. Reactivating the project restores the previous traffic surface unchanged — token-level flags are never touched.
