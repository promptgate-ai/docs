---
title: Audit Log
description: Append-only event log of every state-changing action — viewable, filterable, exportable.
---

The **Audit Log** records every state-changing event in PromptGate: logins, credential CRUD, token CRUD, endpoint CRUD, guardrail toggles, OAuth flows, backups, and more. Append-only by convention (no UI to delete), filterable by time / event / project, exportable as CSV.

## What gets logged

A non-exhaustive index of audit event keys:

### Auth

| Event | When |
|---|---|
| `auth.login` | Successful login |
| `auth.login_failed` | Wrong password / unknown user |
| `auth.logout` | User logged out |
| `auth.token_invalid` | API request with bad token |
| `auth.scope_missing` | API request with token lacking required scope |

### Projects

| Event | When |
|---|---|
| `project.created` | |
| `project.updated` | |
| `project.deleted` | |

### Endpoints (AI Gateway, API Gateway)

| Event | When |
|---|---|
| `endpoint.created` |  |
| `endpoint.updated` |  |
| `endpoint.deactivated` |  |
| `api_gateway_endpoint.created` | |
| `api_gateway_endpoint.updated` | |

### Credentials

| Event | When |
|---|---|
| `credential.created` | |
| `credential.updated` | |
| `credential.deactivated` | |
| `credential.deleted` | |

### Tokens

| Event | When |
|---|---|
| `token.created` | |
| `token.rotated` | |
| `token.revoked` | |
| `token.deleted` | |

### Guardrails

| Event | When |
|---|---|
| `guardrail.enabled` | Toggled on (project / global) |
| `guardrail.disabled` | Toggled off |
| `guardrail.blocked` | A request was blocked by a guardrail |

### Providers

| Event | When |
|---|---|
| `provider.enabled` | |
| `provider.disabled` | |

### MCP Servers (mcp_gateway)

| Event | When |
|---|---|
| `mcp_server.created` | |
| `mcp_server.updated` | |
| `mcp_server.deactivated` | |

### OAuth Connections

| Event | When |
|---|---|
| `oauth_connection.created` | |
| `oauth_connection.connect_initiated` | User clicked "Connect" |
| `oauth_connection.connected` | Token exchange succeeded |
| `oauth_connection.callback_error` | Provider returned `error=...` |
| `oauth_connection.exchange_failed` | Token exchange HTTP failure |
| `oauth_connection.disconnected` | Tokens cleared |
| `oauth_connection.deleted` | |

### Webhooks

| Event | When |
|---|---|
| `webhook.created` | |
| `webhook.test` | "Send test" button used |

### Backup / Export

| Event | When |
|---|---|
| `backup.exported` | A ZIP was downloaded |

### Control Plane (write tools, tagged `via=mcp_control_plane`)

| Event |
|---|
| `control_plane.project.created` |
| `control_plane.token.created` |
| `control_plane.token.rotated` |
| `control_plane.token.revoked` |
| `control_plane.endpoint.activated` |
| `control_plane.endpoint.deactivated` |

The `via=mcp_control_plane` metadata distinguishes agent-driven mutations from UI ones — useful for spotting "did the agent break this, or did a human?".

## Event shape

Each row in `audit_logs`:

```
uuid          | "0e2f...c4"
event         | "credential.created"
severity      | "info" | "ok" | "warn" | "err"
actor_label   | "admin@promptgate.dev"   (display name from session)
actor_user_id | 1                         (FK or null for system / API)
project_id    | 7                         (or null for global events)
target        | "OpenAI Production"       (the affected resource)
metadata      | {"slug": "openai-production"}  (JSON, free-form)
ip_address    | "10.0.0.42"
created_at    | "2026-05-06T10:14:22Z"
```

## Viewing

Top-right user menu → **Audit Log**.

![Audit log — placeholder](#)

The page has:

- A searchable table sorted DESC by `created_at`.
- Time-range filters: **Today**, **7 days**, **30 days**, **All**.
- Free-text search across `event`, `actor_label`, `target`.
- Severity colour coding (info / ok / warn / err).
- One-click **Export CSV** for the current filter.

## Filter examples

- **Audit failed logins last 24h**: time = Today, search = `login_failed`.
- **What did the admin agent change today**: search = `via=mcp_control_plane`.
- **OAuth flow troubleshooting**: search = `oauth_connection`.
- **Find a deleted credential**: search = `credential.deleted`.

## CSV export

The export endpoint streams a CSV:

```
GET /audit/export?since=2026-05-01&until=2026-05-06
```

(Same filters as the UI — passed as query params.) Returns one row per event with all columns. Useful for piping into a SIEM or running ad-hoc analysis.

## Retention

By default, **forever**. The `audit_logs` table grows with usage; for high-traffic gateways you may want to prune occasionally:

```bash
docker compose exec app php artisan tinker
\App\Models\AuditLog::query()->where('created_at', '<', now()->subYear())->delete();
```

Configurable retention policies (auto-prune at N days) are on the roadmap.

## Webhook bridge

Every audit insertion **fires matching webhooks**. So you can get real-time notifications by registering a webhook with the matching event subscriptions — see **[Webhooks](/admin/webhooks/)**.

## Why isn't this strictly immutable?

The Community Edition lets the admin run arbitrary SQL via Tinker, and the schema doesn't prevent UPDATE / DELETE. We don't claim it's tamper-proof — the goal is **observability + accountability** for an honest single-admin deployment, not a forensic guarantee against the admin.

If you need true immutability, ship audit events to an append-only sink (S3 with object-lock, an immutable log service) via webhook.

## Best practices

- **Review failed logins weekly.** Brute-force probing shows up here even when rate limiting blocks individual attempts.
- **Filter the audit log by project** when investigating a project-specific incident.
- **Use webhook subscriptions** for time-sensitive events (token revocation, OAuth refresh failures).
- **Export CSV monthly** as part of your backup routine — gives you an offline trail.

---

Next: **[Webhooks](/admin/webhooks/)** in the Administration section.

---

> © Akyros Labs LLC. All rights reserved.
