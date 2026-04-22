---
title: MCP Bridge
description: Auto-expose endpoints as MCP tools
---

:::note
MCP Bridge is under active development and not yet available. This page describes the planned functionality.
:::

The MCP Bridge automatically exposes your PromptGate endpoints as MCP (Model Context Protocol) tools. Any MCP-compatible client — such as Claude Desktop, Cursor, or other AI assistants — can discover and invoke your endpoints as structured tools.

## Concept

The Model Context Protocol (MCP) is a standard for AI assistants to discover and call external tools. PromptGate's MCP Bridge acts as an MCP server that translates your configured endpoints into MCP tool definitions:

```
MCP Client (e.g., Claude Desktop)
    ↓ discovers tools
PromptGate MCP Bridge
    ↓ maps to endpoints
AI Endpoints / API Gateway
    ↓ calls provider
OpenAI / Anthropic / Google / etc.
```

## Planned features

### Automatic tool generation

Each AI Endpoint in an MCP Gateway project is automatically exposed as an MCP tool. The tool definition is generated from the endpoint's configuration:

- **Tool name** — Derived from the endpoint name/slug
- **Description** — Taken from the endpoint description
- **Input schema** — Derived from the endpoint's input schema definition
- **Output format** — Structured based on the endpoint's output configuration

### MCP server endpoint

MCP Gateway projects expose a standard MCP server endpoint that clients can connect to:

```
https://gateway.example.com/api/v1/mcp/{project-slug}
```

MCP clients point to this URL and receive the full list of available tools.

### Authentication

MCP clients authenticate using PromptGate client tokens. Each token can be scoped to specific tools, so you control exactly what each client can access.

### Tool invocation

When an MCP client calls a tool, the bridge:

1. Validates the client token and permissions
2. Maps the tool call to the corresponding PromptGate endpoint
3. Executes the endpoint (which calls the AI provider or upstream API)
4. Returns the result in MCP format

All invocations are logged and subject to the same budget controls as direct endpoint calls.
