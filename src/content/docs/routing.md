---
title: "Routing and keys"
description: "PromptGate serves the OpenAI and Anthropic API paths, so the whole integration is one environment variable:"
---

<!-- Generated from docs/routing.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate serves the OpenAI and Anthropic API paths, so the whole
integration is one environment variable:

```bash
export OPENAI_BASE_URL=http://127.0.0.1:7878/v1      # OpenAI SDKs, Codex
export ANTHROPIC_BASE_URL=http://127.0.0.1:7878      # Anthropic SDKs, Claude Code
```

| path | format |
|---|---|
| `POST /v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/responses`, `GET /v1/models` | OpenAI |
| `POST /v1/messages`, `/v1/messages/count_tokens` | Anthropic |
| `GET /healthz` | status |

## Which provider serves a request

The first rule that applies wins:

1. **Model alias** — `"model": "fast"` or `"model": "promptgate:fast"` uses
   the alias from `models:` (see below). An unknown `promptgate:` name is
   an error; operator-defined aliases win over every other rule.
2. **Header** `X-PromptGate-Provider: groq`
3. **Model prefix** `"model": "groq:llama-3.3-70b"` — the prefix is removed
   before the request is forwarded. Only names of configured providers
   count, so Ollama tags like `llama3:8b` are left alone.
4. **Key prefix** — a passthrough key with a distinctive prefix routes
   itself: `sk-ant-…` → anthropic, `gsk_…` → groq, `sk-or-…` → openrouter,
   `xai-…` → xai, `AIza…` → gemini.
5. **Default provider** — `--provider` / `PROMPTGATE_PROVIDER` /
   `default_provider` (default `openai`). Anthropic paths fall back to
   `anthropic` when the default doesn't speak the Messages API.

Chat requests reach every provider in either format: when client and
provider speak different formats, PromptGate translates the request and
the answer, streams included — so Claude Code can run on GPT, Llama or
Gemini (`ANTHROPIC_MODEL=openai:gpt-5`, or an alias). Same-format traffic
is forwarded byte for byte. Details and limits: [formats](/formats/).

## Model aliases

```yaml
models:
  fast:
    provider: groq
    model: llama-3.3-70b-versatile
    system: Answer briefly.          # used only if the request has no system prompt
    params: { temperature: 0.2, max_tokens: 500 }   # set only where the request is silent
  smart:
    provider: anthropic
    model: claude-sonnet-4-5
```

Clients send `"model": "fast"` and never learn the real model or provider.
The system prompt lands where each API expects it — a leading system
message (OpenAI Chat), `instructions` (OpenAI Responses) or `system`
(Anthropic) — and is skipped when the request already has one. `params`
use the provider's own field names; `model`, `messages`, `input`,
`system` and `stream` can't be set by an alias.

## Fallbacks

An alias can name fallbacks — other aliases or `provider:model` — that take
over when its provider fails:

```yaml
models:
  smart:
    provider: anthropic
    model: claude-sonnet-4-5
    system: Think step by step.
    fallbacks: [openai:gpt-4o, fast]     # tried in this order
    fallback_on: [429, 5xx, unreachable] # the default
  fast:
    provider: groq
    model: llama-3.3-70b-versatile
```

PromptGate moves on to the next fallback when the provider

- answers with a status listed in `fallback_on` — exact codes (`529`),
  classes (`5xx`, `4xx`) — before any byte reached the client,
- can't be reached at all (`unreachable`: connection refused, DNS, TLS), or
- is at its [rate limit](/limits/) or out of [budget](/budgets/) in
  PromptGate (spillover).

Other errors, such as 400 for a bad request, are returned as they are: another
provider wouldn't do better. The last fallback's answer always reaches the
client unchanged, whatever its status. Once a response has started
streaming it is never switched.

A `provider:model` fallback keeps the alias's `system` and `params`; an alias
fallback uses its own. Fallbacks don't chain: an alias named as a fallback is
tried with its own provider only.

**Keys.** Fallbacks to another provider need a `pg_` key, because PromptGate sends
its server-side key for that provider. A passthrough key (the caller's own
provider key) is never sent to a different provider, so passthrough callers
only fall back to the same provider, for example a smaller model, or to
providers without auth (Ollama). On the Anthropic Messages route, only
Anthropic fallbacks apply until format translation lands.

The request log and the console show the failed attempts before the
answer, for example `after anthropic 529`; `promptgate logs --json` has
them as `fallback`. If no candidate can serve the request, the answer is 503
`no provider could serve the request: anthropic 529, openai rate-limited`.

Tip: an alias may have the name of a real model. `gpt-4o: {provider: openai,
model: gpt-4o, fallbacks: [azure:gpt-4o]}` gives existing clients a
fallback without changing their code.

## Keys

Send your own provider key (passthrough) or a `pg_` key. With a `pg_` key
PromptGate uses the server-side provider key from the config, and the key's
`providers` restriction applies. Requests without a key get 401 — server-side
keys are never used anonymously. See [configuration](/configuration/#auth-modes).

**Claude Code with a Claude subscription.** Claude Code signed in with
Pro or Max (no API key) works through PromptGate as it is: its access
token (`sk-ant-oat…`) passes through to Anthropic as a bearer token,
with Claude Code's own headers, and the guardrails, limits and request
log apply. Set only `ANTHROPIC_BASE_URL`, or let `promptgate connect
claude-code` set it in Claude Code's settings. The cost in the log is what
the tokens would cost on the API; the subscription is billed as usual.

Manage `pg_` keys with `promptgate keys create <name> [--provider openai]`,
`list`, `revoke`, `enable` and `delete` — changes take effect within seconds,
no restart needed. Per-key request rates are set under
[`limits:`](/limits/). One key can serve many people: requests name their
[end user](/users/), and `--users required` makes that mandatory.

Errors come back in the shape your SDK expects (OpenAI or Anthropic), and
every response carries `X-PromptGate-Provider` naming the upstream.
