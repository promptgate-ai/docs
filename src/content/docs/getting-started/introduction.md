---
title: Introduction
description: PromptGate is a self-hosted AI gateway, API gateway, and MCP hub.
---

PromptGate is a **self-hosted gateway** that sits between your applications and the services they call — AI providers (OpenAI, Anthropic, Google, Mistral, Groq, Together, Ollama, Cohere), arbitrary HTTP APIs, and MCP (Model Context Protocol) servers. It centralises **credentials, observability, security, and policy** so you don't have to wire those concerns into every app.

> Built with Laravel 12, FrankenPHP, and a Claude-Design-inspired UI.

## What PromptGate does

| Project type | What it gives you |
|---|---|
| **AI Gateway** | First-class endpoints for AI providers with prompts, schemas, sessions, streaming, failover, guardrails, rate limits, budgets |
| **AI Wrapper** | OpenAI-compatible API surface (`/v1/chat/completions`, `/v1/models`) — point any OpenAI SDK at it and route across providers behind aliases |
| **API Gateway** | HTTP proxy for any upstream API with method allowlists, header policies, OAuth 2.0 service connections, SSRF guard, rate limits |
| **MCP Gateway** | Aggregate multiple upstream MCP servers under one endpoint with namespace prefixing, encrypted bearer tokens, and a Control Plane |

Plus on top of all of that:

- **8 built-in providers**: OpenAI · Anthropic · Google Gemini · Mistral · Groq · Together AI · Ollama (local) · Cohere
- **Guardrails**: PII filter (regex + LLM-based contextual), prompt-injection guard, keyword blocklist, content-length cap
- **Token system** with scopes (`chat`, `models`, `admin`, `proxy`, `mcp`) and per-project isolation
- **Observability** — dashboard, metrics, live logs, audit log, playground
- **Backup / restore** — one-click ZIP export of every table

## Who it's for

- **Solo developers** running an AI side project who want one place for credentials, costs, and rate limits.
- **Small teams** standing up an internal gateway so apps don't each carry their own provider keys.
- **Agentic tooling** that wants to expose existing AI endpoints — or proxy upstream services — as MCP tools.

## How this documentation is organised

- **[Getting Started](/getting-started/introduction/)** — install, configure, log in, hello world.
- **[Concepts](/concepts/architecture/)** — the mental model: project types, how requests flow.
- **[Projects & Endpoints](/features/projects/)** — defining what PromptGate exposes.
- **[Providers](/providers/overview/)** — registering credentials, picking models, swapping providers.
- **[Security](/security/authentication/)** — login, tokens, guardrails, rate limits, budgets, SSRF, audit.
- **[MCP](/mcp/overview/)** — bridge, gateway, and control plane (the trio).
- **[Observability](/observability/dashboard/)** — what you see in the UI.
- **[Administration](/admin/overview/)** — gateway-wide settings, webhooks, backup.
- **[API Reference](/api/overview/)** — every public endpoint with `curl`, Python, and Node.js examples.
- **[Plugins](/plugins/marketplace/)** — coming soon.
- **[Cookbook](/cookbook/openai-via-gateway/)** — task-oriented walkthroughs.

## License

PromptGate **Community Edition** is source-available under the **Business Source License 1.1** — free for internal / non-commercial use, with a change date after which it converts to Apache 2.0. The **Cloud Edition** (multi-tenant SaaS, RBAC, billing) is a separate commercial offering.

See **[Editions](/concepts/editions/)** for the full feature matrix and license details.

## Next steps

- **[Installation](/getting-started/installation/)** — clone the repo and `docker compose up`.
- **[Quick Start](/getting-started/quick-start/)** — create your first project and run a request end-to-end.
- **[Configuration](/getting-started/configuration/)** — every env variable that matters.

---

> © Akyros Labs LLC. All rights reserved.
