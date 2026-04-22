---
title: Audit Log
description: Immutable security event log
---

:::note
The audit log is under active development and not yet available. This page describes the planned functionality.
:::

The audit log records security-relevant events in an immutable, append-only log. It provides a chronological trail of who did what, when, and from where.

## Concept

Every action that affects security or access control is recorded as an audit event. Events are write-once — they cannot be edited or deleted, even by administrators. This ensures a trustworthy record for compliance and incident investigation.

## Planned event types

### Authentication events

| Event | Description |
|---|---|
| `auth.login` | Successful login |
| `auth.login_failed` | Failed login attempt |
| `auth.logout` | User logged out |
| `auth.lockout` | Account temporarily locked after repeated failures |

### Credential events

| Event | Description |
|---|---|
| `credential.created` | New credential added |
| `credential.deactivated` | Credential deactivated |
| `credential.deleted` | Credential permanently removed |

### Token events

| Event | Description |
|---|---|
| `token.created` | New client token issued |
| `token.revoked` | Client token revoked |

### Project events

| Event | Description |
|---|---|
| `project.created` | New project created |
| `project.updated` | Project settings changed |
| `project.deleted` | Project deleted |

### Endpoint events

| Event | Description |
|---|---|
| `endpoint.created` | New endpoint created |
| `endpoint.updated` | Endpoint configuration changed |
| `endpoint.deleted` | Endpoint removed |

## Event structure

Each audit event contains:

- **Timestamp** — When the event occurred (UTC)
- **Event type** — The event identifier (e.g., `auth.login`)
- **Actor** — Who performed the action (user ID, email, or `system`)
- **IP address** — The source IP of the request
- **Resource** — The affected resource (project, credential, endpoint, etc.)
- **Details** — Additional context specific to the event type

## Viewing the audit log

The audit log will be accessible from the dashboard with filtering and search:

- Filter by event type, actor, date range, or resource
- Search for specific events
- Export events for external analysis

## Retention

Audit log events are retained indefinitely by default. A configurable retention policy will allow automatic pruning of events older than a specified duration for deployments with storage constraints.
