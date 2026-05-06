---
title: API Gateway
description: Generic HTTP proxy with method allowlists, header policies, OAuth, SSRF guard, and rate limits.
---

An `api_gateway` project turns PromptGate into a **generic HTTP proxy** in front of any upstream API. Clients authenticate to PromptGate with a Bearer token; PromptGate forwards to the configured upstream while enforcing method, header, rate-limit, and SSRF policies. Optional OAuth Service Connections inject the right upstream `Authorization` header automatically.

## Public API

```
ANY /api/{project_uuid}/proxy/{endpoint_slug}/{any?}
```

Any HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) — the endpoint's `allowed_methods` decides which actually pass through. The trailing path is appended to the upstream URL.

Bearer-token gated, scope `proxy`.

## Anatomy of an endpoint

| Field | Meaning |
|---|---|
| `name` / `slug` | UI label / URL segment. |
| `upstream_url` | Where the proxy forwards to (e.g. `https://api.openweathermap.org`). |
| `allowed_methods` | List of permitted HTTP verbs. |
| `forward_headers` | Allowlist of client headers to forward. Empty = forward all. |
| `blocked_headers` | Always blocked (in addition to defaults: Host, Authorization, Cookie, Content-Length). |
| `inject_headers` | Server-side headers added to every upstream request. |
| `auth_mode` | Currently `token` (Bearer required). |
| `oauth_connection_id` | Optional FK — when set, `Authorization: Bearer <upstream-token>` is injected and refreshed automatically. |
| `timeout_seconds` | Upstream timeout (1–300). |
| `strip_path_prefix` | If true (default), `/proxy/{slug}/` is stripped before appending. |
| `preserve_query` | If true (default), the client's query string is forwarded. |
| `rate_limit_per_minute` / `_hour` | 429 + Retry-After when exceeded. |

## Creating an endpoint

In your `api_gateway` project: sidebar → **Endpoints** → **+ New endpoint**.

![API Gateway endpoint create — placeholder](#)

The form covers all fields above, with sensible defaults (timeout 30s, strip prefix on, preserve query on).

## Calling the proxy

If you registered an endpoint with slug `weather` pointing at `https://api.openweathermap.org`, then:

```bash
# This client request:
GET /api/$UUID/proxy/weather/data/2.5/weather?q=Berlin

# Becomes this upstream request:
GET https://api.openweathermap.org/data/2.5/weather?q=Berlin
```

### curl

```bash
curl $URL/api/$UUID/proxy/weather/data/2.5/weather?q=Berlin \
  -H "Authorization: Bearer pg_live_..."
```

### Python (requests)

```python
import os, requests

r = requests.get(
    f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/proxy/weather/data/2.5/weather",
    headers={"Authorization": f"Bearer {os.environ['PG_TOKEN']}"},
    params={"q": "Berlin"},
)
print(r.json())
```

### Node.js (fetch)

```js
const url = `${process.env.PG_URL}/api/${process.env.PG_UUID}/proxy/weather/data/2.5/weather?q=Berlin`;
const r = await fetch(url, {
    headers: { 'Authorization': `Bearer ${process.env.PG_TOKEN}` },
});
console.log(await r.json());
```

## Header policies

The default behaviour is permissive but safe:

- **Always blocked, never forwarded**: `Host`, `Authorization`, `Cookie`, `Content-Length`.
- **forward_headers empty**: every other client header is forwarded.
- **forward_headers populated**: only the listed headers are forwarded.
- **blocked_headers**: extra headers blocked on top of the defaults.
- **inject_headers**: added to every upstream request.

Why is `Authorization` always blocked? Because the client's `Authorization: Bearer pg_live_…` is for *PromptGate*, not the upstream. Upstream credentials come from `inject_headers` or an OAuth connection — never from the client.

## Injecting upstream secrets

Two strategies for letting the proxy authenticate to upstream:

### 1. Static `inject_headers`

Hard-code the secret on the server side. Example for an internal API:

```
X-API-Key: super-secret-key
X-Source: promptgate
```

Stored unencrypted in DB (it's just a header value). Use this for low-risk static credentials.

### 2. OAuth Service Connection

For real upstream OAuth providers (Google, GitHub, Slack, …), use a connection. The proxy injects `Authorization: Bearer <access_token>` and **auto-refreshes** when the token's `expires_at` is past (or within 60s). Tokens are encrypted at rest.

See **[OAuth Connections](/security/oauth-connections/)**.

## SSRF protection

Every `upstream_url` is validated:

- At **endpoint create / update** — friendly error in the form.
- At **proxy time** — defends against DNS rebinding (a hostname that resolved publicly when saved can flip private later).

Blocked: loopback, RFC1918, link-local, IPv6 unique-local, cloud metadata (169.254.169.254). Override with `SSRF_ALLOWED_HOSTS` env var.

See **[SSRF Protection](/security/ssrf/)** for the full ranges and the override grammar.

## Rate limits

`rate_limit_per_minute` and `rate_limit_per_hour` are independent. Either tripping fires a 429 with `Retry-After`. Empty fields = unlimited. See **[Rate Limits](/security/rate-limits/)**.

## Logging

Every proxy request lands in `gateway_logs` with:

- `provider_key = "http"`
- `provider_model = "<METHOD> <STATUS>"` (e.g. `GET 200`, `POST 503`)
- `latency_ms` — full round-trip including upstream call
- `status` — `ok` for 2xx/3xx, `error` for 4xx/5xx
- `error_message` — populated on SSRF block, OAuth failure, or upstream unreachable

So **Live Logs** and **Metrics** work the same way they do for AI traffic.

## Common patterns

- **Public API behind a token** — register the upstream, set `forward_headers=[]`, no OAuth. Clients use a `proxy`-scoped PromptGate token instead of figuring out the upstream's auth.
- **Internal microservice gateway** — register with `inject_headers: { "X-Internal-Auth": "..." }`. Clients never see the internal credential.
- **Third-party SaaS via OAuth** — register the upstream + an OAuth Service Connection bound to it. Run the auth flow once; the proxy keeps the token fresh.
- **Read-only proxy** — set `allowed_methods: ["GET", "HEAD"]`. Mutations get a 405.

## Errors

| Situation | Response |
|---|---|
| Unknown endpoint slug or inactive | 404 |
| Method not in `allowed_methods` | 405 |
| Upstream URL fails SSRF check | 422 |
| OAuth refresh fails | 502 |
| Upstream times out / unreachable | 502 |
| Rate limit exceeded | 429 + Retry-After |
| Wrong scope | 403 |
| Wrong project type for `/proxy` route | 404 |

---

Next: **[Sessions](/features/sessions/)** — server-side conversation state for AI Gateway.

---

> © Akyros Labs LLC. All rights reserved.
