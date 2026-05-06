---
title: MCP Control Plane
description: Manage PromptGate itself via MCP — read tools (list / inspect / metrics) plus 5 audited write tools.
---

The **MCP Control Plane** is a PromptGate-wide JSON-RPC endpoint at `POST /api/control/mcp` that exposes the gateway's management surface as MCP tools. Point an `admin`-scoped agent at it and let it list projects, rotate tokens, toggle endpoints, and pull stats.

It's **not project-scoped** — the URL has no project UUID. The token's project still has to exist (tokens are project-scoped in PromptGate's data model), but the Control Plane operates **across** projects.

## Why this exists

Two motivating use cases:

1. **Operations agents** — the SRE bot that gets a Slack page should be able to "rotate this token" or "deactivate this endpoint" without you logging in.
2. **Self-service introspection** — let a developer agent discover what's configured ("which projects exist, what endpoints, what credentials are bound") without database access.

Read tools are always safe; write tools are audited with `via=mcp_control_plane` so you can distinguish agent actions from UI actions in the audit trail.

## Authentication

```
POST /api/control/mcp
Authorization: Bearer <admin-scoped-token>
```

Token must have the `admin` scope. The token's project is irrelevant for routing — but it tells PromptGate who the actor is.

Issue an admin token via project sidebar → API Tokens → New token → tick `admin`.

## The 12 tools

### Read (7)

| Tool | Args | Returns |
|---|---|---|
| `pg_list_projects` | none | All projects (id, uuid, name, project_type, env, is_active, created_at) |
| `pg_get_project` | `project_uuid` | One project's details |
| `pg_list_endpoints` | `project_uuid` | Endpoints — type-aware (AI / API gateway / MCP servers depending on project type) |
| `pg_list_tokens` | `project_uuid` | API token metadata (no plaintexts) |
| `pg_list_credentials` | none | All provider credentials (no secrets) |
| `pg_gateway_stats` | `project_uuid?`, `hours?` (default 24, max 168) | Requests / errors / avg latency / total tokens |
| `pg_recent_audit` | `project_uuid?`, `limit?` (default 20, max 100) | Recent audit log entries |

### Write (5, all audited)

| Tool | Args | Effect |
|---|---|---|
| `pg_create_project` | `name`, `project_type`, `env?` | Create a project |
| `pg_create_token` | `project_uuid`, `name`, `scopes`, `env?` | Create token, **return plaintext once** |
| `pg_rotate_token` | `token_id` | Rotate, **return new plaintext once** |
| `pg_revoke_token` | `token_id` | Set is_active=false |
| `pg_set_endpoint_active` | `endpoint_uuid`, `is_active` | Toggle AI endpoint activation |

Every write tool emits a `control_plane.*` audit event tagged with `via=mcp_control_plane`. So you can ask "what did agents change today" with one filter.

## tools/list output

`tools/list` returns all 12 with their input schemas. Skipped here for brevity — see **[API Reference → Control Plane](/api/control-plane/)** for the full payload.

## Examples

### List projects

```bash
curl -X POST $URL/api/control/mcp \
  -H "Authorization: Bearer pg_live_<admin>..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tools/call",
    "params":{"name":"pg_list_projects","arguments":{}}
  }'
```

```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "[\n  {\n    \"id\": 1,\n    \"uuid\": \"...\",\n    \"name\": \"Quickstart\",\n    \"project_type\": \"ai_gateway\",\n    \"env\": \"prod\",\n    \"is_active\": true\n  }\n]" }
    ],
    "isError": false
  }
}
```

The result wraps a JSON-encoded payload as a text block — that's the MCP convention. Parse `result.content[0].text` as JSON to get the list.

### Rotate a token

```bash
curl -X POST $URL/api/control/mcp \
  -H "Authorization: Bearer pg_live_<admin>..." \
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tools/call",
    "params":{"name":"pg_rotate_token","arguments":{"token_id": 7}}
  }'
```

Result includes the **new plaintext** — exactly once:

```json
{
  "id": 7,
  "name": "Mobile App Prod",
  "plaintext": "pg_live_NEW_PLAINTEXT_HERE",
  "prefix": "pg_live_xyzw…",
  "warning": "Store this plaintext now — it will not be shown again."
}
```

### Gateway stats for one project

```bash
curl -X POST $URL/api/control/mcp \
  -H "Authorization: Bearer pg_live_<admin>..." \
  -d '{
    "jsonrpc":"2.0","id":3,"method":"tools/call",
    "params":{
      "name":"pg_gateway_stats",
      "arguments":{"project_uuid":"...","hours":24}
    }
  }'
```

```json
{
  "window_hours": 24,
  "requests": 1342,
  "errors": 12,
  "error_rate_pct": 0.89,
  "avg_latency_ms": 412,
  "total_tokens": 487213
}
```

### Toggle an endpoint

```bash
curl -X POST $URL/api/control/mcp \
  -H "Authorization: Bearer pg_live_<admin>..." \
  -d '{
    "jsonrpc":"2.0","id":4,"method":"tools/call",
    "params":{
      "name":"pg_set_endpoint_active",
      "arguments":{
        "endpoint_uuid":"abc-123",
        "is_active":false
      }
    }
  }'
```

Audit entry: `control_plane.endpoint.deactivated`, `target=<endpoint name>`, metadata `{endpoint_uuid: "...", via: "mcp_control_plane"}`.

## Validation

The Control Plane validates every argument:

- `project_type` in `["ai_gateway","ai_wrapper","api_gateway","mcp_gateway"]`.
- `env` in `["dev","staging","prod"]` (project) / `["live","test"]` (token).
- `scopes` against `ApiToken::AVAILABLE_SCOPES` — unknown scopes rejected.
- `token_id` must be int and exist.
- `endpoint_uuid` must exist; `is_active` must be boolean.

Bad arguments → JSON-RPC `-32602 Invalid params` with a clear message.

## Errors

| Situation | JSON-RPC code |
|---|---|
| Unknown method | -32601 |
| Unknown tool name | -32602 |
| Missing required arg | -32602 |
| Project / token / endpoint not found | -32602 |
| Bad project_type / env / scope | -32602 |
| Internal error | -32603 |

## What it doesn't do (yet)

- ❌ Update a project's metadata.
- ❌ CRUD for credentials (you don't want an agent rotating those).
- ❌ CRUD for guardrail configs.
- ❌ CRUD for OAuth connections.
- ❌ CRUD for MCP servers (in the gateway sense).
- ❌ Restore from backup.

These will land as more write tools as we figure out the right confirmation patterns. For now: agents can read everything, mutate only what's safe to automate.

---

Next: **[Dashboard](/observability/dashboard/)** in the Observability section.

---

> © Akyros Labs LLC. All rights reserved.
