---
title: "MCP endpoint tools"
description: "Every AI Gateway endpoint is also a tool, endpoint__<slug>, unless mcp.endpoints: false or the endpoint says mcp: false. An agent calls the prompt you own like…"
---

<!-- Generated from docs/mcp-endpoints.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Every [AI Gateway endpoint](/endpoints/) is also a tool,
`endpoint__<slug>`, unless `mcp.endpoints: false` or the endpoint says
`mcp: false`. An agent calls the prompt you own like any other tool:

| endpoint | tool arguments | tool result |
|---|---|---|
| typed `variables` | the variables, as a JSON Schema (types, `enum`, `min`/`max`, `max_length`, `pattern`, defaults, required) | the answer as text |
| `input_schema` | that schema | the answer as text |
| messages (no variables) | `input`: one message | the answer as text |
| with an object `output_schema` | as above | also `structuredContent`, with the schema as the tool's `outputSchema` |

The call runs through the model pipeline as the agent: with its key and
address, so the endpoint's model, routes, cache, sessions,
`limits.endpoints`, budgets, `guardrails.endpoints` and logging all
apply — the request log shows the tool call and the model request it
made. A refusal (invalid variables, a limit, a guardrail, a provider
error) comes back as an `isError` result with the reason, so the model
can correct itself. The key needs the endpoint in its `endpoints` list
(if it has one) and `endpoint` or `endpoint/<slug>` in its `mcp` list
(if it has one). `endpoint` is reserved: no server may take the name.

See also: [MCP gateway](/mcp/), [endpoints](/endpoints/).
