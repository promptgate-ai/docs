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

## Servers

```yaml
mcp:
  servers:
    github:                              # remote server
      url: https://api.githubcopilot.com/mcp/
      headers: { Authorization: "Bearer ${GITHUB_TOKEN}" }
      timeout: 30s
    files:                               # local program
      command: npx
      args: [-y, "@modelcontextprotocol/server-filesystem", /srv/docs]
      env: { NODE_OPTIONS: --max-old-space-size=256 }
      idle_stop: 10m
    linear:
      url: https://mcp.linear.app/mcp
      tools:
        allow: [list_issues, get_issue]  # only these
```

| key | default | description |
|---|---|---|
| `url` | — | a remote server's MCP endpoint (Streamable HTTP) |
| `headers` | — | sent with every request, e.g. `Authorization`; use `${ENV}` references, values are never logged |
| `oauth` | — | an [OAuth connection](/oauth/#using-a-connection) whose token goes as `Authorization`, renewed by PromptGate (not with an `Authorization` header), or `auto`: [discovered](/oauth/#mcp-servers-oauth-auto) from the server; `security.ssrf.mcp: true` puts remote servers behind the [SSRF check](/api-gateway/#ssrf-protection) |
| `command`, `args` | — | a local program PromptGate starts and talks to over stdin/stdout |
| `env` | — | the program's environment — see [Local programs](#local-programs) |
| `dir` | PromptGate's | working directory of the program |
| `start` | `lazy` | `lazy` starts the program on its first call, `eager` with the gateway |
| `idle_stop` | `0` (never) | stop a program unused this long; the next call starts it again |
| `timeout` | `60s` | one call, start of a program included |
| `tools.allow` | all | the tools served, by the server's own names; patterns like `list_*` |
| `tools.deny` | — | tools never served; wins over `allow` |
| `disabled` | `false` | keep the entry, serve nothing from it |

A server has either `url` or `command`. Names are lowercase letters,
digits and `-`.

Settings for all servers:

| key | default | description |
|---|---|---|
| `mcp.separator` | `__` | joins server and tool names |
| `mcp.list_ttl` | `5m` | how long tool, prompt and resource lists are cached; a server's own shorter time wins |
| `mcp.max_result_bytes` | `4194304` (4 MiB) | largest message accepted from a server or an agent |
| `surfaces.mcp_gateway.mount` | `/mcp` | where agents connect |

A config reload restarts only the servers whose settings changed; an
unchanged local program keeps running.

## Endpoint tools

Every [AI Gateway endpoint](/endpoints/) is also a tool,
`endpoint__<slug>`, called through the model pipeline as the agent —
see [endpoint tools](/mcp-endpoints/).

## PromptGate's own tools

Keys with `control: read` or `write` also see PromptGate's own tools —
stats, logs, config, keys, endpoints, limits, budgets. See
[control tools](/mcp-control/).

## Keys, limits and guardrails

```yaml
keys:
  - name: claude-code
    mcp: [github, files, linear/get_issue]   # servers or single tools; empty = all
limits:
  mcp:
    files: 120/m                             # per server …
    github/create_issue: 10/h                # … or per tool
    "*": 600/m                               # every server without its own entry
guardrails:
  secrets: { action: block }                 # global rules cover tool calls too
  mcp:
    files: { pii: { action: redact } }       # per server, the key's rules still win
```

See [Guardrails](#guardrails) for what the rules do with tool calls.

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
are caught once you add `tool`:

```yaml
guardrails:
  secrets: { action: block }
  mcp:
    files:                                   # reads untrusted documents
      prompt_injection: { roles: [user, tool] }
      pii: { action: redact }
```

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

## Protocol versions

MCP changed shape with version 2026-07-28: requests carry their protocol
version and capabilities themselves, sessions and the `initialize`
handshake are gone. Most agents and servers still speak the earlier
versions. PromptGate speaks both, on both sides:

- **Agents:** a request with per-request metadata is served statelessly;
  an `initialize` opens a session (`Mcp-Session-Id`) in the version the
  agent asked for. Versions 2026-07-28, 2025-11-25, 2025-06-18 and
  2025-03-26.
- **Servers:** PromptGate asks each server once with `server/discover`.
  A modern server answers it; a legacy one gets `initialize` and a
  session. The answer is remembered — for a local program across its
  restarts. A forgotten session (the server restarted) is opened again.

Agent and server need not match: a legacy agent can use a modern server
and the other way round. PromptGate introduces itself to servers with
its own identity and capabilities; an agent's never reach them.

Not forwarded: sampling, roots and elicitation (a server asking the agent
for input mid-call — answered with "not supported"), and the deprecated
HTTP+SSE transport of 2024-11-05.

## Local programs

PromptGate starts a local server on its first call (or with the gateway,
`start: eager`) and stops it on shutdown, on reload when its settings
changed, and after `idle_stop`.

- **Environment:** a program inherits only `PATH`, `HOME`, `USER`,
  `LANG`, `TMPDIR`, `TZ` and the basic Windows variables
  (`SystemRoot`, `APPDATA`, `TEMP`, …). Provider keys and other secrets in
  PromptGate's environment stay out; give a program what it needs under
  `env`, ideally as `${ENV}` references.
- **Process tree:** each program runs in its own process group (Linux,
  macOS) or job object (Windows), so stopping it also ends what it
  started — `npx` and the `node` behind it. Stopping closes stdin first,
  then sends SIGTERM, then SIGKILL, two seconds apart. On Linux and
  Windows the programs end with PromptGate even if it crashes.
- **Crashes:** a program that exits is started again on the next call,
  after a pause that doubles from one second to a minute while it keeps
  crashing, and resets after it ran for 30 seconds.
- **Output:** what a program writes to stderr goes to PromptGate's log
  (shortened, at most 50 lines per 10 seconds); stray lines on stdout
  that aren't MCP messages are logged and skipped.

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
