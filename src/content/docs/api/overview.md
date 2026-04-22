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

API requests are authenticated using Bearer tokens. Include your API token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer pg_live_..." \
     https://gateway.example.com/api/v1/endpoints/summarize
```

Tokens use the `pg_live_` prefix for production and `pg_test_` for test environments. Generate tokens in the dashboard under **Security → API Tokens**.

See [Client Tokens](/security/client-tokens/) for details on creating and managing tokens.

## Chat Completions

Send messages to an AI endpoint and receive a completion.

### Via endpoint slug

```bash
curl -X POST https://gateway.example.com/api/v1/endpoints/summarize \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain quantum computing in one paragraph."
  }'
```

Or with full message history:

```bash
curl -X POST https://gateway.example.com/api/v1/endpoints/summarize \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain quantum computing in one paragraph."}
    ]
  }'
```

### Via chat/completions route

```bash
curl -X POST https://gateway.example.com/api/v1/chat/completions \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "summarize",
    "messages": [
      {"role": "user", "content": "Explain quantum computing in one paragraph."}
    ]
  }'
```

### Streaming

Add `"stream": true` to receive Server-Sent Events (SSE):

```bash
curl -X POST https://gateway.example.com/api/v1/endpoints/summarize \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a short poem.",
    "stream": true
  }'
```

The response is an SSE stream with OpenAI-compatible `data:` chunks, ending with `data: [DONE]`.

## Response format

All non-streaming API responses follow a consistent JSON structure.

**Successful response:**

```json
{
  "ok": true,
  "data": {
    "id": "chatcmpl-abc123",
    "content": "Quantum computing uses quantum bits...",
    "model": "gpt-4o-mini",
    "finish_reason": "stop",
    "usage": {
      "prompt_tokens": 14,
      "completion_tokens": 82,
      "total_tokens": 96
    }
  },
  "meta": {
    "endpoint": "summarize",
    "provider": "gpt-4o-mini"
  }
}
```

**Error response:**

```json
{
  "ok": false,
  "error": "Endpoint 'unknown' not found or inactive."
}
```

### Response fields

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `true` for success, `false` for errors |
| `data` | object | The response payload (success only) |
| `data.content` | string | The AI-generated text |
| `data.model` | string | Model that produced the response |
| `data.usage` | object | Token usage counts |
| `error` | string | Error message (error only) |
| `meta` | object | Request metadata |

## Supported providers

| Provider | Key | Example models |
|---|---|---|
| OpenAI | `openai` | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| Anthropic | `anthropic` | claude-sonnet-4-20250514, claude-haiku-4-5-20251001 |
| Google Gemini | `google` | gemini-2.0-flash, gemini-pro |

## Failover

When an endpoint has a failover chain configured, the gateway automatically tries the next provider if the primary fails (timeout, 5xx, rate limit). Failover entries inherit runtime settings (temperature, top_p, max_tokens) from the primary endpoint.

## HTTP status codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `401` | Unauthorized — missing or invalid token |
| `404` | Endpoint not found or inactive |
| `422` | Validation error |
| `429` | Rate limited |
| `502` | Upstream provider error |

## Rate limiting

API requests are rate-limited per client token. Rate limit headers are included in every response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1700000000
```

When the rate limit is exceeded, the API returns a `429` status code with a `Retry-After` header.
