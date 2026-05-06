---
title: AI Wrapper
description: OpenAI-compatible API surface that routes to any registered provider via aliases.
---

An `ai_wrapper` project exposes an **OpenAI-compatible API** that any OpenAI SDK or client can talk to without modification. The wrapper resolves the request's `model` field to a provider behind the scenes.

## Public API

```
POST /api/{project_uuid}/v1/chat/completions
GET  /api/{project_uuid}/v1/models
```

Both are bearer-token gated, scope `chat`. Request and response shapes match the OpenAI Chat Completions spec.

## How model routing works

When the client sends `{ "model": "openai:gpt-4o-mini" }`, the wrapper:

1. Parses the `model` string.
2. **If it's an alias** (a name without `:`) — looks up `wrapper_aliases` and resolves to a `(provider_key, provider_model)` pair.
3. **If it's `provider:model`** — uses that pair directly.
4. Resolves the **per-project provider→credential assignment** to find which API key to use.
5. Calls the provider via the right adapter.

So a client doesn't know (and doesn't care) which provider is actually serving the request.

## Configuring the wrapper

In your `ai_wrapper` project, the sidebar has three items:

### Overview

A summary page: KPIs (assigned providers, aliases, models exposed), the public URL, and a curl example with the right project UUID baked in.

![Wrapper overview — placeholder](#)

### Providers

For each provider you want to expose:

- Tick **Enabled**
- Pick a **Credential** (filtered by provider)

Disabled providers reject any request that lands on them with a 503-ish error.

### Aliases

Map a friendly name to a `provider:model` pair:

| Alias | Provider | Model |
|---|---|---|
| `fast` | `openai` | `gpt-4o-mini` |
| `smart` | `anthropic` | `claude-3-5-sonnet-20241022` |
| `cheap` | `groq` | `llama-3.1-8b-instant` |

A request with `"model": "fast"` will be served by OpenAI's gpt-4o-mini. Swap the alias to `groq:llama-3.1-8b-instant` later — clients don't change.

## Calling it like OpenAI

### curl

```bash
curl -X POST $URL/api/$UUID/v1/chat/completions \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fast",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Python (openai SDK)

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/v1",
    api_key=os.environ['PG_TOKEN'],
)

resp = client.chat.completions.create(
    model="fast",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)
```

### Node.js (openai SDK)

```js
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: `${process.env.PG_URL}/api/${process.env.PG_UUID}/v1`,
    apiKey: process.env.PG_TOKEN,
});

const resp = await client.chat.completions.create({
    model: 'fast',
    messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(resp.choices[0].message.content);
```

The OpenAI SDK works because the wrapper returns OpenAI's response shape verbatim:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "model": "gpt-4o-mini",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "Hello! How can I help today?" },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 8,
    "completion_tokens": 9,
    "total_tokens": 17
  }
}
```

## `/v1/models` discovery

```bash
curl $URL/api/$UUID/v1/models \
  -H "Authorization: Bearer pg_live_..."
```

Returns the union of:

- Every alias defined in the project
- Every `provider:*` placeholder for enabled providers (so clients know `openai:*` routes work)

```json
{
  "object": "list",
  "data": [
    { "id": "fast", "object": "model", "owned_by": "promptgate", "is_alias": true },
    { "id": "openai:*", "object": "model", "owned_by": "promptgate", "is_alias": false }
  ]
}
```

## Errors

| Situation | Response |
|---|---|
| Unknown alias | 404 |
| `provider:model` with provider not enabled in this wrapper | 400 |
| Wrong project type | 400 |
| Token without `chat` scope | 403 |
| Provider call fails | 502 |

## Why use it instead of AI Gateway?

- **AI Gateway**: prompts are baked into the endpoint. Clients call `POST /api/X/my-summarizer` with raw user text. Use it when *you* control the prompt.
- **AI Wrapper**: clients send full chat completions with their own model + messages. Use it when you're standing up a proxy in front of an existing OpenAI-using app.

You can have both project types in the same PromptGate instance.

---

Next: **[API Gateway](/features/api-gateway/)** — generic HTTP proxy.

---

> © Akyros Labs LLC. All rights reserved.
