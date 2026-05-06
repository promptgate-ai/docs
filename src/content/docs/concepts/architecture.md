---
title: Architecture
description: The mental model — how a request flows through PromptGate.
---

PromptGate is a Laravel 12 monolith running on FrankenPHP. It exposes a **web UI** for management and a **public API** for runtime traffic. Requests follow predictable pipelines depending on which type of project they hit.

## Components

```
┌─────────────────┐     ┌──────────────────────────────────┐
│  Your client    │     │           PromptGate             │
│  (curl, SDK,    │────▶│                                  │     ┌────────────────┐
│   MCP client)   │     │  Token auth ─▶ scope check       │────▶│   Provider     │
└─────────────────┘     │  Project guard                   │     │ (OpenAI,       │
                        │  Rate limit                      │     │  Anthropic,    │
                        │  Budget enforce (AI only)        │     │  Mistral, …)   │
                        │  Guardrails (PII, Injection, …)  │     │                │
                        │  Schema validate (input)         │     │   …or…         │
                        │  Provider call                   │     │                │
                        │  Schema validate (output)        │     │  Upstream API  │
                        │  Audit + log to gateway_logs     │     │  (any HTTP)    │
                        └──────────────────────────────────┘     │                │
                                                                 │   …or…         │
                                                                 │                │
                                                                 │  Upstream MCP  │
                                                                 │  server        │
                                                                 └────────────────┘
```

## Project types

Every project has one of four types. The type determines which routes are wired and which sidebar items are shown:

| Type | Public API surface | Use case |
|---|---|---|
| `ai_gateway` | `POST /api/{uuid}/{slug}` <br/> `POST /api/{uuid}/chat/completions` | Custom AI endpoints with prompts, schemas, sessions, streaming |
| `ai_wrapper` | `POST /api/{uuid}/v1/chat/completions` <br/> `GET /api/{uuid}/v1/models` | OpenAI-compatible front for any registered provider |
| `api_gateway` | `ANY /api/{uuid}/proxy/{slug}/{path?}` | Generic HTTP proxy with method/header policies + OAuth |
| `mcp_gateway` | `POST /api/{uuid}/mcp` | Aggregates upstream MCP servers under one URL |

See **[Project Types](/concepts/project-types/)** for the full picture.

## Plus three "type-less" surfaces

These don't belong to a single project type:

| Path | Purpose |
|---|---|
| `POST /api/{uuid}/mcp` (when project is `ai_gateway`) | **MCP Bridge** — exposes the project's AI endpoints as MCP tools |
| `POST /api/control/mcp` | **MCP Control Plane** — manage PromptGate itself via MCP (admin scope) |
| `GET /api/{uuid}/info`, `GET /api/{uuid}/endpoints`, `GET /api/{uuid}/tokens` | Admin / discovery (admin scope) |

## Request pipeline (AI Gateway)

```
1. Auth          AuthenticateApiToken middleware
                 - Bearer token present?
                 - Token belongs to this project?
                 - Token has chat scope?

2. Rate limit    EndpointRateLimiter
                 - per-minute bucket OK?
                 - per-hour bucket OK?
                 → 429 with Retry-After if not

3. Budget        EndpointBudgetEnforcer
                 - estimated input tokens ≤ usage_hard_limit_tokens?
                 - month-to-date spend < monthly_budget_usd?
                 → 422 if not

4. Guardrails    GuardrailService.runGuardrails (in order)
                 - PII filter (regex + optional contextual LLM)
                 - Prompt injection
                 - Keyword blocklist
                 - Content length cap
                 → 422 in block mode, redacted text in mask mode

5. Input schema  Validates messages payload against endpoint.input_schema

6. Prompt apply  System prompt prepended; user-template applied

7. Provider      Resolved via Endpoint → ProviderTemplate (or manual)
                 → Provider adapter calls upstream
                 → Failover chain on RuntimeException

8. Output schema Validates assistant.content against endpoint.output_schema

9. Log + audit   GatewayLog row + AuditLogger entries
```

## Request pipeline (AI Wrapper)

Almost identical to AI Gateway, but the model identifier comes from the request body (`{ "model": "openai:gpt-4o-mini" }` or `{ "model": "fast" }` for an alias) instead of being baked into the endpoint config.

## Request pipeline (API Gateway)

```
1. Auth           Bearer token, proxy scope.
2. Rate limit     Same as AI Gateway, scoped to API endpoint.
3. SSRF check     UpstreamUrlValidator — blocks loopback / private IPs.
4. Header build   Forward client headers per allowlist;
                  inject configured headers;
                  if oauth_connection_id is set, refresh token if needed
                  and override Authorization with the OAuth bearer.
5. Forward        Http::send($method, $upstream, $body, $headers).
6. Log            GatewayLog row tagged provider_key=http.
```

## Request pipeline (MCP)

```
1. Auth      Bearer token, mcp scope.
2. Dispatch  By project type:
             - ai_gateway  → McpServerService (Bridge)
             - mcp_gateway → McpGatewayService (aggregator)
3. JSON-RPC  initialize / tools/list / tools/call / ping / batch
4. Bridge:   tools/list returns endpoints with expose_as_mcp_tool=true.
             tools/call delegates to GatewayService.execute (full pipeline).
5. Gateway:  tools/list fans out to every registered upstream MCP server
             and prefixes tool names with each server's namespace.
             tools/call splits the prefix off, looks up the server,
             forwards the JSON-RPC envelope.
```

## Persistence layer

All Eloquent. Migrations live in `backend/database/migrations/`. The interesting tables:

- `users` — admin login (single-user in Community Edition)
- `projects` — top-level container; has a type
- `endpoints` — AI Gateway endpoints
- `api_gateway_endpoints` — HTTP proxy endpoints
- `mcp_servers` — upstream MCP servers (for `mcp_gateway` projects)
- `oauth_service_connections` — OAuth 2.0 clients (for API Gateway)
- `credentials` — provider API keys (encrypted)
- `provider_templates` — reusable provider+model+credential bundles
- `provider_settings` — per-provider enable/disable
- `guardrail_configs` — global / project / endpoint scoped rules
- `api_tokens` — SHA-256 hashed bearer tokens with scopes
- `gateway_logs` — every request, with status / latency / tokens
- `audit_logs` — every state-changing event
- `webhooks` + `webhook_deliveries` — outbound HMAC notifications

Encrypted columns: `credentials.secret`, `oauth_service_connections.{client_secret, access_token, refresh_token}`, `mcp_servers.auth_token`. They use Laravel's `encrypted` cast (AES-256-GCM keyed by `APP_KEY`).

## Observability

Every request that reaches the public API is recorded in `gateway_logs`:

```
request_id | project | endpoint_slug | provider | model | status | latency_ms | tokens | error_message
```

Every state-changing UI / API action is recorded in `audit_logs`:

```
event | severity | actor | project | target | metadata | created_at
```

The dashboard, metrics, live logs, and audit log views are all driven by these two tables. Webhooks fire from `audit_logs` insertion.

## Security boundaries

- **Login session**: server-side, regenerates on auth. Database-backed by default; switch to Redis for HA.
- **API tokens**: SHA-256 hashed on create, plaintext shown once. Scopes enforced per route group: `chat`, `models`, `admin`, `proxy`, `mcp`.
- **Encrypted at rest**: every secret column. Lose the `APP_KEY` and the data is unrecoverable — back it up.
- **HTTPS-aware**: behind a reverse proxy with `X-Forwarded-Proto`, `URL::forceScheme('https')` keeps generated URLs correct.
- **CSRF**: enforced for the web UI (Laravel default). API routes are bearer-token only.
- **SSRF**: API Gateway upstream URLs validated at create AND proxy time.

---

Next: **[Project Types](/concepts/project-types/)** — pick the right one for your use case.

---

> © Akyros Labs LLC. All rights reserved.
