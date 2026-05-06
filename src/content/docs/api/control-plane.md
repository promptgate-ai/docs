---
title: Control Plane API
description: Manage PromptGate via MCP — POST /api/control/mcp. 12 tools (7 read + 5 write).
---

The Control Plane is a **gateway-wide** JSON-RPC endpoint at:

```
POST /api/control/mcp
```

Same protocol as the MCP API (JSON-RPC 2.0, `tools/list`, `tools/call`, batch, notifications). Different tools — these manage PromptGate itself.

Requires **`admin` scope**. The token can come from any project; the Control Plane is project-agnostic.

For conceptual docs see **[MCP Control Plane](/mcp/control-plane/)**.

## tools/list

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

Returns the 12 tools:

```json
{
  "result": {
    "tools": [
      { "name": "pg_list_projects", "description": "...", "inputSchema": {...} },
      { "name": "pg_get_project", "description": "...", "inputSchema": {...} },
      { "name": "pg_list_endpoints", "description": "...", "inputSchema": {...} },
      { "name": "pg_list_tokens", "description": "...", "inputSchema": {...} },
      { "name": "pg_list_credentials", "description": "...", "inputSchema": {...} },
      { "name": "pg_gateway_stats", "description": "...", "inputSchema": {...} },
      { "name": "pg_recent_audit", "description": "...", "inputSchema": {...} },
      { "name": "pg_create_project", "description": "...", "inputSchema": {...} },
      { "name": "pg_create_token", "description": "...", "inputSchema": {...} },
      { "name": "pg_rotate_token", "description": "...", "inputSchema": {...} },
      { "name": "pg_revoke_token", "description": "...", "inputSchema": {...} },
      { "name": "pg_set_endpoint_active", "description": "...", "inputSchema": {...} }
    ]
  }
}
```

## Read tools

### `pg_list_projects`

No arguments.

```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": "[\n  {\n    \"id\": 1, \"uuid\": \"...\", \"name\": \"Quickstart\",\n    \"project_type\": \"ai_gateway\", \"env\": \"prod\",\n    \"is_active\": true, \"created_at\": \"...\"\n  }\n]"
    }],
    "isError": false
  }
}
```

The Control Plane wraps payloads in MCP's content-block format (`content[0].text`). Parse it as JSON to get the array.

### `pg_get_project`

```json
{
  "method": "tools/call",
  "params": {
    "name": "pg_get_project",
    "arguments": { "project_uuid": "..." }
  }
}
```

Returns one project's full details. 404-ish error (`-32602`) if UUID unknown.

### `pg_list_endpoints`

```json
{ "name": "pg_list_endpoints", "arguments": { "project_uuid": "..." } }
```

Returns a structure that depends on the project's type:

```json
{ "kind": "ai_endpoints",          "items": [...] }   // ai_gateway
{ "kind": "api_gateway_endpoints", "items": [...] }   // api_gateway
{ "kind": "mcp_servers",           "items": [...] }   // mcp_gateway
{ "kind": "none",                  "items": [] }      // ai_wrapper
```

Each `items` entry has the relevant identity fields (uuid, name, slug, is_active, ...).

### `pg_list_tokens`

```json
{ "name": "pg_list_tokens", "arguments": { "project_uuid": "..." } }
```

Token metadata only — no plaintexts:

```json
{
  "items": [
    {
      "id": 1, "name": "Mobile App Prod", "prefix": "pg_live_a1b2…",
      "env": "live", "scopes": ["chat"],
      "is_active": true, "last_used_at": "..."
    }
  ]
}
```

### `pg_list_credentials`

No arguments. Returns provider credentials (no secrets):

```json
{
  "items": [
    { "id": 1, "name": "OpenAI Production", "provider_key": "openai", "is_active": true }
  ]
}
```

### `pg_gateway_stats`

```json
{
  "name": "pg_gateway_stats",
  "arguments": {
    "project_uuid": "...",      // optional — limit to one project
    "hours": 24                  // 1–168, default 24
  }
}
```

Returns aggregates over the window:

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

### `pg_recent_audit`

```json
{
  "name": "pg_recent_audit",
  "arguments": {
    "project_uuid": "...",     // optional
    "limit": 20                  // 1–100, default 20
  }
}
```

Returns the most recent audit entries (newest first):

```json
{
  "items": [
    {
      "uuid": "...", "event": "credential.created", "severity": "info",
      "actor": "admin@promptgate.dev", "project_id": 1,
      "target": "OpenAI Production",
      "created_at": "..."
    }
  ]
}
```

## Write tools

All five emit a `control_plane.*` audit entry tagged with `via=mcp_control_plane`.

### `pg_create_project`

```json
{
  "name": "pg_create_project",
  "arguments": {
    "name": "New Project",
    "project_type": "ai_gateway",       // ai_gateway | ai_wrapper | api_gateway | mcp_gateway
    "env": "prod"                        // dev | staging | prod (default prod)
  }
}
```

Returns the created project. Audit: `control_plane.project.created`.

### `pg_create_token`

```json
{
  "name": "pg_create_token",
  "arguments": {
    "project_uuid": "...",
    "name": "Mobile App Prod",
    "scopes": ["chat"],            // subset of: chat, models, admin, proxy, mcp
    "env": "live"                  // live | test (default live)
  }
}
```

Returns the new plaintext **once**:

```json
{
  "id": 7,
  "name": "Mobile App Prod",
  "plaintext": "pg_live_NEW_PLAINTEXT_HERE",
  "prefix": "pg_live_a1b2…",
  "scopes": ["chat"],
  "env": "live",
  "warning": "Store this plaintext now — it will not be shown again."
}
```

Audit: `control_plane.token.created`.

### `pg_rotate_token`

```json
{ "name": "pg_rotate_token", "arguments": { "token_id": 7 } }
```

Returns new plaintext (and prefix). Old plaintext is invalid from now on. Audit: `control_plane.token.rotated`.

### `pg_revoke_token`

```json
{ "name": "pg_revoke_token", "arguments": { "token_id": 7 } }
```

Sets `is_active=false`. Returns `{ id, is_active: false }`. Audit (severity warn): `control_plane.token.revoked`.

### `pg_set_endpoint_active`

```json
{
  "name": "pg_set_endpoint_active",
  "arguments": {
    "endpoint_uuid": "abc-123",
    "is_active": false
  }
}
```

Toggles the AI endpoint. Returns `{uuid, name, is_active}`. Audit: `control_plane.endpoint.activated` or `control_plane.endpoint.deactivated`.

## Examples

### List + filter projects

```bash
curl -X POST $PG_URL/api/control/mcp \
  -H "Authorization: Bearer pg_live_<admin>..." \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tools/call",
    "params":{"name":"pg_list_projects","arguments":{}}
  }' | jq '.result.content[0].text | fromjson'
```

### Rotate every token last used over 90 days ago

```python
import os, json, requests

URL = f"{os.environ['PG_URL']}/api/control/mcp"
H = {"Authorization": f"Bearer {os.environ['PG_TOKEN']}"}

def call(method, params=None):
    body = {"jsonrpc":"2.0","id":1,"method":method}
    if params: body["params"] = params
    r = requests.post(URL, headers=H, json=body)
    return r.json()["result"]

projects = json.loads(call("tools/call", {"name":"pg_list_projects","arguments":{}})["content"][0]["text"])

for p in projects:
    tokens_payload = call("tools/call", {"name":"pg_list_tokens","arguments":{"project_uuid": p["uuid"]}})
    tokens = json.loads(tokens_payload["content"][0]["text"])["items"]
    # ... iterate, find stale ones, rotate or revoke
```

### Pull audit + send to a SIEM

```python
audit = json.loads(call("tools/call", {"name":"pg_recent_audit","arguments":{"limit":100}})["content"][0]["text"])
# Forward `audit["items"]` to your sink.
```

## Errors

| Situation | JSON-RPC code |
|---|---|
| Unknown method | -32601 |
| Unknown tool | -32602 |
| Missing required arg | -32602 |
| `project_type` / `env` / `scope` invalid | -32602 |
| `token_id` not int / not found | -32602 |
| `endpoint_uuid` not found | -32602 |
| Internal error | -32603 |

## What's NOT exposed

The Control Plane deliberately doesn't expose:

- ❌ Credential CRUD (you don't want an agent rotating provider keys).
- ❌ Guardrail config CRUD.
- ❌ OAuth Service Connection CRUD.
- ❌ MCP Server CRUD (in the gateway sense).
- ❌ Restore-from-backup.

These will land as more write tools as confirmation patterns are figured out. For now, anything not in the matrix above requires a human in the UI.

---

Next: **[Errors](/api/errors/)**.

---

> © Akyros Labs LLC. All rights reserved.
