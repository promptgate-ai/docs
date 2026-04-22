---
title: AI Wrapper
description: OpenAI-compatible API surface
---

:::note
AI Wrapper is under active development and not yet available. This page describes the planned functionality.
:::

AI Wrapper projects expose an OpenAI-compatible API that routes requests to any configured provider behind the scenes. If your application already uses the OpenAI SDK, you can point it at PromptGate instead and gain centralized management without changing your code.

## Concept

Many applications integrate with AI providers using the OpenAI client library. AI Wrapper makes PromptGate a drop-in replacement for the OpenAI API:

```python
from openai import OpenAI

# Point the OpenAI client at PromptGate instead
client = OpenAI(
    base_url="https://gateway.example.com/api/v1/wrapper",
    api_key="pg_live_...",  # PromptGate client token
)

response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4-20250514",  # Route to any provider
    messages=[{"role": "user", "content": "Hello!"}],
)
```

## Planned features

### Provider:model routing

Specify the provider and model using a `provider/model` format in the `model` field:

- `openai/gpt-4o` — Routes to OpenAI's GPT-4o
- `anthropic/claude-sonnet-4-20250514` — Routes to Anthropic's Claude Sonnet
- `google/gemini-2.0-flash` — Routes to Google's Gemini Flash

PromptGate resolves the provider, selects the appropriate credential from the project, and forwards the request.

### Model aliases

Define short aliases for commonly used provider:model combinations:

| Alias | Routes to |
|---|---|
| `default` | `anthropic/claude-sonnet-4-20250514` |
| `fast` | `openai/gpt-4o-mini` |
| `smart` | `anthropic/claude-opus-4-20250514` |

Callers use the alias in the `model` field, and PromptGate resolves it to the configured provider and model.

### OpenAI-compatible chat completions

The wrapper implements the OpenAI chat completions API format:

- `POST /api/v1/wrapper/chat/completions` — Create a chat completion
- Supports `messages`, `model`, `temperature`, `max_tokens`, `stream`, and other standard parameters
- Returns responses in the same format as the OpenAI API

### Credential management

PromptGate handles provider authentication. Callers authenticate with a PromptGate client token — they never see or need the underlying provider API keys.

### Logging and budget controls

All requests through the wrapper are logged and subject to the same budget controls and rate limits as AI Endpoints.
