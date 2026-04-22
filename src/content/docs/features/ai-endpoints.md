---
title: AI Endpoints
description: Fixed-prompt AI execution points with provider routing
---

AI Endpoints are the core building block of the AI Gateway. Each endpoint defines a fixed system prompt, a provider configuration, and runtime settings. Your application sends user input to the endpoint URL; PromptGate injects the system prompt, calls the AI provider, and returns the result.

## Creating an Endpoint

Navigate to your project → **AI Endpoints** → **New endpoint**. The wizard has 7 steps:

### 1. Core

- **Endpoint Name** — displayed in dashboards and logs
- **Slug** — auto-generated from the name, used in the API URL
- **Expose as MCP tool** — when enabled, AI agents can discover this endpoint via the MCP Bridge

The endpoint URL will be: `POST /api/v1/endpoints/{endpoint-slug}`

### 2. Provider & Runtime

Choose how the endpoint connects to an AI provider:

**Use Provider Template** — select a pre-configured template that bundles provider + model + settings. All template values are applied automatically.

**Configure manually** — pick each setting individually:
- **Provider Key** — which AI provider to use (OpenAI, Anthropic, Google Gemini)
- **Provider Credential** — the API key to authenticate with (filtered by provider)
- **Provider Model** — which model to call (e.g. `gpt-4o-mini`)

**Failover** — add backup provider + model + credential combinations. If the primary fails (timeout, 5xx, rate limit), PromptGate automatically tries the next in the list. Runtime settings (temperature, top_p, max_tokens) are inherited from the primary endpoint.

**Temperature** — controls randomness (0 = deterministic, 2 = creative)

**Top P** — nucleus sampling threshold (0–1)

### 3. Limits

- **Max Output Tokens** — cap per response (slider, 1–200000)
- **Request Token Limit** — approximate max input tokens
- **Monthly Budget USD** — hard cap, endpoint returns 403 when reached
- **Cost per 1K Tokens** — used for cost estimates

### 4. Streaming

Enable Server-Sent Events (SSE) for real-time token delivery. When enabled and the client passes `"stream": true`, responses are streamed as they are generated in OpenAI-compatible SSE format (`data:` chunks ending with `data: [DONE]`).

### 5. Session

Enable server-side conversation state across multiple requests:

- **Session TTL** — auto-expire idle sessions (60s–7 days)
- **Max Messages** — message limit per session (1–500)
- **Max Tokens** — optional total token cap per session

When sessions are enabled, the gateway automatically creates a session on the first request and returns a `session_id` in the response. Subsequent requests include `session_id` to continue the conversation. The gateway stores the full message history server-side and prepends it to each provider call.

Sessions are enforced:
- Expired sessions are rejected (410) and deleted
- Sessions exceeding message or token limits are rejected (429)
- A session belongs to the token that created it — other tokens cannot access it
- Expired sessions are automatically purged hourly

### 6. Prompt

- **System Prompt** — the system message prepended to every request. The user never sees this.
- **User Prompt Template** — use `{{input}}` as placeholder for the user's message. If empty, the raw user message is sent directly.

### 7. Schema

- **Input Schema** — optional JSON Schema to validate request bodies. Invalid payloads are rejected (422) before reaching the provider.
- **Output Schema** — optional JSON Schema to validate model responses. Failed validation returns a 502 error.

## Calling an Endpoint

### Simple message

```bash
curl -X POST https://gateway.example.com/api/v1/endpoints/summarize \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain quantum computing."}'
```

### Full message history

```bash
curl -X POST https://gateway.example.com/api/v1/endpoints/summarize \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is AI?"},
      {"role": "assistant", "content": "AI is..."},
      {"role": "user", "content": "Tell me more."}
    ]
  }'
```

### With session

```bash
# First request — creates session
curl -X POST .../api/v1/endpoints/chat \
  -H "Authorization: Bearer pg_live_..." \
  -d '{"message": "Hello"}'
# Response includes: "meta": {"session_id": "uuid-here"}

# Continue conversation
curl -X POST .../api/v1/endpoints/chat \
  -H "Authorization: Bearer pg_live_..." \
  -d '{"message": "What did I just say?", "session_id": "uuid-here"}'
```

### Streaming

```bash
curl -X POST .../api/v1/endpoints/chat \
  -H "Authorization: Bearer pg_live_..." \
  -d '{"message": "Write a poem.", "stream": true}'
```

## Endpoint List

The endpoint index page shows all endpoints for the current project with:
- Name and slug
- Provider or template
- Active/inactive status
- Actions (deactivate)

## Template vs Manual

When using a **Provider Template**, the endpoint inherits the template's provider, model, credential, and default settings.

When configuring **manually**, you set everything directly on the endpoint.
