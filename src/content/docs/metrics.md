---
title: "Metrics"
description: "PromptGate exports Prometheus metrics on a separate port, so scrapers never share a listener with API traffic and the metrics port can be firewalled on its…"
---

<!-- Generated from docs/metrics.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate exports Prometheus metrics on a **separate port**, so scrapers
never share a listener with API traffic and the metrics port can be
firewalled on its own. It is off by default.

```yaml
metrics:
  listen: 127.0.0.1:9464      # empty or off = disabled
  path: /metrics
  token: ${PROMPTGATE_METRICS_TOKEN}   # optional bearer token
  max_series: 10000           # label combinations per metric
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300]
```

`promptgate start --metrics 127.0.0.1:9464` or `PROMPTGATE_METRICS_LISTEN`
enable it without editing the file. The banner shows the URL:

```
  metrics           http://127.0.0.1:9464/metrics
```

Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: promptgate
    static_configs: [{ targets: ["127.0.0.1:9464"] }]
    authorization: { credentials: "<token>" }   # only with metrics.token
```

Metrics settings are read at start; a reload logs that a restart is needed.

## Metrics

| metric | type | labels | description |
|---|---|---|---|
| `promptgate_requests_total` | counter | `route`, `provider`, `model`, `key`, `status` | every request, including refused ones (`429` rate limit, `402` budget, `401`, …) and `499` client closed |
| `promptgate_request_duration_seconds` | histogram | `route`, `provider` | time to the last response byte |
| `promptgate_time_to_first_byte_seconds` | histogram | `route`, `provider` | time to the first response byte (first token when streaming) |
| `promptgate_tokens_total` | counter | `provider`, `model`, `key`, `type` | tokens reported by providers; `type` = `input`, `output`, `cache_read`, `cache_write` |
| `promptgate_cost_usd_total` | counter | `provider`, `model`, `key` | estimated spend from the [price table](/configuration/#request-log-and-pricing) |
| `promptgate_fallback_requests_total` | counter | `route`, `provider` | requests served after at least one [fallback](/routing/#fallbacks); `provider` is the one that served |
| `promptgate_fallback_attempts_total` | counter | `provider`, `reason` | failed attempts that triggered a fallback; `reason` = status code, `rate-limited` or `unreachable` |
| `promptgate_guardrail_findings_total` | counter | `guard`, `action`, `kind` | what guardrails found; `action` = `blocked`, `masked`, `redacted`, `trimmed`, `logged` |
| `promptgate_token_saver_bytes_total` | counter | `key`, `mode` | bytes the [token saver](/guard-token-saver/) removed (`applied`) or would have (`dry_run`) |
| `promptgate_mcp_requests_total` | counter | `method`, `server`, `tool`, `key`, `status` | [MCP gateway](/mcp/) requests; a list has no server and its method as `tool` |
| `promptgate_mcp_request_duration_seconds` | histogram | `method`, `server` | time an MCP gateway request took |
| `promptgate_mcp_server_up` | gauge | `server` | 1 when the last request to the MCP server reached it, 0 when it couldn't; requests refused before the server leave it unchanged |
| `promptgate_api_requests_total` | counter | `api`, `method`, `key`, `status` | [API Gateway](/api-gateway/) requests; a request for an unknown API has `api=""` |
| `promptgate_api_request_duration_seconds` | histogram | `api` | time an API Gateway request took, to the last byte |
| `promptgate_ssrf_blocked_total` | counter | `surface` | outbound connections the [SSRF check](/api-gateway/#ssrf-protection) refused |
| `promptgate_events_total` | counter | `type` | [operational events](/events/) published, e.g. `budget.exceeded`, `mcp.server_down` |
| `promptgate_events_dropped_total` | counter | `subscriber` | events a listener lost because its queue was full |
| `promptgate_webhook_deliveries_total` | counter | `webhook`, `result` | [webhook](/webhooks/) attempts since start: `delivered`, `retried` (failed, tried again later), `given_up`, `dropped` (queue full) |
| `promptgate_webhook_pending` | gauge | `webhook` | deliveries waiting in the webhook's queue |
| `promptgate_requests_in_flight` | gauge | — | requests being served right now |
| `promptgate_spend_usd` | gauge | `scope`, `name`, `period` | spend in the current day / month (`period`), per `scope` `total`, `key`, `provider`, `endpoint` (and `user`, named `key/user`, only with `metrics.user_label`) — the counters [budgets](/budgets/) check against, in `budgets.timezone` |
| `promptgate_anomaly` | gauge | `endpoint`, `signal` | 1 while the endpoint's latest five-minute window is an [anomaly](/anomalies/) for the signal |
| `promptgate_spend_tokens` | gauge | `scope`, `name`, `period` | tokens in the current day / month |
| `promptgate_build_info` | gauge | `version`, `goversion` | always 1 |
| `process_start_time_seconds` | gauge | — | process start, Unix seconds |
| `go_goroutines`, `go_memstats_heap_alloc_bytes` | gauge | — | runtime health |

Label values:

- `route` is the API path (`/v1/chat/completions`, `/v1/messages`, …).
- `provider` and `model` are where the request went — after alias
  resolution, so an alias `fast` shows up as e.g. `groq` /
  `llama-3.3-70b`. Both are empty for requests refused before routing.
- `key` is the `pg_` key name; empty for passthrough keys.
- `user` (only with `metrics.user_label: true`) follows `key` on
  `promptgate_requests_total`, `promptgate_tokens_total` and
  `promptgate_cost_usd_total`: the [end user](/users/), hashed with
  `users.log: hashed`, empty when none was named.

## Cardinality

`model` comes from clients, so a misbehaving client could create
unbounded label combinations. `max_series` caps each metric: once
reached, further new combinations are counted in one series whose labels
are all `_overflow`, and a warning is logged once. Totals stay correct.

The user label is off by default for the same reason: every end user is a
new series. Turn it on for tens or hundreds of users. With thousands, use
`promptgate stats --by user` instead, which reads daily totals from the
request log.

## Example queries

```promql
# Requests per second by provider
sum by (provider) (rate(promptgate_requests_total[5m]))

# Share of provider errors
sum(rate(promptgate_requests_total{status=~"5.."}[5m])) / sum(rate(promptgate_requests_total[5m]))

# p95 time to first token
histogram_quantile(0.95, sum by (le, provider) (rate(promptgate_time_to_first_byte_seconds_bucket[5m])))

# Spend per key today
promptgate_spend_usd{scope="key", period="day"}
```

A webhook whose receiver stopped taking events:

```promql
promptgate_webhook_pending > 100

# Fallbacks caused by overloaded Anthropic
increase(promptgate_fallback_attempts_total{provider="anthropic", reason="529"}[1h])
```

## Security and performance

The endpoint binds to `127.0.0.1` in the example above. When it listens
beyond localhost without a `token`, PromptGate logs a warning at start —
metrics reveal key names, models and spend. The token is compared in
constant time.

Recording costs the request goroutine one queue send; counters are
updated on a collector goroutine (about 160 ns and no allocations per
request) and rendered only when scraped. Measured with and without
metrics: no difference in throughput or latency
(results).
