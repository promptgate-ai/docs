---
title: "Formats and translation"
description: "Clients speak one of two formats to PromptGate; providers speak one of five. When they differ, PromptGate translates the request on the way in and the answer…"
---

<!-- Generated from docs/formats.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Clients speak one of two formats to PromptGate; providers speak one of
five. When they differ, PromptGate translates the request on the way in
and the answer on the way out — buffered, streamed and errors alike.

| client path | format |
|---|---|
| `/v1/chat/completions` | OpenAI Chat Completions |
| `/v1/messages` | Anthropic Messages |

| provider `type` | presets | translated from |
|---|---|---|
| `openai`, `openai-compatible` | `openai`, `gemini`, `groq`, `mistral`, `together`, `deepseek`, `openrouter`, `xai`, `ollama` | Anthropic clients |
| `anthropic` | `anthropic` | — (OpenAI clients use Anthropic's OpenAI-compatible API, byte for byte) |
| `gemini` | `gemini-native` | OpenAI and Anthropic clients |
| `cohere` | `cohere` | OpenAI and Anthropic clients |

Same-format traffic is never decoded: the client's bytes go upstream with
only the model name (and alias settings) changed, and the answer streams
back untouched. Translation costs a decode and an encode per request and
per streamed event — about 1 µs per event (benchmark).

## Examples

```bash
# Claude Code on GPT-5 through a pg_ key
export ANTHROPIC_BASE_URL=http://127.0.0.1:7878
export ANTHROPIC_AUTH_TOKEN=pg_…
export ANTHROPIC_MODEL=openai:gpt-5
export ANTHROPIC_DEFAULT_HAIKU_MODEL=openai:gpt-5-mini   # background tasks
```

```yaml
# OpenAI SDKs on Gemini's native API and on Cohere
models:
  flash: { provider: gemini-native, model: gemini-2.5-flash }
  command: { provider: cohere, model: command-a-03-2025 }
```

Fallback chains may mix formats: an alias on `anthropic` can fall back to
`openai:gpt-5` for Claude Code, and each attempt is encoded for its own
provider.

## What is translated

| | |
|---|---|
| Messages | system prompt, user and assistant turns, text, images (base64 and URL) |
| Tools | definitions (JSON Schema), calls, results (text and images, error flag), `tool_choice` (auto, none, any/required, a named tool), parallel calls off |
| Parameters | `max_tokens`, `temperature`, `top_p`, `top_k`, stop sequences, `seed`, presence and frequency penalty, JSON output and JSON Schema (`response_format`) |
| Answers | text, tool calls, stop reason, token usage (incl. cached input) — streamed as the client's own event sequence |
| Errors | provider status kept, message in the client SDK's error shape (`provider openai: …`) |

Usage reaches the request log, budgets and metrics as with native
traffic; OpenAI-format streams are asked for usage automatically.

## What isn't

Content another format cannot express is refused with **400** instead of
being dropped silently: Anthropic documents, server tools (web search,
code execution) and built-in tool types, OpenAI audio and file parts,
`n > 1`. Hints that only one provider understands are dropped:
prompt-caching marks, extended-thinking settings and thinking blocks,
`metadata`, `logprobs`, `user`, `reasoning_effort`. Tool results with
images reach Chat Completions providers as a follow-up user message,
since tool messages carry text only; errors are marked with an `Error:`
prefix.

Only chat routes translate. Embeddings, completions, the Responses API,
`/v1/models` and `count_tokens` need a provider of their own format and
answer 400 otherwise (`provider cohere (cohere) cannot serve /v1/embeddings`).

Alias `params` are written onto the provider's request in its own
naming and only when absent, so for native Gemini they can add top-level
fields such as `safetySettings`, not keys inside `generationConfig`.

## Native adapters

**Gemini** (`gemini-native`) calls `models/{model}:generateContent`, and
`:streamGenerateContent?alt=sse` for streams, with the key in
`x-goog-api-key`. Tool schemas go in `parametersJsonSchema` and output
schemas in `responseJsonSchema`, so full JSON Schema works. Gemini
matches tool results to calls by name; thinking output is not passed on,
but its tokens count as output.

**Cohere** (`cohere`) calls the v2 Chat API (`/v2/chat`). The tool plan
Cohere writes before calling tools is not passed on. Image input needs a
vision model.
