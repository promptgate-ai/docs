---
title: Admin Area
description: Gateway-wide settings — credentials, providers, templates, global guardrails, audit, backup.
---

The **Admin Area** is reachable from the top-right user menu (your name → admin links). It hosts everything that's **gateway-wide** — not scoped to a single project.

When you're inside the admin area, the sidebar swaps into admin mode (no project switcher, no project-scoped items) and an "Administration" header appears at the top.

![Admin sidebar — placeholder](#)

## Sections

### Providers

- **Credentials** — encrypted provider API keys (see **[Credentials](/features/credentials/)**).
- **AI Providers** — list + enable/disable per provider (see **[Provider Settings](/providers/settings/)**).
- **Provider Templates** — reusable provider+model+credential bundles (see **[Provider Templates](/features/provider-templates/)**).

### Security

- **Guardrails** — global guardrail config that every project inherits (see **[Guardrails](/security/guardrails/)**).
- **Audit Log** — every state-changing event with filters and CSV export (see **[Audit Log](/security/audit-log/)**).

### System

- **Backup / Export** — one-click ZIP of every table (see **[Backup / Export](/admin/backup/)**).

## What's NOT in the admin area

These are **per-project** — they live inside each project's sidebar:

- AI / API gateway / MCP endpoints
- API tokens
- Project-scoped guardrails
- Webhooks (see **[Webhooks](/admin/webhooks/)** — labeled as Admin in this docs section because the UI lives in each project but the concept is gateway-administration-shaped)
- OAuth Service Connections
- MCP Servers
- Live Logs / Metrics / Playground

The split keeps "set this up once" things in admin and "configure for this app" things in project context. See **[Projects](/features/projects/)** for the full table.

## Single-user

In Community Edition, there's exactly one admin user. So "the admin area" is "everything you can do that's not project-scoped". Cloud Edition adds RBAC where some users have admin access and others don't (see **[Editions](/concepts/editions/)**).

## Admin API

Two surfaces:

| Path | Scope | What |
|---|---|---|
| `GET /api/{uuid}/info`, `/endpoints`, `/tokens` | `admin` | Per-project introspection — list endpoints, list tokens, project info |
| `POST /api/control/mcp` | `admin` | **MCP Control Plane** — full read + write surface across projects |

Both are bearer-token gated with the `admin` scope. See **[Authentication API](/api/auth/)** and **[Control Plane API](/api/control-plane/)**.

## Going back to a project

The admin sidebar has a **"← Back to workspace"** link at the bottom. Or click any project in the project switcher (which appears when you leave admin mode).

---

Next: **[Webhooks](/admin/webhooks/)**.

---

> © Akyros Labs LLC. All rights reserved.
