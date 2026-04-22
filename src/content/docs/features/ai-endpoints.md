---
title: AI Endpoints
description: Fixed-prompt AI execution points
---

:::note
AI Endpoints are under active development and not yet available. This page describes the planned functionality.
:::

AI Endpoints are the core feature of AI Gateway projects. Each endpoint is a callable URL that binds a fixed system prompt, a provider template, and access controls into a single execution point.

## Concept

Unlike a generic chat API where the caller provides the full prompt, PromptGate endpoints lock down the system prompt on the server side. The caller only provides the user input. This gives you:

- **Prompt security** — System prompts cannot be modified or extracted by callers
- **Consistent behavior** — Every call to the endpoint uses the same instructions
- **Simplified client integration** — Callers send input, get output; no prompt engineering required

## Planned features

### Fixed system prompts

Each endpoint has a system prompt defined by the administrator. The prompt is stored on the server and injected into every request. Callers cannot see or modify it.

```
Caller sends:  { "input": "Summarize this article: ..." }
Endpoint adds: System prompt + user input → Provider API
Caller gets:   { "output": "The article discusses..." }
```

### Provider routing

Endpoints reference a [provider template](/features/provider-templates/) that determines which provider and model handles the request. Changing the template switches the backing model for all callers without any client-side changes.

### Streaming

Endpoints will support server-sent events (SSE) for streaming responses. Callers can receive tokens as they are generated instead of waiting for the full response.

### Sessions

Optional session support enables multi-turn conversations within an endpoint. PromptGate manages the conversation history server-side, so the caller only sends new messages.

### Budget controls

Set spending limits on a per-endpoint basis:

- **Token budget** — Maximum tokens per request, per hour, or per day
- **Cost budget** — Maximum dollar spend per endpoint over a time window
- **Rate limits** — Maximum requests per minute per client token

When a budget is exceeded, the endpoint returns an error instead of forwarding the request.

### Schema validation

Define input and output schemas for your endpoints. PromptGate validates the caller's input against the schema before processing and can enforce structured output from the AI provider.

### MCP Bridge exposure

Endpoints can optionally be exposed as MCP tools. See [MCP Bridge](/features/mcp-bridge/) for details.
