---
title: API Overview
description: Inventory of every public API surface PromptGate exposes.
---

PromptGate has **six public API surfaces**, each with its own URL space, scope requirement, and request/response shape:

| Surface | Path prefix | Scope | Project type |
|---|---|---|---|
| **[Gateway API](/api/gateway/)** | `/api/{uuid}/{slug}` <br/> `/api/{uuid}/chat/completions` | `chat` | `ai_gateway` |
| **[Wrapper API](/api/wrapper/)** | `/api/{uuid}/v1/chat/completions` <br/> `/api/{uuid}/v1/models` | `chat` | `ai_wrapper` |
| **[Proxy API](/api/proxy/)** | `/api/{uuid}/proxy/{slug}/{any?}` | `proxy` | `api_gateway` |
| **[MCP API](/api/mcp/)** | `/api/{uuid}/mcp` | `mcp` | `ai_gateway` (Bridge) or `mcp_gateway` |
| **[Control Plane API](/api/control-plane/)** | `/api/control/mcp` | `admin` | global |
| **[Management API](/api/management/)** | `/api/{uuid}/admin/tokens` <br/> `/api/{uuid}/admin/endpoints` | `tokens:write` / `endpoints:write` | any |

Plus per-project introspection endpoints under `admin` scope:

- `GET /api/{uuid}/info` — project info
- `GET /api/{uuid}/endpoints` — list AI endpoints
- `GET /api/{uuid}/tokens` — list tokens (no plaintexts)
- `GET /api/{uuid}/models` — discover models (scope: `models`)

See **[Authentication](/api/auth/)** for the token / scope details.

## All examples assume

```bash
PG_URL=https://gateway.your-domain.com
PG_UUID=<your project UUID>
PG_TOKEN=pg_live_...
PG_SLUG=<your endpoint slug>
```

The Quick Start has step-by-step instructions for getting these. See **[Quick Start](/getting-started/quick-start/)**.

## URL shape conventions

- **Project UUID** is always the second path segment: `/api/{uuid}/...`. Get it from the project's URL in the UI or from `pg_get_project` in the Control Plane.
- **Endpoint slug** is the third segment for AI Gateway and API Gateway: `/api/{uuid}/{slug}` or `/api/{uuid}/proxy/{slug}/`.
- **Versioning**: only the AI Wrapper uses `/v1/` (because it's mimicking OpenAI's path layout). Other surfaces don't version the path; future versions will use the `X-Api-Version` header.

## Request bodies

- All bodies are `application/json`.
- The wrapper (`/v1/chat/completions`) and gateway (`/chat/completions`) accept the OpenAI message shape.
- Direct gateway endpoints (`/api/{uuid}/{slug}`) accept either a `messages` array or a single `message` string.
- MCP / Control Plane bodies are JSON-RPC 2.0 envelopes.

## Responses

Standard responses (success + error):

```json
{
  "ok": true,
  "id": "chatcmpl-...",
  "model": "gpt-4o-mini",
  "content": "Hello!",
  "finish_reason": "stop",
  "usage": { "prompt_tokens": 8, "completion_tokens": 2, "total_tokens": 10 },
  "meta": { "request_id": "...", "session_id": "..." }
}
```

```json
{
  "ok": false,
  "error": "Rate limit exceeded.",
  "scope": "minute",
  "retry_after": 38
}
```

The boolean `ok` is consistent across surfaces. `error` is human-readable. Some surfaces add domain-specific fields (`scope` / `retry_after` / `detail`).

## Common headers

| Header | Direction | What |
|---|---|---|
| `Authorization: Bearer <token>` | request | Always required (except `/login`). |
| `Content-Type: application/json` | request | For bodies. |
| `Accept: application/json` | request | Helpful but not required. |
| `Retry-After` | response | Seconds left in the rate-limit bucket on 429. |
| `X-Forwarded-Proto` | request (proxy) | Honoured for HTTPS detection when behind a reverse proxy. |

## Streaming

The Gateway and Wrapper surfaces support **Server-Sent Events** when the request body has `"stream": true` AND the endpoint has streaming enabled. Format is OpenAI-compatible.

See **[Streaming](/features/streaming/)** for the wire format and client examples.

## Errors

A consistent error shape across all surfaces. See **[Errors](/api/errors/)** for the full status / message / scenario matrix.

## OpenAPI / Postman?

Currently no published OpenAPI spec. The current mix of REST + JSON-RPC + project-type-aware routing makes a single spec awkward; we may publish per-surface specs later. The **[Cookbook](/cookbook/openai-via-gateway/)** has copy-pasteable working examples for every surface.

---

Next: **[Authentication](/api/auth/)**.

---

> © Akyros Labs LLC. All rights reserved.
