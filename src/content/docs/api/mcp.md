---
title: MCP API
description: JSON-RPC 2.0 — POST /api/{uuid}/mcp. Bridge or Gateway depending on project_type.
---

The MCP API lives at:

```
POST /api/{uuid}/mcp
```

Same URL for both `ai_gateway` projects (Bridge mode — exposes the project's AI endpoints as tools) and `mcp_gateway` projects (Gateway mode — aggregates upstream MCP servers). The dispatcher decides which mode to use based on the project's type.

Requires **`mcp` scope**.

This page covers the **wire-level protocol**. For conceptual docs see **[MCP Bridge](/features/mcp-bridge/)** and **[MCP Gateway](/mcp/gateway/)**.

## Protocol

JSON-RPC 2.0. Every envelope is `{jsonrpc, id, method, params?}`. Responses are `{jsonrpc, id, result|error}`.

### Single envelope

```http
POST /api/{uuid}/mcp
Content-Type: application/json
Authorization: Bearer pg_live_...

{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0", "id": 1,
  "result": { "tools": [...] }
}
```

### Batch

Array of envelopes:

```json
[
  {"jsonrpc":"2.0","id":1,"method":"initialize"},
  {"jsonrpc":"2.0","id":2,"method":"tools/list"}
]
```

Returns an array of responses. Notifications (envelopes without `id`) get omitted from the array.

### Notifications (no `id`)

```json
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

Returns **204 No Content** — no response body.

## Methods

All five methods work on both Bridge and Gateway. The shape of the responses adapts to which mode is active.

### `initialize`

Returns server identity + protocol version + capabilities.

```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": {
      "name": "PromptGate",                 // Bridge mode
      // OR "name": "PromptGate MCP Gateway"  // Gateway mode
      "version": "0.1.0"
    }
  }
}
```

### `tools/list`

**Bridge mode**: returns AI Gateway endpoints with `expose_as_mcp_tool=true`.

```json
{
  "result": {
    "tools": [
      {
        "name": "summarize",
        "description": "Summarize the user's text in 3 sentences",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": { "type": "string", "description": "User message" }
          },
          "required": ["message"]
        }
      }
    ]
  }
}
```

**Gateway mode**: union of every registered upstream's tools, namespaced.

```json
{
  "result": {
    "tools": [
      { "name": "fs__read_file", "description": "...", "inputSchema": {...} },
      { "name": "fs__list_dir", "description": "...", "inputSchema": {...} },
      { "name": "gh__create_issue", "description": "...", "inputSchema": {...} }
    ]
  }
}
```

### `tools/call`

```json
{
  "jsonrpc": "2.0", "id": 99, "method": "tools/call",
  "params": {
    "name": "summarize",                   // or "fs__read_file" in Gateway mode
    "arguments": { "message": "Long text..." }
  }
}
```

Response (success):

```json
{
  "result": {
    "content": [
      { "type": "text", "text": "Summary..." }
    ],
    "isError": false
  }
}
```

**Bridge mode**: delegates to `GatewayService::execute()`. The full AI pipeline runs (guardrails, schemas, rate limit, budget, provider call). The model's text output goes in `content[0].text`.

**Gateway mode**: strips the prefix, looks up the upstream by prefix, forwards the JSON-RPC envelope to the upstream's URL with the configured Bearer token, returns the upstream's `result`.

### `ping`

```json
{ "jsonrpc": "2.0", "id": 1, "method": "ping" }
```

Returns:

```json
{ "jsonrpc": "2.0", "id": 1, "result": {} }
```

Used by clients for liveness checks.

### `notifications/initialized`

```json
{ "jsonrpc": "2.0", "method": "notifications/initialized" }
```

No-op. Returns 204.

## Errors

JSON-RPC error codes the gateway emits:

| Code | Meaning |
|---|---|
| -32700 | Parse error (malformed JSON in body) |
| -32600 | Invalid request (missing method, etc.) |
| -32601 | Method not found |
| -32602 | Invalid params (unknown tool, missing arg, bad type) |
| -32603 | Internal error (provider failure, upstream MCP server unreachable) |
| -32xxx | Custom — propagated from upstream MCP servers in Gateway mode |

Error response shape:

```json
{
  "jsonrpc": "2.0", "id": 1,
  "error": { "code": -32602, "message": "Unknown tool: nonexistent" }
}
```

## Authentication

```
Authorization: Bearer pg_live_...
```

Token must:

- Belong to the project whose UUID is in the URL.
- Have the `mcp` scope.

A 401 response (no Authorization header or bad token) does NOT carry a JSON-RPC envelope — it's a raw HTTP error per Laravel's middleware. Clients should detect 401 / 403 separately from in-protocol JSON-RPC errors.

## Examples

### curl — discover and call a tool

```bash
# initialize
curl -X POST $PG_URL/api/$PG_UUID/mcp \
  -H "Authorization: Bearer $PG_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'

# tools/list
curl -X POST $PG_URL/api/$PG_UUID/mcp \
  -H "Authorization: Bearer $PG_TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# tools/call
curl -X POST $PG_URL/api/$PG_UUID/mcp \
  -H "Authorization: Bearer $PG_TOKEN" \
  -d '{
    "jsonrpc":"2.0","id":3,"method":"tools/call",
    "params":{
      "name":"summarize",
      "arguments":{"message":"Long text..."}
    }
  }'
```

### Python (small JSON-RPC client)

```python
import os, requests

class McpClient:
    def __init__(self, base_url, token):
        self.url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}
        self._id = 0

    def call(self, method, params=None):
        self._id += 1
        envelope = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            envelope["params"] = params
        r = requests.post(self.url, headers=self.headers, json=envelope)
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            raise RuntimeError(body["error"])
        return body["result"]

c = McpClient(
    f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/mcp",
    os.environ['PG_TOKEN'],
)
print(c.call("initialize"))
print(c.call("tools/list"))
print(c.call("tools/call", {"name": "summarize", "arguments": {"message": "..."}}))
```

### Node.js

```js
async function mcpCall(url, token, method, params) {
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, ...(params && { params }) }),
    });
    const body = await r.json();
    if (body.error) throw new Error(`MCP error ${body.error.code}: ${body.error.message}`);
    return body.result;
}

const url = `${process.env.PG_URL}/api/${process.env.PG_UUID}/mcp`;
console.log(await mcpCall(url, process.env.PG_TOKEN, 'tools/list'));
```

---

Next: **[Control Plane API](/api/control-plane/)**.

---

> © Akyros Labs LLC. All rights reserved.
