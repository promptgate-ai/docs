---
title: Errors
description: Every HTTP status / JSON-RPC code the gateway emits, with cause and recommended client behaviour.
---

PromptGate aims for predictable error semantics across every surface. This page is the reference.

## REST surfaces (Gateway, Wrapper, Proxy)

All REST error responses share a shape:

```json
{
  "ok": false,
  "error": "<human-readable message>",
  "detail": "<optional, more context>",
  "scope": "<optional, e.g. 'minute' for rate limits>",
  "retry_after": 38
}
```

The `ok: false` boolean is the canonical "this is an error" signal. Everything else is contextual.

## HTTP status codes

| Status | Cause | Client behaviour |
|---|---|---|
| **400 Bad Request** | Wrong project type for this surface (e.g. `/v1/chat/completions` against an `ai_gateway` project), malformed body. | Don't retry. Fix the client. |
| **401 Unauthorized** | Missing / malformed / invalid token, token revoked. | Refresh the token. Don't retry with the same one. |
| **402 Payment Required** | Pre-flight budget kill-switch — the request's estimated cost would push month-to-date spend over a monthly cap (endpoint `monthly_budget_usd` or token `monthly_budget_usd_cap`). The upstream call was never made. | Wait for next month, raise the cap, or wait for spend to roll off. |
| **403 Forbidden** | Token belongs to a different project, or lacks the required scope. | Use a token with the right scope or reach out for one. |
| **404 Not Found** | Endpoint slug doesn't exist or is inactive. Unknown alias in Wrapper. | Don't retry; the resource is gone. |
| **405 Method Not Allowed** | API Gateway endpoint's `allowed_methods` doesn't include the request's method. | Don't retry. |
| **422 Unprocessable Entity** | Validation failure: input schema, content length, PII block, prompt injection, keyword blocklist, per-request token limit, SSRF block. | Don't retry; fix the input. |
| **429 Too Many Requests** | Rate limit hit (per-minute or per-hour). | Wait `Retry-After` seconds, then retry. |
| **500 Internal Server Error** | Unexpected exception. Should never see this — file an issue. | Retry once after a delay; if persists, report. |
| **502 Bad Gateway** | Upstream provider failure after failover, output schema validation failure, OAuth refresh failure, upstream HTTP unreachable. | Retry with exponential backoff. |
| **503 Service Unavailable** | A required provider is disabled gateway-wide. | Don't retry; admin needs to re-enable. |

## Error message taxonomy by surface

### Gateway / Wrapper API

| Message | Meaning |
|---|---|
| `Missing Bearer token.` | No `Authorization` header. |
| `Invalid token format.` | Doesn't start with `pg_live_` / `pg_test_`. |
| `Invalid or revoked token.` | Token doesn't exist or `is_active=false`. |
| `Missing required scope: 'chat'. Token has: models.` | Scope mismatch. |
| `Token does not belong to this project.` | Cross-project use. |
| `This project is not an AI Gateway. Use /api/{uuid}/v1/chat/completions for AI Wrapper projects.` | Wrong project type. |
| `Endpoint 'foo' not found or inactive.` | Slug doesn't exist or `is_active=false`. |
| `Rate limit exceeded.` | 429 with `Retry-After` header + body fields `scope` and `retry_after`. |
| `Request exceeds endpoint per-request token limit: ~12000 tokens estimated, cap is 8000.` | Per-request token cap (422). |
| `Endpoint monthly budget would be exceeded: ~$24.99 spent + ~$0.05 estimated for this request, budget $25.00. Resets at the start of next month.` | Endpoint pre-flight budget gate (**402**). |
| `Token monthly budget would be exceeded: ~$4.99 spent + ~$0.02 estimated for this request, cap $5.00. Resets at the start of next month.` | Token-level pre-flight budget gate (**402**), enforced cross-surface. |
| `Request blocked: E-Mail detected in input.` | PII filter, block mode. |
| `Request blocked: prompt injection pattern detected.` | Prompt injection guardrail. |
| `Request blocked: keyword 'foo' detected in input.` | Keyword blocklist. |
| `Request blocked: content length 80012 exceeds maximum 50000.` | Content-length guardrail. |
| `Validation failed: ...` | Input or output JSON schema. |
| `Provider call failed: ...` | Upstream error after failover (502). |
| `Provider 'openai' is disabled in this gateway.` | Provider disabled (503). |

### Proxy API

| Message | Meaning |
|---|---|
| `Method 'POST' is not allowed for this endpoint.` | Method not in `allowed_methods`. |
| `Upstream URL blocked by SSRF guard.` | SSRF check failed (with `detail`). |
| `Upstream OAuth connection failed.` | OAuth refresh failure (with `detail`). |
| `Upstream unreachable.` | Network / timeout to upstream. |
| `Endpoint 'foo' not found or inactive.` | Unknown slug. |

The proxy also passes upstream **status codes through** — if your upstream returned 404, the client sees 404 (not wrapped). The wrapping kicks in only for PromptGate-side errors.

## JSON-RPC surfaces (MCP, Control Plane)

JSON-RPC errors are in-protocol — the HTTP status is **200** even on protocol errors:

```http
HTTP/1.1 200 OK

{
  "jsonrpc": "2.0", "id": 1,
  "error": { "code": -32602, "message": "Unknown tool: nonexistent" }
}
```

The HTTP layer only emits non-200 for **transport-level** errors:

| HTTP status | Cause |
|---|---|
| 400 | Body isn't valid JSON / parse error. Body has the JSON-RPC envelope. |
| 401 / 403 | Bearer token missing / wrong scope. Body is plain `{ok: false, error: ...}` — no JSON-RPC envelope. |
| 204 | Notification (envelope without `id`). No body. |

### JSON-RPC error codes

| Code | Standard meaning | Used for |
|---|---|---|
| -32700 | Parse error | Malformed JSON in request body |
| -32600 | Invalid request | Missing `method`, etc. |
| -32601 | Method not found | Unknown JSON-RPC method |
| -32602 | Invalid params | Unknown tool, missing argument, bad type, bad enum value |
| -32603 | Internal error | Provider failure, upstream MCP server unreachable, malformed upstream response |
| -32000 to -32099 | Server-defined | Reserved; PromptGate currently propagates these from upstream MCP servers verbatim |

### Control Plane specific

The Control Plane uses `-32602` (invalid params) for almost every business-rule failure:

- `Missing required argument: project_uuid`
- `Project not found: <uuid>`
- `Invalid project_type: banana`
- `Unknown scope(s): root_all`
- `Token not found: 99999`
- `Endpoint not found: <uuid>`
- `is_active must be boolean`

`-32603` for upstream / internal failures.

## Retry guidance

| Status | Retryable? | How |
|---|---|---|
| 401 | No | Fix the token. |
| 403 | No | Fix the scope or project. |
| 404 | No | Fix the URL. |
| 405 | No | Use an allowed method. |
| 422 | No | Fix the input. |
| 429 | **Yes**, after `Retry-After` seconds | Linear backoff is fine. |
| 500 | Sometimes | Retry once; if persists, report. |
| 502 | **Yes**, with exponential backoff | Provider was flaky; retry 1-3 times. |
| 503 | No | Admin needs to re-enable the provider. |
| JSON-RPC -32603 | Sometimes | If it's an upstream provider issue, retry. If schema/internal, don't. |

## Idempotency

PromptGate's API is **not idempotent** in the strict sense — every call to `POST /api/{uuid}/{slug}` runs the full pipeline again. There's no idempotency key.

For destructive operations via the Control Plane:

- `pg_revoke_token` is idempotent (revoking an already-revoked token returns OK).
- `pg_set_endpoint_active` is idempotent.
- `pg_create_token` is **not** — each call mints a fresh row.
- `pg_rotate_token` is **not** — each call rotates again, invalidating the previous plaintext.

## Observing errors

Every error path writes to:

- `gateway_logs` — for runtime errors (provider failure, guardrail block, rate limit, budget).
- `audit_logs` — for state-changing errors (token revoked, OAuth refresh failed, etc.).

So you can filter both for post-hoc analysis. Webhooks fire on audit insertions, so you can route specific errors to alerting in real time.

---

That's the full API Reference. Continue to:

- **[Plugins](/plugins/marketplace/)** — coming soon.
- **[Cookbook](/cookbook/openai-via-gateway/)** — task-oriented walkthroughs.

---

> © Akyros Labs LLC. All rights reserved.
