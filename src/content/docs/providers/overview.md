---
title: Providers Overview
description: The 8 built-in AI provider adapters.
---

PromptGate ships with **8 built-in provider adapters**. Adding a credential and picking a model is enough to start routing — no extra config needed.

| Provider | Base URL | Streaming | Adapter strategy |
|---|---|---|---|
| **OpenAI** | `https://api.openai.com/v1` | ✅ | OpenAI-compatible (uses `max_completion_tokens`) |
| **Anthropic** | `https://api.anthropic.com/v1` | ✅ | Native (lifts system messages, x-api-key auth) |
| **Google Gemini** | _provider-specific_ | ✅ | Native |
| **Mistral** | `https://api.mistral.ai/v1` | ✅ | OpenAI-compatible |
| **Groq** | `https://api.groq.com/openai/v1` | ✅ | OpenAI-compatible |
| **Together AI** | `https://api.together.xyz/v1` | ✅ | OpenAI-compatible (Llama, Mixtral, DeepSeek, Qwen) |
| **Ollama** | `$OLLAMA_BASE_URL` | ✅ | OpenAI-compatible, local |
| **Cohere** | `https://api.cohere.com/v2` | ✅ | Native (uppercase finish_reason mapping, `p` not `top_p`) |

Five of them (OpenAI, Mistral, Groq, Together, Ollama) share an `OpenAiCompatibleProvider` abstract base, so adding a new OpenAI-shaped provider is ~30 lines. The other three (Anthropic, Google, Cohere) implement `ProviderContract` directly because their APIs aren't OpenAI-shaped.

See **[Adding a Provider](/providers/adding/)** if you want to add one.

## Picking a provider

Some practical recommendations:

| Job | Pick |
|---|---|
| General-purpose, best output quality | **Anthropic** Claude Sonnet 4 / 4.5 / 4.6, **OpenAI** gpt-4o |
| Cheap + fast | **Groq** llama-3.1-8b-instant, **OpenAI** gpt-4o-mini |
| Long context | **Anthropic** Claude (200k+), **Google** Gemini |
| Vendor-lock-free open weights | **Together AI** Mixtral / Llama, **Ollama** local |
| Privacy / on-prem | **Ollama** |
| Multilingual | **Cohere** Command R+, **Mistral** large |

## Per-provider notes

### OpenAI

Uses **`max_completion_tokens`** rather than the classic `max_tokens` — required by newer chat models. The adapter handles the renaming internally; you set `max_output_tokens` on the endpoint and it lands as `max_completion_tokens` in the upstream request.

API key prefix: `sk-…`.

### Anthropic

Auth header is `x-api-key`, not `Authorization: Bearer …`. Requires `anthropic-version: 2023-06-01`.

System messages are lifted from `messages[]` into a top-level `system` field (Anthropic's API doesn't accept system inside messages). The adapter does this automatically.

API key prefix: `sk-ant-…`.

### Google Gemini

Uses Google's chat-style API. Currently configured for the public Generative Language API. API key in query string.

### Mistral

Plain OpenAI-compatible. Uses classic `max_tokens`. Drop your Mistral La Plateforme key in.

### Groq

Plain OpenAI-compatible. Famously fast (custom hardware). Best with Llama / Mixtral / Gemma models.

API key prefix: `gsk_…`.

### Together AI

Plain OpenAI-compatible. Wide model catalogue: Llama 3.x, Mixtral, DeepSeek, Qwen, Code Llama, etc. Set the `provider_model` to the full Together identifier (`mistralai/Mixtral-8x7B-Instruct-v0.1`).

API key prefix: `tk_…`.

### Ollama

Local. Configure the base URL via `OLLAMA_BASE_URL` (default `http://localhost:11434/v1`). Auth is sent but ignored by Ollama — any non-empty placeholder is fine.

Use this when you want local models with zero data egress.

### Cohere

The most divergent of the eight. Cohere v2 chat:

- Response is `message.content[]` (array of text blocks) instead of `choices[]`
- `finish_reason` values are uppercase: `COMPLETE`, `MAX_TOKENS`, `STOP_SEQUENCE`, `TOOL_CALL`, `ERROR`
- Top-p parameter is named `p`, not `top_p`
- Temperature is capped at `1.0` (OpenAI allows `2.0`)

The adapter handles all of these — your endpoint config uses the same fields as any other provider, but the upstream call uses Cohere's wire format.

API key prefix: usually `co_…`.

## Provider settings (enable / disable)

The admin **Providers** page lets you enable/disable any of the eight gateway-wide. A disabled provider rejects every request that targets it with a `503 Provider disabled in this gateway`. Use this to e.g. disable OpenAI temporarily during an incident without touching credentials.

See **[Provider Settings](/providers/settings/)**.

## Failover across providers

Endpoint configurations support a **failover chain**: a list of `(credential, model)` pairs that are tried in order if the primary fails. This is provider-aware — you can fail over from OpenAI to Anthropic, or to Groq's faster Llama variant.

See **[AI Endpoints → Tab 2](/features/ai-endpoints/#tab-2--provider)**.

---

Next: **[Credentials](/features/credentials/)**.

---

> © Akyros Labs LLC. All rights reserved.
