---
title: Proxy API
description: Generic HTTP proxy — ANY /api/{uuid}/proxy/{slug}/{any?} forwards to the configured upstream.
---

The Proxy API is the public surface of `api_gateway` projects. **Any HTTP method**, **any tail path**:

```
ANY /api/{uuid}/proxy/{slug}/{any?}
```

Requires **`proxy` scope**. Forwards to `endpoint.upstream_url + tail_path`, applying the endpoint's method allowlist + header policies + OAuth.

## Request

What the client sends:

```
GET    /api/{uuid}/proxy/weather/data/2.5/weather?q=Berlin
POST   /api/{uuid}/proxy/github/repos/owner/repo/issues
PUT    /api/{uuid}/proxy/myapi/users/42
DELETE /api/{uuid}/proxy/myapi/users/42
```

What gets forwarded upstream:

```
GET    https://api.openweathermap.org/data/2.5/weather?q=Berlin
POST   https://api.github.com/repos/owner/repo/issues
PUT    https://my-api.example.com/users/42
DELETE https://my-api.example.com/users/42
```

The exact transformation depends on the endpoint config — see **[API Gateway](/features/api-gateway/)** for the full set of toggles.

## Headers

| Direction | Header | Behaviour |
|---|---|---|
| Client → PromptGate | `Authorization: Bearer pg_…` | Required for auth. Always stripped before forwarding. |
| Client → PromptGate | Anything else | Forwarded if in `forward_headers` allowlist (or if no allowlist). |
| PromptGate → Upstream | `Authorization: Bearer <oauth>` | Injected if endpoint binds an OAuth Service Connection. |
| PromptGate → Upstream | `inject_headers` content | Server-side static headers always added. |
| PromptGate → Upstream | `Host`, `Cookie`, `Content-Length` | Always blocked. |
| Upstream → Client | Most response headers | Forwarded. |
| Upstream → Client | `Transfer-Encoding`, `Connection`, `Content-Length` | Blocked (let HTTP layer manage). |

## Body

Body is **passthrough**. Whatever the client sends, PromptGate forwards verbatim. No JSON parsing, no transformation. Same for the response body.

So you can proxy any content type — JSON, form-encoded, multipart, binary.

## Examples

### GET with query string

```bash
curl "$PG_URL/api/$PG_UUID/proxy/weather/data/2.5/weather?q=Berlin&units=metric" \
  -H "Authorization: Bearer $PG_TOKEN"
```

### POST with JSON

```bash
curl -X POST $PG_URL/api/$PG_UUID/proxy/github/repos/me/repo/issues \
  -H "Authorization: Bearer $PG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Bug report", "body": "Found an issue."}'
```

(The endpoint has an OAuth Service Connection bound, so `Authorization: Bearer <github-oauth>` is injected upstream automatically.)

### Python

```python
import os, requests

# Read
r = requests.get(
    f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/proxy/weather/data/2.5/weather",
    headers={"Authorization": f"Bearer {os.environ['PG_TOKEN']}"},
    params={"q": "Berlin"},
)
print(r.json())

# Write
r = requests.post(
    f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/proxy/github/repos/me/repo/issues",
    headers={"Authorization": f"Bearer {os.environ['PG_TOKEN']}"},
    json={"title": "Bug report"},
)
print(r.status_code, r.json())
```

### Node.js

```js
const url = `${process.env.PG_URL}/api/${process.env.PG_UUID}/proxy/myapi/users/42`;
const r = await fetch(url, {
    method: 'PUT',
    headers: {
        'Authorization': `Bearer ${process.env.PG_TOKEN}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Sam' }),
});
console.log(r.status, await r.json());
```

## Pipeline order

Request → auth (proxy scope) → rate limit → SSRF check on upstream URL → header build (forward + inject + OAuth) → forward to upstream → log to gateway_logs.

Note: SSRF runs at **proxy time too**, even though it ran at endpoint create time. Defense against DNS rebinding.

## Behaviour reference

| Situation | Status | Body |
|---|---|---|
| Successful proxy (upstream 2xx/3xx) | 200/201/etc. | passthrough |
| Method not in `allowed_methods` | 405 | `{ok:false, error:"Method 'POST' is not allowed for this endpoint."}` |
| SSRF guard blocks upstream URL | 422 | `{ok:false, error:"Upstream URL blocked by SSRF guard.", detail:"..."}` |
| OAuth refresh fails | 502 | `{ok:false, error:"Upstream OAuth connection failed.", detail:"..."}` |
| Upstream times out | 502 | `{ok:false, error:"Upstream unreachable.", detail:"..."}` |
| Upstream returns 4xx/5xx | passthrough | upstream's response body verbatim |
| Endpoint inactive / unknown slug | 404 | endpoint-not-found |
| Wrong scope | 403 | scope mismatch |
| Wrong project type | 400 | type mismatch |
| Per-minute rate limit hit | 429 | + `Retry-After` |

## Logging

Every proxy hit lands in `gateway_logs`:

| Column | Value |
|---|---|
| `provider_key` | `"http"` |
| `provider_model` | `"<METHOD> <STATUS>"` (e.g. `"GET 200"`, `"POST 502"`) |
| `latency_ms` | full round-trip including upstream call |
| `status` | `"ok"` for 2xx/3xx, `"error"` for 4xx/5xx |
| `error_message` | populated on SSRF block, OAuth failure, upstream unreachable |

So **Live Logs** and **Metrics** work the same way they do for AI traffic — same UI, same filters.

## Streaming

The proxy does **not** stream. The full upstream response is buffered before the client gets it. Streaming proxies are roadmap.

For SSE-emitting upstreams (e.g. proxying an OpenAI streaming endpoint via API Gateway), use the **Wrapper API** instead — it has true SSE support.

---

Next: **[MCP API](/api/mcp/)**.

---

> © Akyros Labs LLC. All rights reserved.
