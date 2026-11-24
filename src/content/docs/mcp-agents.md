---
title: "Moving agents to the MCP gateway"
description: "Three commands take an agent's MCP setup over to PromptGate: import moves its servers behind the gateway, setup points the agent at the gateway, and connect…"
---

<!-- Generated from docs/mcp-agents.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Three commands take an agent's MCP setup over to PromptGate: `import`
moves its servers behind the gateway, `setup` points the agent at the
gateway, and `connect` carries the requests of agents that only start
local programs.

## Import the agent's servers

```sh
promptgate mcp import                # .mcp.json, .cursor/mcp.json, .vscode/mcp.json here,
                                     # ~/.claude.json, ~/.cursor/mcp.json, Claude Desktop's config
promptgate mcp import ~/work/.mcp.json --write
```

`import` shows the `mcp.servers` entries the agents' servers become; with
`--write` it adds them to the config — checked like every change, and a
running gateway picks them up. Claude Code, Claude Desktop, Cursor and
VS Code configs are read, including the per-project servers in
`~/.claude.json`.

- **OAuth moves too.** A remote server without credentials of its own —
  agents sign in to those with OAuth — gets `oauth: auto`; connect it
  once with `promptgate oauth connect mcp:<server>`
  ([OAuth](/oauth/#mcp-servers-oauth-auto)). Until then requests go
  out without a token, and a server that wants one answers with what
  to run.
- **Secrets stay out of the config.** Values of `env` variables, headers
  and URL parameters whose names say key, token, secret, password or
  auth, `Bearer` tokens, and the values of flags like `--token` become
  `${ENV}` references (`${GITHUB_TOKEN}`). The variables to set are
  listed — in PromptGate's environment, and for the background service
  with `promptgate install --pass-env NAME`. Values that already are
  references stay as they are; user and password in a URL are left out
  with a note.
- **Names** become valid server names (`GitHub` → `github`); a name
  already in `mcp.servers` is skipped unless `--force`.
- **Skipped:** servers using the deprecated HTTP+SSE transport, and
  PromptGate itself (its own `/mcp`, or `promptgate mcp connect`) — an
  agent already set up must not loop through the gateway.

Remove the imported servers from the agent afterwards, or it talks to
them both directly and through PromptGate.

## Point the agent at the gateway

```sh
promptgate mcp setup claude-code                      # show the entry
promptgate mcp setup claude-code --write              # ./.mcp.json (--global: ~/.claude.json)
promptgate mcp setup cursor --write --global          # ~/.cursor/mcp.json (default: ./.cursor/mcp.json)
promptgate mcp setup codex --write                    # ~/.codex/config.toml
promptgate mcp setup claude-desktop --write --create-key desktop
```

| agent | entry | key |
|---|---|---|
| Claude Code | `{"type":"http","url":…,"headers":{"Authorization":"Bearer ${PROMPTGATE_KEY}"}}` | from the environment |
| Cursor | `{"url":…,"headers":{"Authorization":"Bearer ${env:PROMPTGATE_KEY}"}}` | from the environment |
| Codex | `[mcp_servers.promptgate]` with `url` and `bearer_token_env_var` | from the environment |
| Claude Desktop | `promptgate mcp connect` as a local program | written into the entry's `env` |

The agent's other settings stay as they are; an existing `promptgate`
entry is replaced only with `--force`. `--key-env` names another
variable, `--url` another gateway address (default: from the config,
`http://127.0.0.1:7878/mcp`). `--create-key <name>` creates a `pg_` key
for the agent and prints it once.

## connect: for agents that only start programs

Claude Desktop starts MCP servers as local programs and doesn't reach
remote ones. `promptgate mcp connect` is that program: it reads MCP
messages on stdin, sends them to the running gateway with the key in
`PROMPTGATE_KEY` (`--key-env`), and writes the answers — progress and
other streamed notifications included — to stdout. It speaks both
protocol eras, keeps the session of an agent that opens one, opens it
again when the gateway restarted, and ends it when the agent quits. It
needs a running gateway (`promptgate start` or the service); a request
the gateway can't answer gets an error, not silence.

See also: [MCP gateway](/mcp/).
