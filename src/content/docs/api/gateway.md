---
title: Gateway API
description: AI Gateway endpoint execution — POST /api/{uuid}/{slug} and POST /api/{uuid}/chat/completions.
---

The Gateway API is the public surface of `ai_gateway` projects. Two routes:

| Route | Use |
|---|---|
| `POST /api/{uuid}/{slug}` | Direct call to a single endpoint by slug. |
| `POST /api/{uuid}/chat/completions` | Generic dispatcher — request body picks the endpoint by slug. |

Both require **`chat` scope**.

The two routes are functionally equivalent; the second is more familiar to OpenAI users (one URL, multiple endpoints) and is what you'd use if a downstream tool expects a single OpenAI-style URL but you want endpoint routing.

## Route 1: Direct slug

### Request

```
POST /api/{uuid}/{slug}
Content-Type: application/json
Authorization: Bearer pg_live_...
```

Body — single message:

```json
{ "message": "Explain quantum computing." }
```

Or full conversation:

```json
{
  "messages": [
    { "role": "system", "content": "You are a teacher." },
    { "role": "user", "content": "What's a qubit?" }
  ]
}
```

Optional fields:

| Field | Type | Default | Notes |
|---|---|---|---|
| `stream` | bool | `false` | Honoured if endpoint has streaming enabled. |
| `session_id` | string (uuid) | absent | Resume an existing session. |

### Response (non-streaming)

```json
{
  "ok": true,
  "id": "chatcmpl-abcd1234",
  "model": "gpt-4o-mini",
  "content": "A qubit is the quantum analogue of a classical bit...",
  "finish_reason": "stop",
  "usage": {
    "prompt_tokens": 38,
    "completion_tokens": 87,
    "total_tokens": 125
  },
  "meta": {
    "request_id": "0e2f...c4",
    "session_id": "..."   // only when session is created/resumed
  }
}
```

### Response (streaming)

OpenAI-style SSE chunks. See **[Streaming](/features/streaming/)**.

### curl

```bash
curl -X POST $PG_URL/api/$PG_UUID/$PG_SLUG \
  -H "Authorization: Bearer $PG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain quantum computing."}'
```

### Python

```python
import os, requests

resp = requests.post(
    f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/{os.environ['PG_SLUG']}",
    headers={"Authorization": f"Bearer {os.environ['PG_TOKEN']}"},
    json={"message": "Explain quantum computing."},
    timeout=120,
)
resp.raise_for_status()
print(resp.json()["content"])
```

### Node.js

```js
const r = await fetch(`${process.env.PG_URL}/api/${process.env.PG_UUID}/${process.env.PG_SLUG}`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.PG_TOKEN}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Explain quantum computing.' }),
});
console.log((await r.json()).content);
```

## Route 2: `/chat/completions` dispatcher

Same as Route 1, but the **endpoint slug goes in the body**:

```json
{
  "endpoint": "summarize",
  "messages": [
    { "role": "user", "content": "Long text..." }
  ]
}
```

Useful when you have a tool that talks to a single URL (`POST .../chat/completions`) but you want to route across multiple endpoints in the project.

### curl

```bash
curl -X POST $PG_URL/api/$PG_UUID/chat/completions \
  -H "Authorization: Bearer $PG_TOKEN" \
  -d '{
    "endpoint": "summarize",
    "messages": [{"role":"user","content":"Long text..."}]
  }'
```

The response shape is identical to Route 1.

## Behaviour reference

| Situation | Status | Body |
|---|---|---|
| Success | 200 | `{ok: true, ...}` |
| No bearer token | 401 | `{ok: false, error: "Missing Bearer token."}` |
| Token from different project | 403 | `{ok: false, error: "Token does not belong to this project."}` |
| Wrong scope | 403 | scope mismatch message |
| Endpoint slug not found / inactive | 404 | endpoint-not-found message |
| Per-minute rate limit hit | 429 | + `Retry-After` header |
| Per-request token cap exceeded | 422 | budget message |
| Monthly budget exhausted | 422 | budget message |
| Guardrail blocked | 422 | which guardrail |
| Input schema invalid | 422 | validator detail |
| Provider error after failover | 502 | provider error |
| Output schema invalid | 502 | validator detail |
| Wrong project type for this surface | 400 | type mismatch |

## Pipeline order

Request → auth → rate limit → budget → guardrails → input schema → prompt apply → provider call (with failover) → output schema → log → response.

So a request that fails an early step never pays the cost of later steps.

## Common patterns

### Single-shot chat

Just pass `message`. PromptGate wraps it as `[{role: "user", content: ...}]`.

### Multi-turn (no session)

Pass the full `messages` history. The client manages the transcript.

### Multi-turn (with session)

Pass `session_id` + the **new** user `message`. The gateway stores the history and prepends it next time.

### Streaming

Pass `"stream": true`. Endpoint has to have `streaming_enabled=true`. Response is SSE.

---

Next: **[Wrapper API](/api/wrapper/)**.

---

> © Akyros Labs LLC. All rights reserved.
