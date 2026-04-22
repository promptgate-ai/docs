---
title: API Overview
description: PromptGate API reference
---

PromptGate exposes a RESTful JSON API for programmatic access to gateway resources and endpoint invocation.

## Base URL

All API endpoints are prefixed with `/api/v1/`:

```
https://gateway.example.com/api/v1/
```

## Authentication

API requests are authenticated using Bearer tokens. Include your client token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer pg_live_..." \
     https://gateway.example.com/api/v1/endpoints/summarize
```

See [Client Tokens](/security/client-tokens/) for details on creating and managing tokens.

:::note
API authentication via client tokens is under active development. Detailed endpoint documentation will be published as each API surface becomes available.
:::

## Response format

All API responses follow a consistent JSON structure.

**Successful response:**

```json
{
  "ok": true,
  "data": {
    "id": "ep_a1b2c3d4",
    "name": "Summarizer",
    "status": "active"
  },
  "meta": {
    "request_id": "req_x9y8z7w6v5u4"
  }
}
```

**Error response:**

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "The input field is required.",
    "details": {
      "input": ["The input field is required."]
    }
  },
  "meta": {
    "request_id": "req_x9y8z7w6v5u4"
  }
}
```

### Response fields

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `true` for success, `false` for errors |
| `data` | object | The response payload (success only) |
| `error` | object | Error details (error only) |
| `error.code` | string | Machine-readable error code |
| `error.message` | string | Human-readable error description |
| `error.details` | object | Field-level validation errors (when applicable) |
| `meta` | object | Request metadata |
| `meta.request_id` | string | Unique identifier for the request, useful for debugging and support |

## HTTP status codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request — invalid input |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — token lacks required scope |
| `404` | Not found |
| `422` | Validation error — check `error.details` |
| `429` | Rate limited — too many requests |
| `500` | Internal server error |
| `502` | Upstream provider error |
| `504` | Upstream provider timeout |

## Rate limiting

API requests are rate-limited per client token. Rate limit headers are included in every response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1700000000
```

When the rate limit is exceeded, the API returns a `429` status code with a `Retry-After` header.

## Planned API surfaces

The following API surfaces are planned or in development:

| Surface | Prefix | Description |
|---|---|---|
| Endpoint invocation | `/api/v1/endpoints/{slug}` | Call AI endpoints |
| Chat completions | `/api/v1/wrapper/chat/completions` | OpenAI-compatible chat API |
| Resource management | `/api/v1/projects/`, `/api/v1/credentials/`, etc. | CRUD operations on gateway resources |
| MCP server | `/api/v1/mcp/{project-slug}` | MCP tool discovery and invocation |

Detailed endpoint documentation for each surface will be published as they become available.
