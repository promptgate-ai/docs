---
title: Recipe — Expose an Endpoint as an MCP Tool
description: Take an existing AI Gateway endpoint and make it discoverable as an MCP tool for agents.
---

This recipe takes an existing AI Gateway endpoint (e.g. a `summarize-ticket` endpoint with a system prompt and an input schema) and exposes it as an **MCP tool** so agents like Claude Desktop, Cursor, or your own JSON-RPC client can discover and call it.

End state: an agent does `tools/list` against your gateway and sees `summarize-ticket`. It does `tools/call` with the right arguments and gets a response — running through the **same guardrails / rate limits / budgets** the endpoint enforces for direct API calls.

## Prerequisites

- An `ai_gateway` project with at least one configured endpoint (see **[Quick Start](/getting-started/quick-start/)**).
- An `mcp`-scoped API token.

## Step 1 — Mark the endpoint as MCP-exposed

Project sidebar → **AI Endpoints** → click the endpoint → **Edit**.

In **Tab 1 — Core**, toggle **Expose as MCP tool** ON. Save.

The endpoint now shows an **MCP** chip in the index list. The KPI strip's **MCP tools** count goes up by one.

## Step 2 — Define the inputSchema (recommended)

For a tool that an agent will pick correctly, give it a clear input schema. Endpoint wizard → **Tab 7 — Schema** → paste a JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "ticket_text": {
      "type": "string",
      "description": "The full text of the customer support ticket to summarise."
    },
    "max_sentences": {
      "type": "integer",
      "description": "Maximum length of the summary (default 3).",
      "minimum": 1,
      "maximum": 10
    }
  },
  "required": ["ticket_text"]
}
```

This schema becomes the tool's `inputSchema` when an MCP client calls `tools/list`. Agents use it to know how to call the tool.

## Step 3 — Issue an `mcp`-scoped token

Project sidebar → **API Tokens** → **+ New token**:

- Name: `MCP Agent`
- Environment: `live`
- Scopes: `mcp`

Save. Copy the plaintext.

## Step 4 — Discover from the agent's POV

```bash
curl -X POST $PG_URL/api/$PG_UUID/mcp \
  -H "Authorization: Bearer $PG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Response (excerpt):

```json
{
  "result": {
    "tools": [
      {
        "name": "summarize-ticket",
        "description": "Summarise a customer support ticket in 3 sentences.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticket_text": { "type": "string", "description": "..." },
            "max_sentences": { "type": "integer", "description": "..." }
          },
          "required": ["ticket_text"]
        }
      }
    ]
  }
}
```

The `name` is the endpoint slug. The `description` comes from the endpoint's system prompt (first 200 chars) or its name. The `inputSchema` is exactly what you pasted in Step 2.

## Step 5 — Call the tool

```bash
curl -X POST $PG_URL/api/$PG_UUID/mcp \
  -H "Authorization: Bearer $PG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tools/call",
    "params":{
      "name":"summarize-ticket",
      "arguments":{
        "ticket_text":"User reports the dashboard is slow during peak hours...",
        "max_sentences":3
      }
    }
  }'
```

Response:

```json
{
  "result": {
    "content": [
      { "type": "text", "text": "User reports dashboard slowness at peak. Investigation suggests a database query issue. Recommended fix is to add an index." }
    ],
    "isError": false
  }
}
```

The result is the model's output text wrapped in MCP's content-block shape.

## Step 6 — Hook into Claude Desktop / Cursor / etc.

Most MCP clients accept a config like:

```json
{
  "mcpServers": {
    "my-gateway": {
      "url": "https://gateway.your-domain.com/api/<UUID>/mcp",
      "auth": { "type": "bearer", "token": "pg_live_..." }
    }
  }
}
```

(Exact key names vary per client — check Claude Desktop's `claude_desktop_config.json` or Cursor's MCP settings.)

After config + restart, the agent sees your tool and can invoke it.

## What runs when the tool is called

The full **AI Gateway pipeline**:

1. Auth (the `mcp`-scoped token).
2. Rate limit (per-minute / per-hour on the endpoint).
3. Budget (per-request token cap, monthly USD budget).
4. Guardrails (PII filter, prompt injection, blocklist, length).
5. Input schema validation.
6. System prompt application.
7. Provider call (with failover).
8. Output schema validation.
9. Logging + audit.

So tool calls aren't a backdoor — they go through the same protections as direct API calls. A guardrail that masks PII does so for tool calls too.

## A few practical tips

### 1. Be picky about which endpoints get the flag

Don't expose every endpoint blindly. An agent with `mcp` scope can call any exposed tool. Stick to:

- Tools with **clear input schemas** (so the agent knows how to call them).
- Tools that are **stateless or benign** (summarise, classify, lookup). Be cautious about tools that mutate (those are better surfaced via the Control Plane with `admin` scope).
- Tools where the **output is well-shaped** (markdown, structured JSON via output_schema).

### 2. The system prompt becomes part of the tool description

The first 200 chars of your endpoint's system prompt are the tool description shown to the agent. Make those 200 chars informative — describe what the tool does, not what model it uses.

### 3. Use input + output schemas

A tool with no schemas is hard for an agent to use correctly. Even a minimal `inputSchema` like `{type:"object", properties:{message:{type:"string"}}}` is way better than nothing.

### 4. Watch the audit log

Tool calls don't get a special audit event by default — but **errors** (guardrail blocks, rate limits, budget exhaustion) do. If your agent is hitting walls, the audit log shows you exactly which one and why.

## Multiple tools in one project

Toggle `expose_as_mcp_tool` on as many endpoints as you want. The agent sees the union via `tools/list`. Use namespacing in your endpoint slugs (`summarize-ticket`, `summarize-doc`, `classify-priority`) — the slugs become the tool names directly.

## Removing a tool

Toggle the flag off, or deactivate the endpoint. The next `tools/list` doesn't include it; subsequent `tools/call` for that name returns `-32602 Unknown tool`.

---

That's the full Cookbook for now. More recipes will land as the gateway evolves.

Back to **[Documentation home](/getting-started/introduction/)**.

---

> © Akyros Labs LLC. All rights reserved.
