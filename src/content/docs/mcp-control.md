---
title: "MCP control tools"
description: "PromptGate is an MCP server itself: an agent can read its state and, if you allow it, change it. Off by default — a key needs control:"
---

<!-- Generated from docs/mcp-control.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate is an MCP server itself: an agent can read its state and, if
you allow it, change it. Off by default — a key needs `control`:

```yaml
keys:
  - name: ops-agent
    hash: sha256:…
    control: write          # none (default) | read | write
```

| tool | level | what it does |
|---|---|---|
| `promptgate__stats` | read | requests, errors, p50/p95, tokens, cost — `since`, `by`, `surface` |
| `promptgate__logs` | read | recent requests (at most 100), with the `logs` filters |
| `promptgate__budgets` | read | spend against every budget, today and this month |
| `promptgate__anomalies` | read | endpoint anomalies |
| `promptgate__config` | read | the running config without secrets: providers (whether a key is set, never the key), aliases, MCP servers (URLs without credentials or query), limits, budgets, guardrails, mounts |
| `promptgate__endpoints` | read | endpoints with model, input, version, state |
| `promptgate__keys` | read | keys with their restrictions — never secrets or hashes |
| `promptgate__apis` | read | the [API Gateway](/api-gateway/)'s APIs: URL, methods, OAuth connection, header names — never header values |
| `promptgate__oauth_connections` | read | [OAuth connections](/oauth/): state, expiry, why a reconnect is needed — never tokens |
| `promptgate__key_create` | write | a new key (optionally limited to providers, endpoints, MCP servers, APIs), returned once |
| `promptgate__key_rotate` | write | a new secret for a key, returned once |
| `promptgate__key_disable`, `…_enable` | write | revoke or restore a key |
| `promptgate__endpoint_disable`, `…_enable` | write | switch an endpoint off or on |
| `promptgate__endpoint_update` | write | model, description, system prompt or template |
| `promptgate__limit_set`, `…_remove` | write | a rate limit in any scope |
| `promptgate__budget_set` | write | budget caps; 0 removes one |
| `promptgate__api_set`, `promptgate__api_delete` | write | create, change or remove an API — without credentials: `headers.set`, `oauth` and `private` are for people, and an API that carries credentials or is private keeps its URL |

Every change takes the web UI's path: the new file is checked as the
gateway would load it (an invalid change is refused and nothing is
written), the previous version is backed up, the gateway reloads, and
the [audit trail](/audit/) records it as `mcp:<key>` with the agent's address
(*Settings → Audit trail* in the web UI). Keys from the keys file can be
changed; keys written into the config itself can't. Without the request
log (`logging.store: off`) there is no audit trail and no write tool,
and the log tools are missing too. A read key sees only the read tools;
a tool a key may not use answers like one that doesn't exist. Agents
never steer credentials: no tool connects or disconnects OAuth (that
needs a person's consent), sets credential headers, marks an API
private or points a credentialed API elsewhere. The name
`promptgate` is reserved: no server may take it.

See also: [MCP gateway](/mcp/).
