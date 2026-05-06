---
title: MCP Bridge
description: Auto-expose AI Gateway endpoints as MCP tools so any MCP client can discover and call them.
---

The **MCP Bridge** is a feature of every `ai_gateway` project. It exposes a `POST /api/{project_uuid}/mcp` JSON-RPC endpoint that serves the project's AI endpoints (where `expose_as_mcp_tool=true`) as MCP tools.

Use it to let an agent (Claude Desktop, Cursor, custom JSON-RPC client) **discover and invoke your existing AI endpoints** without you running a separate MCP server.

## Architecture

```
Agent / MCP Client
    │  POST /api/{uuid}/mcp
    │  { jsonrpc, id, method, params }
    ▼
PromptGate MCP Bridge (McpServerService)
    │  Resolves the call to an Endpoint
    ▼
GatewayService.execute()  ← full pipeline: guardrails, schemas,
                            rate limit, budget, provider call
    ▼
Provider (OpenAI / Anthropic / …)
```

So a tool call through the Bridge runs through **every guardrail and policy** the endpoint normally enforces. There's no second "less protected" path.

## Enabling the bridge for an endpoint

In the AI endpoint wizard → **Tab 1 — Core** → toggle **Expose as MCP tool**. That's it.

The endpoint now appears in `tools/list`. Disabling the toggle removes it from `tools/list` (and from `tools/call`).

## Tool name and inputSchema

| MCP field | Comes from |
|---|---|
| `name` | Endpoint slug |
| `description` | First 200 chars of the endpoint's `prompt` (system prompt), or the endpoint name if no prompt |
| `inputSchema` | The endpoint's `input_schema` if set, otherwise a default `{ message: string }` schema |

So an endpoint with slug `summarize`, prompt "Summarize the user's text in 3 sentences" and no input_schema becomes:

```json
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
```

If you set an `input_schema` on the endpoint (recommended for tools), that schema is used verbatim — clients see exactly what arguments they're allowed to pass.

## tools/call argument handling

The Bridge accepts the standard MCP envelope:

```json
{
  "jsonrpc": "2.0",
  "id": 99,
  "method": "tools/call",
  "params": {
    "name": "summarize",
    "arguments": { "message": "long text here..." }
  }
}
```

Argument resolution priority:

1. If `arguments.messages` is a chat-style array, it's passed through directly.
2. If `arguments.message` is a string, it's wrapped as `[{role: "user", content: "..."}]`.
3. Otherwise the whole arguments object is JSON-encoded and used as the user message.

The result is wrapped in MCP's content blocks shape:

```json
{
  "content": [
    { "type": "text", "text": "Here's the summary..." }
  ],
  "isError": false
}
```

## Token + scope

The Bridge route is gated by `auth.api:mcp` middleware:

```
Authorization: Bearer pg_live_...
```

Token must be:

- **Project-scoped** to the same project (UUID in the URL must match the token's project_id).
- Have the **`mcp` scope** in its scopes list.

Issue an MCP-scoped token via project sidebar → API Tokens → New token → tick `mcp`.

## What gets included

`tools/list` returns the union of:

- Endpoints with `is_active = true`
- AND `expose_as_mcp_tool = true`

Inactive endpoints are excluded. Endpoints without the flag are excluded. There's no further filtering — every "active + exposed" endpoint shows up.

For a 30-endpoint project where only 3 are MCP-exposed, the agent sees 3 tools. The other 27 are reachable via direct API but invisible to MCP.

## Errors

| Situation | JSON-RPC error |
|---|---|
| Unknown method | `code: -32601, message: "Method not found: ..."` |
| Missing tool name | `code: -32602, message: "Missing tool name"` |
| Tool not found / not exposed / inactive | `code: -32602, message: "Unknown tool: ..."` |
| Provider error | `code: -32603, message: "Internal error: ..."` |

Notifications (envelopes without `id`) get **204 No Content** and no body.

## Batch requests

The Bridge supports JSON-RPC batches:

```json
[
  { "jsonrpc": "2.0", "id": 1, "method": "initialize" },
  { "jsonrpc": "2.0", "id": 2, "method": "tools/list" },
  { "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {...} }
]
```

Returns an array of responses (notifications are omitted from the result array).

## Calling

### curl

```bash
curl -X POST $URL/api/$UUID/mcp \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tools/list"
  }'
```

### Python (requests)

```python
import os, requests

url = f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/mcp"
headers = {"Authorization": f"Bearer {os.environ['PG_TOKEN']}"}

# Discover tools
r = requests.post(url, headers=headers, json={
    "jsonrpc": "2.0", "id": 1, "method": "tools/list"
})
print(r.json()["result"]["tools"])

# Call one
r = requests.post(url, headers=headers, json={
    "jsonrpc": "2.0", "id": 2, "method": "tools/call",
    "params": {
        "name": "summarize",
        "arguments": {"message": "Long text..."}
    }
})
print(r.json()["result"]["content"][0]["text"])
```

### Node.js (fetch)

```js
const url = `${process.env.PG_URL}/api/${process.env.PG_UUID}/mcp`;
const headers = {
    'Authorization': `Bearer ${process.env.PG_TOKEN}`,
    'Content-Type': 'application/json',
};

const list = await (await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
})).json();

console.log(list.result.tools);

const call = await (await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'summarize', arguments: { message: 'Long text…' } },
    }),
})).json();

console.log(call.result.content[0].text);
```

## UI surfacing

In the AI Gateway endpoint UI:

- **Endpoints index** — endpoints with `expose_as_mcp_tool=true` get an `MCP` chip in the status column. The KPI strip shows a count.
- **Endpoint detail** — header carries the chip. There's a dedicated **MCP card** with the tool name, the bridge URL, and a copy-pasteable curl example for `tools/call`.

## Behaviour table

| Method | What happens |
|---|---|
| `initialize` | Returns serverInfo (`PromptGate`) + protocolVersion + capabilities |
| `notifications/initialized` | No-op, returns 204 |
| `ping` | Returns empty result |
| `tools/list` | Active + exposed endpoints as MCP tools |
| `tools/call` | Delegates to GatewayService.execute |
| Anything else | `-32601 Method not found` |

---

Next: **[MCP Gateway](/mcp/gateway/)** — aggregating upstream MCP servers.

---

> © Akyros Labs LLC. All rights reserved.
