---
title: "MCP servers"
description: "Part of the MCP gateway: the settings of the servers behind it, the protocol versions PromptGate speaks with agents and servers, and how it runs local…"
---

<!-- Generated from docs/mcp-servers.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Part of the [MCP gateway](/mcp/): the settings of the servers behind
it, the protocol versions PromptGate speaks with agents and servers, and
how it runs local programs. An example with every kind of server is on
the [MCP gateway](/mcp/#what-the-mcp-gateway-can-do) page.

## Settings

| key | default | description |
|---|---|---|
| `url` | — | a remote server's MCP endpoint (Streamable HTTP) |
| `headers` | — | sent with every request, e.g. `Authorization`; use `${ENV}` references, values are never logged |
| `oauth` | — | an [OAuth connection](/oauth/#using-a-connection) whose token goes as `Authorization`, renewed by PromptGate (not with an `Authorization` header), or `auto`: [discovered](/oauth/#mcp-servers-oauth-auto) from the server; `security.ssrf.mcp: true` puts remote servers behind the [SSRF check](/api-gateway/#ssrf-protection) |
| `command`, `args` | — | a local program PromptGate starts and talks to over stdin/stdout |
| `env` | — | the program's environment — see [local programs](#local-programs) |
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
