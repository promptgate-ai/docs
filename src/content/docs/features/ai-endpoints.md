---
title: AI Endpoints
description: Fixed-prompt AI execution points with provider routing
---

AI Endpoints are the core building block of the AI Gateway. Each endpoint defines a fixed system prompt, a provider configuration, and runtime settings. Your application sends user input to the endpoint URL; PromptGate injects the system prompt, calls the AI provider, and returns the result.

## Creating an Endpoint

Navigate to your project → **AI Endpoints** → **New endpoint**. The wizard has 6 steps:

### 1. Core

- **Endpoint Name** — displayed in dashboards and logs
- **Slug** — auto-generated from the name, used in the API URL
- **Expose as MCP tool** — when enabled, AI agents can discover this endpoint via the MCP Bridge

The endpoint URL will be: `POST /api/v1/{project-slug}/{endpoint-slug}`

### 2. Provider & Runtime

Choose how the endpoint connects to an AI provider:

**Use Provider Template** — select a pre-configured template that bundles provider + model + settings. All template values are applied automatically.

**Configure manually** — pick each setting individually:
- **Provider Key** — which AI provider to use (OpenAI, Anthropic, etc.)
- **Provider Credential** — the API key to authenticate with (filtered by provider)
- **Provider Model** — which model to call (e.g. `gpt-4o-mini`)

**Failover** — add backup provider + model + credential combinations. If the primary fails, PromptGate automatically tries the next in the list.

**Temperature** — controls randomness (0 = deterministic, 2 = creative)

**Top P** — nucleus sampling threshold (0–1)

### 3. Limits

- **Max Output Tokens** — cap per response (slider, 1–16000)
- **Request Token Limit** — approximate max input tokens
- **Monthly Budget USD** — hard cap, endpoint returns 403 when reached
- **Cost per 1K Tokens** — used for cost estimates

### 4. Streaming

Enable Server-Sent Events (SSE) for real-time token delivery. When enabled, responses are streamed as they are generated instead of waiting for the full response.

### 5. Session

Enable server-side conversation state across multiple requests:

- **Session TTL** — auto-expire idle sessions (seconds)
- **Max Messages** — rolling message window
- **Max Tokens** — optional total token cap per session

Clients pass a `session_id` in the request; PromptGate stores message history server-side.

### 6. Prompt & Schema

- **Prompt** — the system message prepended to every request
- **Input Schema** — optional JSON schema to validate request bodies
- **Output Schema** — optional JSON schema to validate model responses

:::tip
Use `{{input}}` in the prompt to inject the user's message at a specific location.
:::

## Endpoint List

The endpoint index page shows all endpoints for the current project with:
- Name and slug
- Provider or template
- Active/inactive status
- Actions (deactivate)

## Template vs Manual

When using a **Provider Template**, the endpoint inherits the template's provider, model, and default settings. You can still override individual settings on the endpoint.

When configuring **manually**, you set everything directly on the endpoint.
