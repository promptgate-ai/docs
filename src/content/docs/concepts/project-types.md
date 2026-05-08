---
title: Project Types
description: Pick the right project type — every other choice flows from this one.
---

PromptGate organises everything around **projects**. A project's `project_type` decides which routes are wired, which sidebar items show up, and which features apply. You pick a type at creation time and it's stable for the life of the project.

## The five types

| Type | Pick when… | Public path |
|---|---|---|
| `ai_gateway` | You want fully-controlled AI endpoints with prompts, schemas, sessions, streaming. | `POST /api/{uuid}/{slug}` |
| `ai_wrapper` | You want a drop-in OpenAI-compatible API for any registered provider. | `POST /api/{uuid}/v1/chat/completions` |
| `agent_proxy` | You want Claude Code / Codex / Cursor / Aider to route through PromptGate as their corporate egress gateway. | `POST /api/{uuid}/v1/{messages,responses,chat/completions,embeddings}` |
| `api_gateway` | You want to proxy any HTTP API with method/header policies + OAuth. | `ANY /api/{uuid}/proxy/{slug}/{path?}` |
| `mcp_gateway` | You want to aggregate multiple upstream MCP servers under one endpoint. | `POST /api/{uuid}/mcp` |

## AI Gateway (`ai_gateway`)

The most opinionated of the four. Each endpoint is a **first-class artefact** with:

- A pinned **provider + model + credential** (or a [Provider Template](/features/provider-templates/) reference)
- A **system prompt** and an optional `{{input}}`-templated user prompt
- Optional **input / output JSON schemas**
- **Streaming** toggle
- **Sessions** — server-side conversation state with TTL / max-messages / max-tokens
- **Failover chain** — try secondary credentials when the primary fails
- **Rate limits** (per minute, per hour)
- **Budget caps** (tokens per request, USD per month)
- **Guardrails** (per-endpoint overrides on top of project + global rules)
- Optional `expose_as_mcp_tool` flag — the project's MCP Bridge serves the endpoint as a tool

Use this when you're building a real product: you know which model you want, you have a system prompt that matters, you want to redact PII, and you want to block runaway spend.

→ **[AI Endpoints](/features/ai-endpoints/)** for the full reference.

## AI Wrapper (`ai_wrapper`)

The OpenAI-compatible drop-in. Point any OpenAI SDK at:

```
POST /api/{uuid}/v1/chat/completions
GET  /api/{uuid}/v1/models
```

…and it Just Works. The model identifier in the request body picks the upstream:

- `openai:gpt-4o-mini` — direct provider:model pass-through
- `anthropic:claude-3-5-sonnet-20241022`
- `mistral:mistral-small`
- `fast` — a project-defined **alias** that resolves to one of the above

Aliases let you swap providers without changing client code. Per-provider credential assignment lets you e.g. use OpenAI's gpt-4o through a billing key while routing `fast` to Groq.

Use this when you have an existing app calling OpenAI and just want a gateway in front: API tokens, observability, guardrails, rate limits — without rewriting the client.

→ **[AI Wrapper](/features/ai-wrapper/)** for the full reference.

## Agent Proxy (`agent_proxy`)

The corporate-egress framing of the same engine. Same provider routing, model aliases, presets, response cache, and cost tracking as `ai_wrapper`, but with two additions that matter when coding agents are the clients:

- **Four API shapes on one project**: OpenAI Chat Completions (`/v1/chat/completions`), OpenAI Responses (`/v1/responses`), Anthropic Messages (`/v1/messages`), OpenAI Embeddings (`/v1/embeddings`). All four go through the same wrapper resolver so cross-provider routing works (e.g. Claude Code calls Anthropic shape, gets answered by GPT-4o-mini).
- **Default-secure egress guardrails**: [Reversible Redaction](/security/reversible-redaction/) (tokenize PII before the LLM call, restore on response) and the [Secret Scanner](/security/secret-scanner/) (catch AWS keys / GitHub PATs / private keys before they leak). Both are off by default; project-level config opts in.

The Setup page (`/projects/{p}/agent-proxy/setup`) renders copy-pasteable env-var snippets for Claude Code (`ANTHROPIC_BASE_URL`), Codex CLI (`OPENAI_BASE_URL`), Cursor / Aider / Continue / Cline — and shows a "Connected agents · last 7 days" panel inferred from `gateway_logs` so you can see who's actually using the proxy.

Use this when your team uses multiple coding agents and you want one cost dashboard, one audit trail, one PII / secret guardrail in front of all of them.

→ **[Agent Proxy](/concepts/agent-proxy/)** for the full reference.

## API Gateway (`api_gateway`)

A generic HTTP proxy. Each endpoint binds:

- An **upstream URL** (`https://api.example.com/v1`)
- An **allowed methods** list (`GET`, `POST`, …)
- A **forward headers** allowlist (empty = all client headers)
- A **blocked headers** list (always blocks `Host`, `Authorization`, `Cookie`, `Content-Length`)
- **Inject headers** (server-side secrets the client never sees)
- An optional **OAuth Service Connection** — token gets injected as `Authorization: Bearer …` upstream and refreshed automatically
- **Rate limits** per minute / per hour
- A **timeout**
- An **SSRF guard** that runs at create AND request time

Use this when you want to put a token-gated, audited, rate-limited proxy in front of any HTTP API — including ones that need OAuth tokens (Google, GitHub, Slack, Notion, …).

→ **[API Gateway](/features/api-gateway/)** for the full reference.

## MCP Gateway (`mcp_gateway`)

Aggregator for the [Model Context Protocol](https://modelcontextprotocol.io). You register upstream MCP servers (URL + optional Bearer token); the project exposes a single `POST /api/{uuid}/mcp` endpoint where:

- `tools/list` fans out to every server, prefixes tool names with each server's namespace, returns the union
- `tools/call` looks at the prefix on the requested tool name, routes to the right upstream, strips the prefix, forwards the call
- Bearer tokens for upstream MCP servers are encrypted at rest

Use this when an agent needs access to multiple MCP servers and you'd rather hand it one endpoint than configure each agent with N URLs.

→ **[MCP Gateway](/mcp/gateway/)** for the full reference.

## What about the MCP Bridge?

The Bridge is **not a project type** — it's a **feature of `ai_gateway` projects**. Every AI Gateway project automatically exposes a `POST /api/{uuid}/mcp` route that serves any of its endpoints (where `expose_as_mcp_tool=true`) as MCP tools. So an AI agent can call your project's endpoints via JSON-RPC without you running a separate MCP server.

→ **[MCP Bridge](/features/mcp-bridge/)** for the full reference.

## Can I have multiple projects with different types?

Yes — that's the recommended pattern. A single PromptGate instance can host:

- Production AI Gateway projects with strict guardrails
- An AI Wrapper for ops scripts that want OpenAI-compat
- An API Gateway in front of GitHub for some internal tool
- An MCP Gateway aggregating community MCP servers

Each project has its own UUID, its own tokens, its own rate limits, its own audit trail.

## Switching types?

Not supported. The route wiring and the tables involved differ enough that the safe path is: create a new project of the desired type, copy what you need (endpoints, credentials, etc.), retire the old one. The [Backup / Export](/admin/backup/) ZIP makes this less painful since you can grab any project's state as JSON.

---

Next: **[Editions](/concepts/editions/)** — what's in Community vs Cloud.

---

> © Akyros Labs LLC. All rights reserved.
