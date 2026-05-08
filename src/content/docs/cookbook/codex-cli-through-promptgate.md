---
title: Codex CLI through PromptGate
description: Point OpenAI's Codex CLI at your PromptGate Agent Proxy via OPENAI_BASE_URL. Same observability + guardrails that you get for Claude Code, on the OpenAI Responses API surface.
---

Codex CLI uses OpenAI's newer **Responses API** (`POST /v1/responses`) — different envelope from Chat Completions, agentic-by-default with multi-step tool calls. PromptGate's Agent Proxy speaks that surface natively, so Codex routing is the same one-env-var move.

## Prerequisites

- An Agent Proxy project (see the [Claude Code recipe](/cookbook/claude-code-through-promptgate/) for setup).
- An OpenAI credential under **Credentials**, OpenAI provider toggled on under the project's **Providers** entry.
- An API token with the `chat` scope.

## Setup

```bash
export OPENAI_BASE_URL="https://your-promptgate-host/api/<project-uuid>/v1"
export OPENAI_API_KEY="pg_live_..."
```

The `/v1` suffix is important — Codex appends `/responses` to whatever you set as the base URL.

Restart Codex CLI. Run any session.

## What you get on the Responses API surface

The exact same observability as on Chat Completions:

- **Live Logs** show every request with the input + output items + tool calls
- **Cost Dashboard** aggregates spend across Codex AND any other agent in the same project
- **Reversible Redaction** runs on the `input` field and `instructions` field — works the same as on Chat Completions
- **Secret Scanner** intercepts before the request reaches OpenAI

## Cross-routing trick

Because PromptGate translates between API shapes internally, you can target a **non-OpenAI provider** from Codex:

```bash
# In your wrapper aliases, define:
#   alias "smart" → anthropic:claude-3-5-sonnet
#
# Then Codex calls /v1/responses with model: "smart" and gets
# a Claude response wrapped in OpenAI's Responses envelope.
```

This is useful when:

- Anthropic gives a better response on a particular task but you've standardized on the Codex CLI ergonomics.
- You want to A/B different providers without changing the agent's UX.

## Troubleshooting

- **`Cannot find route POST /api/<uuid>/v1/responses`:** the project type is wrong. Codex expects `/v1/responses` on the Agent Proxy or AI Wrapper project type.
- **400 with `invalid_project_type`:** the token belongs to an `ai_gateway` project — those use the per-endpoint URL `/api/<uuid>/<slug>`, not the wrapper-style URL.

## Cost note

Codex CLI defaults to OpenAI's frontier model. **Set up a routing rule** that drops simple-tool-result-summarization calls to gpt-4o-mini. Typical agent-style workloads have a long tail of small post-tool-call summaries that don't need a frontier model — easy 5-10× cost reduction.

---

> © Akyros Labs LLC. All rights reserved.
