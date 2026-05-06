---
title: MCP Overview
description: Three MCP surfaces — Bridge, Gateway, Control Plane.
---

The [Model Context Protocol](https://modelcontextprotocol.io) is a JSON-RPC standard for exposing **tools** to AI agents. PromptGate plugs into MCP three different ways depending on what you're trying to do:

| Surface | Role | URL | Project type |
|---|---|---|---|
| **[MCP Bridge](/features/mcp-bridge/)** | Expose your AI Gateway endpoints AS MCP tools to agents | `POST /api/{uuid}/mcp` | `ai_gateway` |
| **[MCP Gateway](/mcp/gateway/)** | Aggregate multiple upstream MCP servers under one URL | `POST /api/{uuid}/mcp` | `mcp_gateway` |
| **[MCP Control Plane](/mcp/control-plane/)** | Manage PromptGate itself via MCP | `POST /api/control/mcp` | global |

All three speak **JSON-RPC 2.0**. All three implement the standard `initialize`, `tools/list`, `tools/call`, `ping`, `notifications/initialized` methods. The endpoint URL determines which one you're talking to.

## Pick the right one

### Bridge

You have an `ai_gateway` project with endpoints like `summarize-ticket`, `classify-email`, `extract-fields`. You want an agent (Claude Desktop, Cursor, your own) to discover and call these as tools.

→ Enable `expose_as_mcp_tool` on each endpoint, point the agent at `/api/{uuid}/mcp`, done.

### Gateway

You're using multiple upstream MCP servers — a filesystem server, a GitHub server, a Slack server. Instead of configuring each agent with N URLs, you want **one URL** that aggregates all of them.

→ Create an `mcp_gateway` project, register each upstream as an MCP Server, point the agent at `/api/{uuid}/mcp`. Tool names are namespaced (`fs__read_file`, `gh__create_issue`) so calls route deterministically.

### Control Plane

You want an agent to **manage PromptGate**: list projects, rotate tokens, toggle endpoints, pull metrics.

→ Use the global `/api/control/mcp` with an `admin`-scoped token. 12 tools cover the read + write surface.

## All three are bearer-authenticated

Every MCP surface requires a Bearer token:

| Surface | Required scope |
|---|---|
| Bridge | `mcp` |
| Gateway | `mcp` |
| Control Plane | `admin` |

See **[Client Tokens](/security/client-tokens/)** for token issuing.

## All three speak the same protocol

The JSON-RPC envelope shape is uniform:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      { "name": "summarize-ticket", "description": "...", "inputSchema": {...} }
    ]
  }
}
```

What changes between surfaces is **which tools `tools/list` returns** and **what `tools/call` does**:

- Bridge: tools = your AI endpoints; call = run the endpoint pipeline.
- Gateway: tools = union of upstream tools (with prefix); call = forward to the right upstream.
- Control Plane: tools = PromptGate management ops; call = read DB or mutate state.

## Notifications + batch

All three surfaces support:

- **Notifications** (envelope without `id`) — return 204 No Content. Used by `notifications/initialized`.
- **Batch requests** (top-level array of envelopes) — return an array of responses (notifications omitted).

## Compatibility

The PROTOCOL_VERSION constant is `2024-11-05` across all three surfaces — that's the MCP spec version PromptGate implements.

Tested against: Claude Desktop, Cursor, custom JSON-RPC clients.

## Where to go next

- **[MCP Bridge](/features/mcp-bridge/)** — exposing AI endpoints to agents.
- **[MCP Gateway](/mcp/gateway/)** — aggregating upstream MCP servers.
- **[MCP Control Plane](/mcp/control-plane/)** — managing PromptGate via MCP.
- **[MCP API](/api/mcp/)** — the wire-format reference.

---

> © Akyros Labs LLC. All rights reserved.
