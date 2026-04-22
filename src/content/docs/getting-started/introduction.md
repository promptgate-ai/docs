---
title: Introduction
description: What is PromptGate and why use it
---

PromptGate is an open-source, self-hosted AI gateway platform built by [Akyros Labs LLC](https://akyros.com). It sits between your applications and AI providers, giving you centralized control over credentials, routing, budgets, and security.

## Why PromptGate?

Most teams integrate AI providers directly into their applications. This creates real problems as usage grows:

- **API keys scattered** across services, `.env` files, and team members
- **No visibility** into which app is calling which model, or how much it costs
- **No guardrails** — a single misconfigured prompt can burn through your budget
- **Provider lock-in** — switching from OpenAI to Anthropic means rewriting integration code

PromptGate solves these by acting as a single gateway layer.

## What it does

**Secure provider routing** — Define provider templates that bind a provider, model, and default settings into a reusable configuration. Route requests through PromptGate instead of calling providers directly.

**Encrypted credential storage** — Store provider API keys with AES-256-GCM encryption. Keys are displayed once at creation and never shown again.

**Project isolation** — Organize resources into projects, each with its own credentials, templates, and endpoints. Four project types cover different use cases: AI Gateway, AI Wrapper, API Gateway, and MCP Gateway.

**Budget controls** — Set spending limits per endpoint, per project, or per client token to prevent runaway costs. *(Coming soon)*

**MCP Bridge** — Automatically expose your AI endpoints as MCP (Model Context Protocol) tools, making them available to any MCP-compatible client. *(Coming soon)*

**Plugin marketplace** — Extend PromptGate with signed plugins for additional providers, guardrails, alerting, and more. *(Coming soon)*

## Architecture

PromptGate is built with:

- **Laravel 12** — PHP framework handling routing, authentication, encryption, and business logic
- **FrankenPHP** — High-performance PHP application server, packaged in Docker
- **SQLite / PostgreSQL / MySQL** — Your choice of database
- **Redis** — Optional, for caching and queue processing

The platform runs as a single Docker container or via `docker compose` for production deployments.

## Editions

**Community Edition** — Self-hosted, open-source under the Business Source License 1.1 (BSL 1.1). Free to use for internal purposes. The license converts to Apache 2.0 after the change date specified in the license file.

**Cloud Edition** — Managed hosting by Akyros Labs. *(Coming soon)*

## Next steps

- [Install PromptGate](/getting-started/installation/) with Docker in under a minute
- Follow the [Quick Start](/getting-started/quick-start/) to create your first project and provider template
- Read about [Configuration](/getting-started/configuration/) to customize your deployment
