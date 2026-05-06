---
title: Projects
description: The top-level container. Every endpoint, token, and policy belongs to a project.
---

A **project** is the top-level organisational unit in PromptGate. It owns the endpoints, the API tokens, the guardrail rules, the rate-limit configs, the OAuth connections, the MCP servers, and the audit trail for one application or one team.

Pick a `project_type` at create time (see **[Project Types](/concepts/project-types/)**) and the rest of the gateway adapts:

- The **sidebar** shows the items relevant to that type.
- The **public API surface** is wired according to the type.
- The **playground** and **logs** scope to the project.

## Anatomy of a project

| Field | Meaning |
|---|---|
| `name` | Human-readable name. Shown everywhere. |
| `slug` | URL-safe identifier. Auto-generated from the name. |
| `uuid` | Stable opaque identifier. **Used in every public URL** — `/api/{uuid}/...`. |
| `project_type` | One of `ai_gateway`, `ai_wrapper`, `api_gateway`, `mcp_gateway`. Stable for life. |
| `env` | `dev` / `staging` / `prod`. Tagged on logs and tokens. |
| `is_active` | Disabled projects refuse all traffic. |
| `metadata` | Free-form JSON for your own use. |

The UUID is the **only** project identifier that goes over the wire. The slug is for the UI's URL, not for the public API.

## Creating a project

Sidebar → **Projects** → **+ New project**.

![Project create modal — placeholder](#)

In the modal:

- **Name** — descriptive (e.g. `Customer Support AI`, `GitHub Proxy`).
- **Type** — pick the right one. **You can't change this later.**
- **Environment** — `dev` / `staging` / `prod`.

After save you land on the project, and the sidebar swaps into project-scoped mode.

## Switching between projects

The **project switcher** at the top of the sidebar shows your currently active project. Click it to pick another. The session remembers your last selection.

If you have many projects, you can also navigate to **Sidebar → Manage projects** for the full searchable list.

## Project settings

Inside a project: **Sidebar → Project Settings** (bottom of sidebar).

You can edit:

- **Name**
- **Environment**
- **Metadata** JSON

You can't edit:

- **Type** — pick a new project of the right type and migrate.
- **UUID** — it's woven into all the URLs and tokens.
- **Slug** — it's woven into endpoint URLs (for AI Gateway).

The same page has a **Danger Zone** for project deletion. Deleting a project cascades to **everything** that belongs to it: endpoints, tokens, logs, audit, guardrail configs, OAuth connections, MCP servers. Take a backup first if you might want any of that data later.

## What lives in a project vs. globally

PromptGate has a deliberate split between **per-project** and **global** resources:

| Resource | Scope | Why |
|---|---|---|
| `credentials` | **Global (admin)** | A single API key for OpenAI is reusable across projects. |
| `provider_templates` | **Global (admin)** | Reusable provider+model+settings bundles. |
| `provider_settings` (enable/disable) | **Global (admin)** | Disabling a provider should disable it everywhere. |
| `users` | **Global (admin)** | Single-user in Community Edition. |
| Endpoints (`endpoints`, `api_gateway_endpoints`) | **Per-project** | Endpoints are the project's product surface. |
| API tokens | **Per-project** | Each project has its own clients. |
| Guardrail configs | **3-level** — global → project → endpoint | Inherits down the chain. |
| Rate limits / budgets | **Per-endpoint** | Configured on the endpoint itself. |
| OAuth connections | **Per-project** (api_gateway only) | Different proxies need different OAuth clients. |
| MCP servers | **Per-project** (mcp_gateway only) | Each gateway aggregates a different set. |
| Webhooks | **Per-project** | Each project notifies its own destinations. |
| Sessions | **Per-endpoint** (ai_gateway) | Conversation state attaches to the endpoint that owns it. |

The **Admin** area in the user dropdown (top-right) is where the global resources live: Credentials, AI Providers, Provider Templates, Global Guardrails, Audit Log, Backup / Export.

## Project type reference

Brief recap of what each type unlocks. Full details on each linked page.

### `ai_gateway` — [docs](/features/ai-endpoints/)
- AI endpoints with prompts, schemas, sessions, streaming, failover
- MCP Bridge (every endpoint can be exposed as an MCP tool)
- Guardrails / rate limits / budgets

### `ai_wrapper` — [docs](/features/ai-wrapper/)
- OpenAI-compatible `/v1/chat/completions` and `/v1/models`
- Per-project provider→credential assignment
- Model aliases (`fast` → `openai:gpt-4o-mini`)

### `api_gateway` — [docs](/features/api-gateway/)
- HTTP proxy endpoints with method allowlist + header policies
- OAuth Service Connections (encrypted, auto-refresh)
- SSRF guard, rate limits

### `mcp_gateway` — [docs](/mcp/gateway/)
- Aggregates registered upstream MCP servers under one URL
- Tool-name namespacing (`<prefix>__<tool>`)
- Encrypted upstream Bearer tokens

## API surface

Every project's public API lives under `/api/{project_uuid}/…`. The exact paths depend on the type — see **[API Reference → Overview](/api/overview/)** for the full inventory.

For introspection (admin scope):

```
GET /api/{uuid}/info       — type, env, name, counts
GET /api/{uuid}/endpoints  — list endpoints (AI or API)
GET /api/{uuid}/tokens     — list issued tokens (no plaintext)
```

## Audit

Every state-change on a project — create, update, deactivate, delete — writes to `audit_logs`. Filter by project on the **Audit Log** page (admin) to see the full history.

---

Next: **[AI Endpoints](/features/ai-endpoints/)**.

---

> © Akyros Labs LLC. All rights reserved.
