---
title: "MCP gateway"
description: "Agents reach far more than models: through the Model Context Protocol they read repositories, tickets, files and databases, and every tool result goes straight…"
---

<!-- Generated from docs/mcp.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Agents reach far more than models: through the
[Model Context Protocol](https://modelcontextprotocol.io) they read
repositories, tickets, files and databases, and every tool result goes
straight back into the prompt. PromptGate puts those servers behind one
MCP endpoint, so an agent needs one entry in its config and every tool
call is logged, rate-limited and inspected like model traffic.

```
agent ──▶ PromptGate /mcp ──┬──▶ github   (remote, Streamable HTTP)
                            ├──▶ linear   (remote, Streamable HTTP)
                            └──▶ files    (local program over stdio)
```

Tools are renamed `<server>__<tool>` — `github__create_issue`,
`files__read_file` — so names from different servers never clash.

## What the MCP gateway can do

| feature | does | |
|---|---|---|
| one endpoint for every server | remote servers (Streamable HTTP) and local programs (stdio) behind `/mcp`; lists fetched in parallel and cached | [servers](/mcp-servers/) |
| moving agents | `mcp import` takes over the servers of Claude Code, Cursor, VS Code and Claude Desktop; `mcp setup` points the agent at the gateway | [moving agents](/mcp-agents/) |
| tool allowlists | per server `tools.allow` / `deny`; per key, servers or single tools | [below](#keys-limits-and-guardrails) |
| limits | per server or per tool, shared by every key — protects the server | [below](#keys-limits-and-guardrails) |
| guardrails in both directions | tool arguments, results, prompts, resources — and tool definitions ("tool poisoning") | [below](#guardrails) |
| OAuth | tokens for remote servers, renewed by PromptGate, also discovered from the server (`oauth: auto`) | [OAuth](/oauth/) |
| endpoint tools | every [AI Gateway endpoint](/endpoints/) is a tool, `endpoint__<slug>`, called through the model pipeline | [endpoint tools](/mcp-endpoints/) |
| PromptGate's own tools | stats, logs, config, keys, endpoints, limits, budgets — for keys with `control: read` or `write` | [control tools](/mcp-control/) |
| every protocol version | 2026-07-28 (stateless) and the earlier session versions, on both sides, mixed freely | [protocol versions](/mcp-servers/#protocol-versions) |
| local programs | started on demand with a clean environment; the whole process tree stopped; restarted after crashes | [local programs](/mcp-servers/#local-programs) |
| logs, stats, metrics | every call a log row; per-tool p50 and p95; Prometheus | [below](#logs-stats-and-metrics) |

Everything in one config:

```yaml
mcp:
  servers:
    github:                              # remote server
      url: https://api.githubcopilot.com/mcp/
      headers: { Authorization: "Bearer ${GITHUB_TOKEN}" }
      timeout: 30s
    linear:
      url: https://mcp.linear.app/mcp
      oauth: auto                        # token discovered from the server
      tools: { allow: [list_issues, get_issue] }   # only these
    files:                               # local program
      command: npx
      args: [-y, "@modelcontextprotocol/server-filesystem", /srv/docs]
      env: { NODE_OPTIONS: --max-old-space-size=256 }
      idle_stop: 10m
keys:
  - name: claude-code                     # or: promptgate keys create … --mcp …
    hash: sha256:…
    mcp: [github, files, linear/get_issue]   # servers or single tools; empty = all
    control: read                            # PromptGate's own tools, read-only
limits:
  mcp:
    files: 120/m                             # per server …
    github/create_issue: 10/h                # … or per tool
    "*": 600/m                               # every server without its own entry
guardrails:
  secrets: { action: block }                 # global rules cover tool calls too
  mcp:
    files:                                   # reads untrusted documents
      prompt_injection: { roles: [user, tool] }
      pii: { action: redact }
```

## Connecting agents

Agents connect to `http://127.0.0.1:7878/mcp` (`surfaces.mcp_gateway.mount`)
with a `pg_` key. The MCP gateway accepts only `pg_` keys, in every
`auth.mode` — there is no provider key to pass through — so create one
first: `promptgate keys create claude-code`.

```sh
# Claude Code
claude mcp add --transport http promptgate http://127.0.0.1:7878/mcp \
  --header "Authorization: Bearer pg_…"
```

```toml
# Codex — ~/.codex/config.toml
[mcp_servers.promptgate]
url = "http://127.0.0.1:7878/mcp"
bearer_token_env_var = "PROMPTGATE_KEY"
```

```json
// Cursor — .cursor/mcp.json
{ "mcpServers": { "promptgate": {
    "url": "http://127.0.0.1:7878/mcp",
    "headers": { "Authorization": "Bearer pg_…" } } } }
```

`promptgate mcp setup claude-code|cursor|codex|claude-desktop` writes
these entries for you, and `promptgate mcp import` takes the agents'
own servers over — see [moving agents](/mcp-agents/).

What agents get:

- **Tools and prompts** of every server the key may use, renamed
  `<server>__<name>`. A call goes to the server under the tool's own name.
  A tool the key or `tools.allow`/`deny` doesn't allow is answered like
  one that doesn't exist.
- **Resources** keep the servers' own URIs; a read goes to the server
  that lists the resource, else to the one whose resource template
  matches it.
- **Lists** are fetched from all servers in parallel and cached for
  `mcp.list_ttl` (or a server's shorter `ttlMs`); a reload starts changed
  servers with an empty cache. A server that fails is left out of the
  list and named in its `_meta` (`dev.promptgate/unavailable`) — the rest
  keep working. The merged list comes in one page.
- **Progress** of a long call is relayed as it arrives when the agent
  asked for it (`progressToken`) and accepts `text/event-stream`.
- **Cancelling** — `notifications/cancelled`, or closing the request —
  cancels the call at the server too.
- **Sessions** (legacy agents) live in memory and are bound to the key
  that opened them; after a restart, or a day unused, the agent gets 404
  and opens a new one, as the protocol intends.
- Browsers: a request with an `Origin` header must come from the
  gateway's own host or a page on this machine (DNS rebinding).

## Keys, limits and guardrails

Keys name the servers or single tools they may use (`keys[].mcp`, or
`promptgate keys create … --mcp github --mcp linear/get_issue`); limits
and guardrails take a server or `server/tool` — see the
[example above](#what-the-mcp-gateway-can-do).

Limits on MCP servers protect the server: they count calls from every
key together, like provider limits. A call over one gets JSON-RPC error
`-32029` with `retryAfter` (seconds) in its data; the server never sees
it. A tool limit and its server's limit are both taken, or neither.

## Guardrails

The [guardrails](/guardrails/) inspect MCP traffic in both directions,
with the same guards and settings as model traffic:

- **What the agent sends** — a tool's or prompt's arguments — counts as
  content of role `assistant`: the model wrote it. Request rules
  (`ip_allowlist`, `time_window`, `length`) apply too, also to
  `resources/read`.
- **What a server returns** — tool results (text, embedded resources,
  `structuredContent`), prompts and resources — counts as role `tool`.
  Binary data, media types and `_meta` are not read.

So a guard covers MCP exactly where it covers those roles in model
requests. `secrets` and `pii` read every role and so both directions out
of the box. `prompt_injection` and `keywords` read `user` content by
default; instructions planted in tool results — the main risk of MCP —
are caught once you add `tool` (`roles: [user, tool]`, as for `files`
in the [example above](#what-the-mcp-gateway-can-do)).

| action | arguments | results |
|---|---|---|
| `block` | JSON-RPC error `-32001`; the server is never called | a tool result with `isError` and the reason (the model learns why); for prompts and resources error `-32001` |
| `mask` | the server gets `[EMAIL]` | the agent gets `[EMAIL]` |
| `redact` | the server gets `[[EMAIL_001]]`; the agent gets the original back wherever the result repeats it — also in `Mcp-Param-*` headers the server sees only the token | like `mask`, with tokens |
| `log` | logged, passed on | logged, passed on |

Results are inspected whole; they are bounded by `mcp.max_result_bytes`
anyway. Levels: global → `guardrails.mcp.<server>` → the key's rules.
The web UI's *What applies* page shows the merged rules for a key and an
MCP server. Findings are in the request log's guard column and in
`promptgate_guardrail_findings_total`.

**Tool definitions** count as role `tool` too: descriptions of tools,
prompts and resources — and of their parameters — go into the model's
prompt, and instructions planted there ("tool poisoning") meet the same
guards. A blocked definition is left out of the list (and logged), a
masked one is listed masked. Each list is inspected once per guard set
and cached with it. Progress messages are not inspected.

## Logs, stats and metrics

Every MCP request except `ping` and `server/discover` is a row in the
request log, with surface `mcp`: the method as route, the server as
provider and the tool, prompt or resource as model; cost 0. A tool that
answered with `isError` is logged with status 200 and "the tool reported
an error"; a server that couldn't be reached with 502, a call over a
limit with 429, an agent that gave up with 499.

```sh
promptgate logs --surface mcp            # MCP requests only (ai: model requests only)
promptgate stats --by tool               # per server/tool: requests, errors, p50, p95
promptgate stats --surface mcp --by key
```

MCP requests have their own minute totals, so `stats`, budgets, cost and
[anomalies](/anomalies/) of model traffic never count tool calls. The
console shows them with `mcp` instead of `sse`. Metrics:
`promptgate_mcp_requests_total`, `promptgate_mcp_request_duration_seconds`
and `promptgate_mcp_server_up` — see [metrics](/metrics/).

## Command line

`promptgate mcp` connects to the servers directly — local programs are
started and stopped again — so it works without a running gateway.

| command | description |
|---|---|
| `mcp servers` | every server with transport, target, status, protocol version and tool count; exit 1 if one fails; `--timeout`, `--json` |
| `mcp tools [server]` | the tools agents see, `<server>__<tool>` and the first line of the description, after `tools.allow`/`deny`, endpoint tools included (`mcp tools endpoint` lists only them); `--json` prints the full definitions |
| `mcp import [file…]` | the servers of Claude Code, Claude Desktop, Cursor and VS Code configs as `mcp.servers`, secrets as `${ENV}`; `--write`, `--force` — see [moving agents](/mcp-agents/) |
| `mcp setup <agent>` | the entry that points `claude-code`, `cursor`, `codex` or `claude-desktop` at the gateway; `--write`, `--global`, `--create-key` |
| `mcp connect` | stdio shim to the running gateway, for agents that only start programs |
| `mcp call <server__tool>` | calls one tool through the gateway's routing and prints the result — text as is, other content named; `--args '{"q":"x"}'`, `--json`, `--timeout` (5m); progress goes to stderr; exit 1 when the tool reports an error |

```
$ promptgate mcp call files__read_text_file --args '{"path":"/srv/docs/README.md"}'
# PromptGate
…

$ promptgate mcp servers
NAME    TRANSPORT  TARGET                                    STATUS  PROTOCOL                TOOLS
files   stdio      npx -y @modelcontextprotocol/server-file… ok      2025-06-18 (legacy)     14
github  http       https://api.githubcopilot.com/mcp/        ok      2026-07-28 (modern)     51
```
