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

### Aliases (and Presets)

Map a friendly name to a `provider:model` pair — and optionally bake in a system prompt + sampling defaults so clients don't have to send them.

#### Plain aliases — just rename a model

| Alias | Provider | Model |
|---|---|---|
| `fast` | `openai` | `gpt-4o-mini` |
| `smart` | `anthropic` | `claude-3-5-sonnet-20241022` |
| `cheap` | `groq` | `llama-3.1-8b-instant` |

A request with `"model": "fast"` will be served by OpenAI's gpt-4o-mini. Swap the alias to `groq:llama-3.1-8b-instant` later — clients don't change.

#### Aliases as presets — bake in prompt + sampling defaults

This is the OpenRouter-style behaviour: an alias can also carry:

| Field | Purpose |
|---|---|
| `description` | Free-text — surfaces in `/v1/models` so callers know what the alias is for. |
| `system_prompt` | Prepended to messages when the client doesn't supply a system message. |
| `temperature` | Default sampling temperature. |
| `top_p` | Default nucleus sampling threshold. |
| `max_tokens` | Default max output tokens. |

Example — a `summarizer` alias that bakes in a system prompt and conservative sampling:

| Field | Value |
|---|---|
| Alias | `summarizer` |
| Provider | `openai` |
| Provider Model | `gpt-4o-mini` |
| Description | "Three-sentence executive summary." |
| System Prompt | "Summarize the user's input in three sentences. No bullet points." |
| Temperature | `0.3` |
| Top P | `1.0` |
| Max Tokens | `500` |

Clients now send only:

```json
{
    "model": "promptgate:summarizer",
    "messages": [{"role": "user", "content": "Long text..."}]
}
```

…and the wrapper:

1. Resolves `promptgate:summarizer` to `openai:gpt-4o-mini` (with the project's OpenAI credential).
2. Prepends the preset's `system_prompt` to messages (because the client didn't supply one).
3. Uses `temperature: 0.3`, `top_p: 1.0`, `max_tokens: 500` from the preset.
4. Calls OpenAI.

:::tip[The `promptgate:` namespace]
The **preferred** form for project aliases is `promptgate:<name>` — namespaced. It reads at a glance as "PromptGate-managed model" rather than `provider:model`, and reserves the prefix against future provider key clashes. The bare `"summarizer"` form **still works** for backward compatibility but the canonical id surfaced in `/v1/models` and the UI is the namespaced one.
:::

#### Override semantics (request wins)

If the client **does** send a value, the client wins:

```json
{
    "model": "promptgate:summarizer",
    "messages": [{"role": "user", "content": "..."}],
    "temperature": 0.9
}
```

→ `temperature: 0.9` is used, not the preset's `0.3`.

Same for `messages`: if the client already supplies a system message, the preset's `system_prompt` is **not** prepended (no dual-system confusion). For `top_p` and `max_tokens` it's the same rule — request value wins, preset value is the floor.

#### When to use presets vs plain aliases

| Use plain alias | Use preset |
|---|---|
| You just want a friendly name for a `provider:model`. | You want a single client-facing name that bakes in *how* to call it. |
| Clients control all sampling params themselves. | Clients should always use a specific system prompt + sampling. |
| You'll swap the underlying model later. | You'll swap the underlying model AND want consistent calling defaults. |

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
    {
      "id": "promptgate:fast",
      "alias": "fast",
      "object": "model",
      "owned_by": "promptgate-alias",
      "provider": "openai",
      "provider_model": "gpt-4o-mini",
      "is_alias": true,
      "is_preset": false
    },
    {
      "id": "promptgate:summarizer",
      "alias": "summarizer",
      "object": "model",
      "owned_by": "promptgate-alias",
      "provider": "openai",
      "provider_model": "gpt-4o-mini",
      "is_alias": true,
      "is_preset": true,
      "description": "Three-sentence executive summary.",
      "preset": {
        "system_prompt": "Summarize the user's input in three sentences. No bullet points.",
        "temperature": 0.3,
        "max_tokens": 500
      }
    },
    { "id": "openai:*", "object": "model", "owned_by": "openai", "is_alias": false }
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
