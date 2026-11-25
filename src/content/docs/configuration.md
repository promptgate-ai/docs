---
title: "Configuration"
description: "PromptGate reads one YAML file, promptgate.yaml. Without a file it runs on built-in defaults; promptgate setup writes a commented starting point."
---

<!-- Generated from docs/configuration.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate reads one YAML file, `promptgate.yaml`. Without a file it runs on
built-in defaults; `promptgate setup` writes a commented starting point.

## Precedence

Every setting resolves in this order — the first one that is set wins:

1. command-line flag (`--listen`, `--provider`, `--auth-mode`, `--config`,
   `start --metrics`, `start --ui`)
2. environment variable (`PROMPTGATE_LISTEN`, `PROMPTGATE_PROVIDER`,
   `PROMPTGATE_AUTH_MODE`, `PROMPTGATE_CONFIG`, `PROMPTGATE_DATA_DIR`,
   `PROMPTGATE_METRICS_LISTEN`, `PROMPTGATE_UI_LISTEN`)
3. the config file
4. the built-in default

`promptgate info` prints the effective values; `promptgate validate` checks
the file. Unknown keys are errors, so typos never fall back silently.

## Locations

| OS | config file | data directory |
|---|---|---|
| Linux, macOS | `$XDG_CONFIG_HOME/promptgate/promptgate.yaml` (default `~/.config/…`) | `$XDG_DATA_HOME/promptgate` (default `~/.local/share/…`) |
| Windows | `%APPDATA%\promptgate\promptgate.yaml` | `%LOCALAPPDATA%\promptgate` |

## Reference

| key | default | description |
|---|---|---|
| `version` | `1` | schema version |
| `server.listen` | `127.0.0.1:7878` | listen address; `0.0.0.0:7878` accepts remote clients |
| `server.read_header_timeout` | `10s` | max time for a client to send request headers |
| `server.shutdown_timeout` | `30s` | grace period for in-flight requests on shutdown |
| `server.max_body_bytes` | `33554432` (32 MiB) | maximum request body size |
| `server.trusted_proxies` | — | reverse proxies (IPs, CIDRs) whose `X-Forwarded-For` names the client — see [access rules](/guard-access/#behind-a-reverse-proxy) |
| `auth.mode` | `auto` | `auto`, `passthrough` or `keys` — see below |
| `auth.keys_file` | `default` | file of `pg_` keys managed by `promptgate keys`; `default` = `keys.yaml` next to the config |
| `keys` | `[]` | inline `pg_` keys: `name`, `hash` (`sha256:…`), optional `providers`, `endpoints` (allowed [AI Gateway endpoints](/endpoints/#keys)), `mcp` (allowed [MCP servers or tools](/mcp/#keys-limits-and-guardrails)), `apis` (allowed [API Gateway APIs](/api-gateway/)), `control` (`none`, `read`, `write`: [PromptGate's own MCP tools](/mcp-control/)), `users` (`optional`, `required`, `ignore` — see [end users](/users/#per-key-policy)), `disabled` |
| `default_provider` | `openai` | provider used when the request doesn't pick one |
| `providers.<name>` | built-in presets | override or add upstreams — see below |
| `endpoints.<name>` | — | AI Gateway endpoints: `model`, `system`, `template`, typed `variables` or `input_schema`, `output_schema`, `output_retries`, `routes`, `sessions`, `cache`, `params`, `client_params`, `stream`, `disabled`, `mcp` (`false`: not an MCP tool) — see [endpoints](/endpoints/) |
| `surfaces.ai_gateway.mount` | `/gw` | path prefix endpoints answer on (`/gw/<name>`); restart to apply |
| `surfaces.mcp_gateway.mount` | `/mcp` | where agents reach the [MCP gateway](/mcp/); restart to apply |
| `mcp.servers.<name>` | — | MCP servers behind the gateway: remote (`url`, `headers`, `oauth`) or a local program (`command`, `args`, `env`, `dir`, `start`, `idle_stop`), `timeout`, `tools.allow`/`deny`, `disabled` — see [MCP gateway](/mcp/) |
| `mcp.separator` / `mcp.list_ttl` / `mcp.max_result_bytes` | `__` / `5m` / 4 MiB | tool names `<server>__<tool>`, list cache, largest message from a server or an agent |
| `mcp.endpoints` | `true` | serve the AI Gateway endpoints as MCP tools `endpoint__<slug>` — see [endpoint tools](/mcp-endpoints/) |
| `surfaces.api_gateway.mount` | `/api` | where the [API Gateway](/api-gateway/) serves `<mount>/<api>/<path>`; restart to apply |
| `apis.<name>` | — | HTTP APIs behind the API Gateway: `url`, `oauth`, `methods`, `headers.forward`/`block`/`set`, `timeout`, `max_request_bytes`, `max_response_bytes`, `query`, `retries`, `private`, `forwarded`, `disabled` — see [API Gateway](/api-gateway/) |
| `security.ssrf.allow` / `security.ssrf.mcp` | `[]` / `false` | exceptions to the [SSRF check](/api-gateway/#ssrf-protection) (IPs, CIDRs, host names); apply it to remote MCP servers too |
| `oauth.connections.<name>` | — | [OAuth connections](/oauth/): `preset`, `grant`, `client_id`, `client_secret`, `scopes`, `config`, `authorize_url`/`token_url`/`refresh_url`/`revoke_url`, `token_auth`, `pkce`, `params`, `disabled` |
| `oauth.redirect_url` | web UI `/oauth/callback` | where providers send the browser back after consent |
| `sessions.max` | `10000` | [endpoint sessions](/endpoint-sessions/) kept in memory; the least recently used go first; restart to apply |
| `cache.max_bytes` | `67108864` (64 MiB) | memory for the [endpoint answer cache](/endpoints/#cache); restart to apply |
| `anomalies.enabled` | `true` | compare each endpoint's last five minutes with its past week — see [anomaly alerts](/anomalies/); needs the request log |
| `anomalies.sensitivity` | `3.5` | scaled MADs above the median that count as an anomaly; higher is calmer |
| `anomalies.min_requests` | `5` | requests a five-minute window needs to be judged |
| `endpoints_dir` | `default` | one `<name>.yaml` per endpoint; `default` = `endpoints/` next to the config, relative paths are relative to it; watched like the config |
| `models.<alias>` | — | model aliases: `provider`, `model`, optional `system`, `params`, `fallbacks`, `fallback_on` — see [routing](/routing/#model-aliases) |
| `budgets.total/keys/users/endpoints/providers` | — | spend caps per day and month: `daily_usd`, `monthly_usd`, `daily_tokens`, `monthly_tokens`; `"*"` = every name; `users` count per key and [end user](/users/) — see [budgets](/budgets/) |
| `budgets.timezone` | `UTC` | IANA time zone in which budget days and months start |
| `guardrails.<guard>` | — | request inspection: `ip_allowlist`, `time_window`, `token_saver`, `keywords`, `length`, `prompt_injection`, `secrets`, `pii`, `pii_contextual`, `attachments`; overrides per `models.<alias>`, `endpoints.<name>`, `mcp.<server>`, `apis.<api>` and `keys.<key>`; `lists` fills words, IP ranges, phrases or allowed values from files and URLs — see [guardrails](/guardrails/) and [lists](/guard-lists/) |
| `limits.keys/users/endpoints/models/providers/mcp/apis.<name>` | — | request rate limits (`mcp`: per server or `server/tool`, `apis`: per API, both shared by all keys) (`60/m` or `{requests, burst}`); `"*"` = every name; `users` count per key and [end user](/users/) — see [rate limits](/limits/) |
| `users.sources` | `[header, openai, anthropic]` | where the end user's id is read, in order; `[]` turns it off — see [end users](/users/) |
| `users.header` | `X-PromptGate-User` | request header holding the id; never forwarded |
| `users.max_length` | `128` | longest accepted id |
| `users.log` | `plain` | `hashed` logs a keyed hash (`u_…`) instead of the id |
| `users.hash_key` | — | HMAC key for hashed ids, at least 16 characters |
| `users.forward` | `off` | `hashed` or `plain` sets the provider's own user field (OpenAI `safety_identifier` / `user`, Anthropic `metadata.user_id`) — see [end users](/users/#passing-the-user-on-to-the-provider) |
| `users.passthrough` | `optional` | user policy for requests with a provider key |
| `logging.store` | `default` | SQLite request log; `default` = `promptgate.db` in the data directory, relative paths are relative to it, `off` disables logging |
| `logging.bodies` | `false` | also store each request as the provider got it (after guardrails) and its answer, up to 1 MB each — needed by [`replay`](/endpoint-evals/#replay) |
| `logging.retention` | `7d` | how long individual request rows are kept |
| `logging.stats_retention` | `90d` | how long per-minute aggregates are kept (`promptgate stats`, budget history); at least `31d` with monthly budgets |
| `webhooks.<name>` | — | send [events](/events/) to a URL, signed per Standard Webhooks: `url`, `secret`, `events`, `headers`, `timeout`, `private`, `disabled` — see [webhooks](/webhooks/); needs the request log |
| `audit.retention` | `0` | delete [audit trail](/audit/) entries older than this, keeping the chain verifiable; `0` keeps them forever; at least `1d` |
| `logging.console` | `auto` | one line per request on stdout: `auto` (only in a terminal — services stay quiet), `on`, `off`; env `PROMPTGATE_CONSOLE`, flag `--quiet` |
| `metrics.listen` | off | Prometheus endpoint on its own `host:port`; empty or `off` disables it; env `PROMPTGATE_METRICS_LISTEN`, flag `start --metrics` — see [metrics](/metrics/) |
| `metrics.path` | `/metrics` | path the metrics are served on |
| `metrics.token` | — | when set, scrapers must send `Authorization: Bearer <token>` |
| `metrics.max_series` | `10000` | label combinations per metric; more are counted as `_overflow` |
| `metrics.user_label` | `false` | add the [end user](/users/) as a label to request, token and cost counters; mind cardinality |
| `metrics.buckets` | 5 ms … 300 s | latency histogram bounds in seconds, strictly increasing |
| `ui.enabled` | `true` | serve the [web UI](/ui/); env `PROMPTGATE_UI_LISTEN=off`, flag `start --ui off` turn it off |
| `ui.listen` | `127.0.0.1:7879` | the UI's own `host:port`, apart from API traffic; env `PROMPTGATE_UI_LISTEN`, flag `start --ui`; restart to apply |
| `ui.mount` | — | serve the UI on the gateway's port under this path (e.g. `/ui`) instead of on `ui.listen`; restart to apply |
| `ui.session_ttl` | `12h` | sign-ins end after this much inactivity (`5m` – `7d`); seven days at most |
| `ui.secure_cookies` | `false` | mark the session cookie `Secure` — set it when the UI is reached over HTTPS |
| `pricing.<provider>/<model>` | built-in table | USD per million tokens: `input`, `output`, `cache_read`, `cache_write`; adds or overrides prices |

Durations accept Go notation (`250ms`, `30s`, `2h`) and whole days (`7d`).

## Auth modes

| mode | request with provider key | request with `pg_` key | request without key |
|---|---|---|---|
| `auto` | passed through | uses the server-side provider key | 401 |
| `passthrough` | passed through | 401 | 401 |
| `keys` | 401 | uses the server-side provider key | 401 |

Server-side provider keys are never used without a valid `pg_` key.

## Providers

Built-in presets: `openai`, `anthropic`, `gemini`, `gemini-native`,
`cohere`, `groq`, `mistral`, `together`, `deepseek`, `openrouter`, `xai`,
`ollama`. Each reads its server-side key from the usual variable
(`OPENAI_API_KEY`, `GEMINI_API_KEY`, `CO_API_KEY`, …) and can be selected
with `--provider` without any config. `gemini` uses Google's
OpenAI-compatible endpoint, `gemini-native` the native `generateContent`
API; both are priced from the same table.

```yaml
providers:
  openai:                           # override fields of a preset
    base_url: https://proxy.corp.example/v1
    headers:
      OpenAI-Organization: org-123
  work:                             # a second account based on a preset
    preset: anthropic
    api_key: ${ANTHROPIC_WORK_KEY}
  vllm:                             # any OpenAI-compatible server
    type: openai-compatible
    base_url: http://gpu-box:8000/v1
    timeout: 2m
```

| field | description |
|---|---|
| `preset` | catalogue entry to inherit from (defaults to the entry's own name) |
| `type` | wire format: `openai`, `anthropic`, `openai-compatible`, `gemini` (native) or `cohere` (v2 Chat) — see [formats](/formats/) |
| `base_url` | API root including the version path |
| `api_key` | server-side key, usually `${ENV_VAR}` |
| `headers` | extra headers sent upstream |
| `timeout` | max duration of one upstream call (default `10m`) |

## Environment references

Values may reference environment variables, so secrets stay out of the file:
`${NAME}`, `${NAME:-fallback}`; `$$` is a literal `$`. References are
expanded inside values only — a variable can never change the file structure.

## Request log and pricing

Every request — including the ones PromptGate rejects — is written to the
request log: provider, model, status, latency, tokens and cost. Requests
only enqueue the entry; one background writer stores them in batches, so
logging adds no measurable latency. If the writer ever falls behind,
entries are dropped (never the request) and a warning is logged.
Alongside the raw rows the writer keeps per-minute aggregates (counts,
tokens, cost and latency histograms), which is what `promptgate stats`
reads. Requests the client abandons are logged with status 499.

Costs come from a price table built into the binary (generated from
LiteLLM's public price list, see `tools/genpricing`). The model the
provider reports wins over the requested one, so dated snapshots such as
`gpt-4o-mini-2024-07-18` are priced correctly. Add or override prices:

```yaml
pricing:
  groq/llama-3.3-70b-versatile: { input: 0.59, output: 0.79 }
  vllm/my-model:                { input: 0, output: 0 }
```
