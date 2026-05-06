---
title: Wrapper API
description: OpenAI-compatible chat completions surface — POST /api/{uuid}/v1/chat/completions and GET /api/{uuid}/v1/models.
---

The Wrapper API is the public surface of `ai_wrapper` projects. It mimics OpenAI's REST shape so any OpenAI-compatible SDK works without modification.

| Route | Use |
|---|---|
| `POST /api/{uuid}/v1/chat/completions` | Chat completion — model identifier picks the upstream. |
| `GET /api/{uuid}/v1/models` | Discover aliases + provider:* placeholders. |

Both require **`chat` scope**.

## `POST /v1/chat/completions`

### Request

```
POST /api/{uuid}/v1/chat/completions
Content-Type: application/json
Authorization: Bearer pg_live_...
```

Body — same shape as OpenAI:

```json
{
  "model": "fast",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 500,
  "stream": false
}
```

Where `model` is one of:

- An **alias** defined in the project (e.g. `fast`, `smart`, `cheap`).
- A **preset** — an alias that also bakes in `system_prompt` + sampling defaults (e.g. `summarizer`, `translator`).
- A **`provider:model`** pair (e.g. `openai:gpt-4o-mini`, `anthropic:claude-3-5-sonnet-20241022`).

Aliases resolve via `wrapper_aliases`. Provider+model uses the project's `wrapper_provider_settings.credential_id` for that provider.

When the alias has preset config (`system_prompt` / `temperature` / `top_p` / `max_tokens`), the wrapper merges those defaults into the request. **Client-supplied values win** — see [AI Wrapper → Aliases as presets](/features/ai-wrapper/#aliases-as-presets--bake-in-prompt--sampling-defaults).

### Response

OpenAI-compatible:

```json
{
  "id": "chatcmpl-abcd",
  "object": "chat.completion",
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello! How can I help today?" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 20, "completion_tokens": 9, "total_tokens": 29 }
}
```

Note: `model` in the response is the **resolved** identifier, not the alias. So requests with `"model": "fast"` come back with `"model": "gpt-4o-mini"`.

### Streaming

Pass `"stream": true`. Returns OpenAI-style SSE. See **[Streaming](/features/streaming/)**.

## `GET /v1/models`

### Request

```
GET /api/{uuid}/v1/models
Authorization: Bearer pg_live_...
```

### Response

```json
{
  "object": "list",
  "data": [
    { "id": "fast", "object": "model", "owned_by": "promptgate", "is_alias": true,
      "resolved": { "provider": "openai", "model": "gpt-4o-mini" } },
    { "id": "smart", "object": "model", "owned_by": "promptgate", "is_alias": true,
      "resolved": { "provider": "anthropic", "model": "claude-3-5-sonnet-20241022" } },
    { "id": "openai:*", "object": "model", "owned_by": "promptgate", "is_alias": false },
    { "id": "anthropic:*", "object": "promptgate", "owned_by": "promptgate", "is_alias": false }
  ]
}
```

`is_alias=true` rows are aliases the project has defined. `is_alias=false` rows are **placeholders** for enabled providers — clients can use any of that provider's models with the `provider:model` syntax.

The custom `resolved` field on alias rows tells you what the alias points to — useful for client UIs that want to show "fast = gpt-4o-mini".

## OpenAI SDK compatibility

The wrapper's request and response shapes are byte-compatible with OpenAI's, so you can use the OpenAI SDKs unchanged:

### Python

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/v1",
    api_key=os.environ['PG_TOKEN'],
)

# Non-streaming
resp = client.chat.completions.create(
    model="fast",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="smart",
    messages=[{"role": "user", "content": "Write a haiku about Mondays."}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### Node.js

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

### LangChain (Python)

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url=f"{PG_URL}/api/{PG_UUID}/v1",
    api_key=PG_TOKEN,
    model="fast",
)

print(llm.invoke("Hello!").content)
```

### Vercel AI SDK (Node)

```js
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const promptgate = createOpenAI({
    baseURL: `${PG_URL}/api/${PG_UUID}/v1`,
    apiKey: PG_TOKEN,
});

const { text } = await generateText({
    model: promptgate('fast'),
    prompt: 'Hello!',
});
```

## Behaviour reference

| Situation | Status |
|---|---|
| Success | 200 |
| Unknown alias | 404 |
| `provider:model` with provider not enabled in this wrapper | 400 |
| Wrong project type | 400 |
| No bearer token | 401 |
| Wrong scope | 403 |
| Token from different project | 403 |
| Provider call fails after failover (if any) | 502 |

## Differences from real OpenAI

- **No `n > 1`** — only one choice is returned per request.
- **No `function_call` / `tools`** — function calling is roadmap.
- **No `logprobs`** — not exposed.
- **`model` in response is the resolved identifier**, not the alias the client sent.
- **Token counts** come from the provider's response and may differ slightly from OpenAI's tokenizer (e.g. Anthropic returns its own counts).

For most production usage these don't matter; for advanced features that aren't yet supported, check back or use the AI Gateway directly with provider-specific endpoints.

---

Next: **[Proxy API](/api/proxy/)**.

---

> © Akyros Labs LLC. All rights reserved.
