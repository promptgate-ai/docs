---
title: "Command line"
description: "promptgate <command> [flags]"
---

<!-- Generated from docs/cli.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

```
promptgate <command> [flags]
```

Global flags (every command):

| flag | env | description |
|---|---|---|
| `-c, --config` | `PROMPTGATE_CONFIG` | config file (default: OS config directory) |
| `--listen` | `PROMPTGATE_LISTEN` | listen address `host:port` |
| `-p, --provider` | `PROMPTGATE_PROVIDER` | default provider (`openai`, `anthropic`, `groq`, …) |
| `--auth-mode` | `PROMPTGATE_AUTH_MODE` | `auto`, `passthrough` or `keys` |

## Commands

In a terminal, `start`, `info`, `setup`, `update`, `install` and `version`
open with the PromptGate logo and version. Output to pipes, files and
services, and every `--json`, stays plain; `NO_COLOR` turns colours off.

| command | status | description |
|---|---|---|
| `setup` | ✅ | Write a commented `promptgate.yaml`, connect coding agents and start PromptGate. In a terminal it asks six questions: default provider (keys found in the environment are marked), its API key (the environment variable, or pasted hidden — stored quoted in the config, readable only by you), [protection](/guardrails/#ready-made-protection), a first `pg_` key with a name and a daily budget, which coding agents found on this machine to connect (see `connect` below), and the background service. `-y, --yes` (or no terminal) asks nothing: `--provider`, else the first provider whose key is in the environment, else `openai`; `--protection` (`recommended`, `strict`, `log`, `off`); a `pg_` key named `default` when that key is found (`--no-key` skips it), with `--budget` dollars a day (default 20, 0 = none); `--connect claude-code,codex`; `--service`. `--listen` sets the address. `--force` overwrites; in a terminal setup asks instead. |
| `info` | ✅ | Effective config, paths, providers and which server-side keys are present. `--json` for scripts. |
| `validate` | ✅ | Check the config, including aliases, guardrails and endpoint templates; exit code 1 and a list of problems when invalid. |
| `config` | ✅ | One setting at a time, named by its path: `get limits.providers.openai`, `set limits.providers.openai 50/s`, `set budgets.keys.ci '{daily_usd: 5}'` (values are YAML), `unset …`, `path`. A dot inside a key is written `\.`. `set` and `unset` are checked like `validate` before the file is written, keep the comments and a backup of the previous file, and are recorded in the [audit trail](/audit/) (the path, never the value); a running gateway applies them within seconds. `get` shows the file's value, not a default. |
| `version` | ✅ | Version, commit, build date, Go version, platform. `--json`. |
| `start` | ✅ | Run the gateway in the foreground. Without a config, in a terminal, it asks for the guardrails, whether to turn on the web UI and whether to run in the background (then as a service), then runs ([first start](/install/#first-start)). Prints a banner with the active guardrails and, in a terminal, one line per request (time, status, provider, model, TTFB, duration, size, key, [end user](/users/), [endpoint](/endpoints/)); `-q, --quiet` hides them. `--metrics host:port` serves [Prometheus metrics](/metrics/) on a separate port; `--ui host:port` or `--ui off` moves or turns off the [web UI](/ui/). The [MCP gateway](/mcp/) answers on `/mcp`, the [API Gateway](/api-gateway/) on `/api`. Ctrl-C / SIGTERM drain in-flight requests. Config, keys file, endpoints directory and [list files](/guard-lists/) are watched and reloaded automatically; list URLs are fetched in the background (also SIGHUP on Linux/macOS); an invalid change keeps the running config. |
| `install` | ✅ | Register and start a background service running `promptgate start` with the current config — per-user by default (LaunchAgent, `systemctl --user`), `--system` for system-wide (root / admin). `--pass-env NAME` copies an environment variable into the service, which otherwise doesn't see your shell environment. |
| `uninstall` | ✅ | Stop and remove the service; config, keys and request log stay. Agents still connected to the gateway are named; in a terminal it offers to send them directly again. |
| `connect` | ✅ | `connect claude-code` / `codex`: send the agent's model requests through this gateway by setting the base URL in its own config — Claude Code: `env.ANTHROPIC_BASE_URL` in `~/.claude/settings.json` (works with an API key and with a Pro/Max subscription); Codex: a `promptgate` model provider in `~/.codex/config.toml` using `$OPENAI_API_KEY` (a ChatGPT sign-in doesn't go through PromptGate). `$CLAUDE_CONFIG_DIR` and `$CODEX_HOME` are honoured. The rest of the file stays; it is copied to `<file>.before-promptgate` before the first change. Keep the gateway running (`install`). |
| `disconnect` | ✅ | `disconnect claude-code` / `codex`: remove what `connect` set; a base URL pointing elsewhere is left alone. |
| `service` | ✅ | `start`, `stop`, `restart`, `status` of the installed service (`--system` for the system-wide one). |
| `pause` | ✅ | Send every coding agent routed through this gateway directly to its provider again, then stop the service (`--system` for the system-wide one); remembered in `paused.json` in the data directory. A gateway still running in a terminal is named. |
| `resume` | ✅ | Start the service, wait until the gateway answers, then route the agents `pause` disconnected through it again; without a running gateway the agents stay direct. |
| `update` | ✅ | Download the latest release from install.promptgate.dev, verify the Ed25519 signature of `checksums.txt` and the binary's SHA-256, then replace this binary atomically. `--check` only reports. Homebrew / package-manager installs are left to their manager. |
| `keys` | ✅ | `create <name> [--provider …] [--endpoint …] [--mcp server\|server/tool …] [--api name …] [--control none\|read\|write] [--users optional\|required\|ignore]` prints a new `pg_` key once ([user policy](/users/#per-key-policy)); `list [--json]`; `revoke` / `enable` / `delete <name>`. Stored as SHA-256 hashes in `keys.yaml`; a running gateway applies changes within ~2 s. Keys defined inline in the config are read-only here. |
| `ui` | ✅ | [Web UI](/ui/) users: `users [list]`, `users add <name>`, `users remove <name>`, `passwd <name>`. In a terminal the password is typed twice; `--password-stdin` reads it from stdin; otherwise a random one is printed that must be changed at the next sign-in. A new password ends the user's sessions. Works with or without a running gateway. |
| `endpoints` | ✅ | `history <name>` / `diff <name> [from] [to]`: versions the gateway loaded and what changed; `list [--json]`: name, model, variables, [version](/endpoints/#versions), status and the file it comes from; `show <name>`: prompts, variables and parameters. See [endpoints](/endpoints/). |
| `mcp` | ✅ | `servers [--json] [--timeout]`: connect to every [MCP server](/mcp/) and show transport, target, status, protocol version and tool count (exit 1 if one fails); `tools [server] [--json]`: the tools agents see, named `<server>__<tool>`; `call <server__tool> [--args '{…}'] [--json]`: call one tool through the gateway's routing and print the result (exit 1 when the tool reports an error). `import [file…] [--write]`: take over the MCP servers of Claude Code, Claude Desktop, Cursor and VS Code (secrets become `${ENV}`); `setup <agent> [--write]`: point Claude Code, Cursor, Codex or Claude Desktop at the gateway; `connect`: stdio shim to the running gateway. See [moving agents](/mcp-agents/). Except `connect`, these work without a running gateway; local programs are started and stopped again. |
| `eval` | ✅ | `eval <endpoint> [--file] [--min-pass 0.9] [--json] [--provider-key]`: runs the endpoint's test cases through the current config and checks the answers; exit 1 below `--min-pass`. See [evals](/endpoint-evals/). |
| `replay` | ✅ | `replay <id> [--model] [--json] [--provider-key]`: sends a logged request again (needs `logging.bodies`). |
| `lists` | ✅ | The guardrail [lists](/guard-lists/) of the config: scope, guard, file or URL (without query), `into`, entries, last change, status (`ok`, `not fetched yet`, `failing since …`); `--check` fetches every URL now without storing it, `--json`. |
| `anomalies` | ✅ | Endpoint [anomalies](/anomalies/) the running gateway recorded: window, endpoint, signal, value, usual, threshold; `--since` (default 24h), `--json`. |
| `events` | ✅ | The [operational events](/events/) PromptGate publishes: type, group, when it fires; `--json`. |
| `webhooks` | ✅ | [Webhooks](/webhooks/#inspecting-and-testing): `list` (URL without query, events, state `ok` / `failing since …` / `idle` / `disabled`, waiting, delivered and given up in 24 h, last delivery), `test <webhook>` (sends a signed `webhook.test` now, prints status and answer, exit 1 unless 2xx), `deliveries [webhook] [--state pending\|delivered\|failed] [-n] [--before id] [--id n]` (`--id`: the event and the receiver's answer), `redeliver <id>… \| --failed <webhook>` (queued again, recorded in the audit trail); `--json` on `list` and `deliveries`. |
| `audit` | ✅ | The [audit trail](/audit/): `list [--since] [--until] [--actor] [--action key.*] [-n] [--json]`; `verify [--json]` checks the hash chain and prints its head, exit 1 when an entry was changed, deleted or moved; `export [--format jsonl\|csv] [-o file]` with every field, the same filters. |
| `licenses` | ✅ | Licenses of the third-party software and data compiled into the binary (also in `THIRD_PARTY_NOTICES.md`). |
| `apis` | ✅ | `list [--json]`: every [API](/api-gateway/) with route, URL, methods, credentials (never values); `call <api> <METHOD> <path> [-d body] [-H 'Name: value'] [-i]`: one request through the API Gateway's rules in-process — header policy, guardrails, SSRF check, OAuth token — without a running gateway or a `pg_` key; exit 1 on 400 or more. |
| `oauth` | ✅ | `presets [name] [--json]`: the built-in [OAuth providers](/oauth/#presets); `list [--json]`: every connection's state and expiry; `connect <name> [--no-browser] [--timeout]`: consent in the browser once ([connecting](/oauth/#connecting)), or fetch a client credentials token; `refresh <name>`; `disconnect <name>`: revoke and forget; `prune`: delete tokens of connections removed from the config. |
| `logs` | ✅ | Recent requests from the request log: id, time, status, provider, model, TTFB, duration, tokens, cost, key, [end user](/users/), error. `-n`, `--since 1h`, `--provider`, `--model`, `--key`, `--user <id>` (the id clients send, also with `users.log: hashed`), `--endpoint <name>`, `--session <id>`, `--surface ai\|mcp\|api` ([MCP gateway](/mcp/#logs-stats-and-metrics) requests have server and tool as provider and model, [API Gateway](/api-gateway/#logs-stats-limits-and-metrics) requests API and method), `--status 429\|5xx`, `-f/--follow`, `--json` (one object per line). |
| `stats` | ✅ | Requests, errors, p50/p95 latency, TTFB p50, tokens and cost for a window (`--since`, default 24h, minute resolution), optionally `--by provider\|model\|key\|endpoint\|user`, `--top n`; `--json`. `--by user` lists end users with their key, biggest spenders first, from daily totals (whole days in `budgets.timezone`, no latency columns); `--key` narrows it to one key. Reads per-minute aggregates, so it answers in milliseconds even over millions of requests; percentiles are accurate to ±3 %. Requests without a known price are counted separately. `--surface mcp` or `--by server\|tool` (`server/tool`) summarise [MCP gateway](/mcp/#logs-stats-and-metrics) requests instead: requests, errors, p50, p95; `--surface api` or `--by api\|method` the [API Gateway](/api-gateway/#logs-stats-limits-and-metrics)'s. |
| `budgets` | ✅ | Spend against every configured budget — day and month, USD and tokens, with % used; `"*"` budgets are listed per key / provider; end users most used first (`--top n`, default 10); `--json`. Reads the request log. See [budgets](/budgets/). |

Exit codes: `0` success, `1` error (message on stderr).
