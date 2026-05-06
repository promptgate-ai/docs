---
title: MCP Gateway
description: Aggregate multiple upstream MCP servers under one URL with namespace prefixing.
---

An `mcp_gateway` project is a **JSON-RPC aggregator** for the Model Context Protocol. Register N upstream MCP servers, and the project exposes a **single** `POST /api/{uuid}/mcp` endpoint that:

- `tools/list` fans out to every registered server, namespaces each tool, and returns the union.
- `tools/call` looks at the namespace prefix on the tool name, resolves which server owns it, strips the prefix, and forwards the call.

Use it when an agent needs access to several MCP servers and you'd rather hand it **one URL** than configure each agent with N URLs.

## Architecture

```
Agent / MCP Client
    │  POST /api/{uuid}/mcp   ← one URL
    ▼
PromptGate MCP Gateway (McpGatewayService)
    │
    ├─▶ Filesystem MCP server          tools: read_file, list_dir
    │   prefix: "fs"                    → tools/list returns
    │                                     "fs__read_file", "fs__list_dir"
    │
    ├─▶ GitHub MCP server               tools: create_issue, list_repos
    │   prefix: "gh"                    → "gh__create_issue", "gh__list_repos"
    │
    └─▶ Slack MCP server                tools: post_message, list_channels
        prefix: "slack"                 → "slack__post_message", …
```

`tools/call name=fs__read_file` strips `fs__`, looks up the server with prefix `fs`, forwards `tools/call name=read_file` to it.

## Registering an MCP server

Project sidebar → **MCP Servers** → **+ Register server**.

![MCP server form — placeholder](#)

| Field | Notes |
|---|---|
| **Name** | Human-readable. |
| **Namespace prefix** | Short identifier for tool names (`fs`, `gh`, `slack`). Defaults to slug if blank. |
| **Description** | Free text. |
| **URL** | The upstream MCP server's JSON-RPC endpoint. |
| **Auth mode** | `none` or `bearer`. |
| **Bearer token** | Encrypted at rest. Sent as `Authorization: Bearer …` to the upstream. |
| **Timeout** | Per-call timeout in seconds. |

Save. The server is now part of the aggregation.

## Namespace prefixing

Every tool returned by `tools/list` is prefixed with `<server_prefix>__`:

```json
{
  "tools": [
    { "name": "fs__read_file", "description": "..." },
    { "name": "fs__list_dir", "description": "..." },
    { "name": "gh__create_issue", "description": "..." }
  ]
}
```

The prefix is purely a routing hint — tool descriptions and inputSchemas are passed through verbatim from the upstream.

The separator `__` (double underscore) is unlikely to clash with real tool names. If your upstream tools contain `__`, only the **first** `__` is treated as the boundary — `fs__some__tool` is interpreted as prefix `fs`, tool `some__tool`.

## tools/call routing

```json
{
  "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {
    "name": "fs__read_file",
    "arguments": { "path": "/etc/hosts" }
  }
}
```

The Gateway:

1. Splits `fs__read_file` → prefix `fs`, upstream name `read_file`.
2. Looks up an active MCP server with that effective prefix in the project.
3. Builds an upstream envelope with `name=read_file` and the same arguments.
4. POSTs to the upstream URL with the configured Bearer token.
5. Returns the upstream's `result` (or surfaces its error).

If the upstream returns an error, the Gateway propagates the JSON-RPC error code:

```json
{
  "jsonrpc": "2.0", "id": 1,
  "error": {
    "code": -32000,
    "message": "Permission denied"
  }
}
```

If the upstream HTTP call fails (timeout / 5xx / unreachable), the Gateway returns `-32603 Internal error: Upstream MCP server '...' returned HTTP 502`.

## Authentication

Two layers:

1. **Client → Gateway**: Bearer token, scope `mcp`. Same as the Bridge.
2. **Gateway → Upstream**: optional Bearer per server. Stored encrypted with `APP_KEY`.

The client never sees the upstream tokens; the Gateway never exposes them in the UI (the form lets you replace the token but not view the existing one).

## Activation / deactivation

Click **Deactivate** on a server's row in the index. Effect:

- `tools/list` skips this server's tools.
- `tools/call` to this prefix returns `-32602 Unknown server prefix: '...'`.

Reactivate to bring the server back.

## Behaviour reference

| Situation | Result |
|---|---|
| `tools/call name=no_prefix_here` | -32602: tool name needs prefix |
| `tools/call name=ghost__do_something` (no server with prefix `ghost`) | -32602: unknown prefix |
| Upstream returns JSON-RPC error | Propagated with same code |
| Upstream HTTP 5xx | -32603 |
| Upstream timeout | -32603 |
| Server deactivated | Skipped in `tools/list`, errors in `tools/call` |

## Limits

- The gateway makes **one HTTP call per `tools/list`** — fanned out to every active server. If you have 10 upstreams, that's 10 sequential HTTP calls. (Parallel fan-out is on the roadmap.)
- `tools/call` makes **one HTTP call** to the resolved upstream.
- Per-server `timeout_seconds` bounds each call.

## Worked example: Filesystem + GitHub

Register two servers:

| Name | Prefix | URL | Auth |
|---|---|---|---|
| Filesystem MCP | `fs` | `https://fs.internal/rpc` | none |
| GitHub MCP | `gh` | `https://gh-mcp.your-org.com/rpc` | bearer (paste GitHub OAuth token) |

Agent calls `tools/list` → sees `fs__read_file`, `fs__list_dir`, `gh__create_issue`, `gh__list_repos`.

Agent calls `tools/call name=fs__read_file arguments={path:/etc/hosts}` → Gateway forwards `tools/call name=read_file` to `https://fs.internal/rpc`.

Agent calls `tools/call name=gh__create_issue arguments={...}` → Gateway forwards to GitHub MCP with the saved Bearer token.

## Behaviour table

| Method | What happens |
|---|---|
| `initialize` | Returns `serverInfo: { name: "PromptGate MCP Gateway" }` |
| `notifications/initialized` | 204 |
| `ping` | Empty result |
| `tools/list` | Fans out, prefixes, returns union |
| `tools/call` | Splits prefix, routes to upstream |
| Other | `-32601 Method not found` |

---

Next: **[MCP Control Plane](/mcp/control-plane/)** — manage PromptGate via MCP.

---

> © Akyros Labs LLC. All rights reserved.
