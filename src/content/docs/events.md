---
title: "Operational events"
description: "PromptGate publishes an event whenever something happens that the people running it should hear about without watching a terminal: a budget running out, a…"
---

<!-- Generated from docs/events.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate publishes an event whenever something happens that the people
running it should hear about without watching a terminal: a budget
running out, a provider failing, an MCP server going down, an OAuth
connection that needs a person again. Every event goes to the same
places: Prometheus counts each type (`promptgate_events_total`), and
[webhooks](/webhooks/) deliver the ones they subscribe to.

```sh
promptgate events          # the catalogue
promptgate events --json
```

Nothing on the request path waits for an event. Each listener has its own
bounded queue. When a queue is full, the event is dropped for that
listener only and counted (`promptgate_events_dropped_total`), so a slow
receiver never slows down a request.

## Payload

Every event has the same shape. This is also the body a webhook
receives:

```json
{
  "type": "budget.exceeded",
  "id": "evt_06gpjgjg3hxrmpmnv7sk4cecfr",
  "timestamp": "2026-10-23T11:00:00Z",
  "data": { "scope": "key", "name": "ci", "field": "daily_usd", "limit": 20, "spent": 20.04, "reset": "2026-10-24T00:00:00+02:00" }
}
```

`id` is unique and sorts by creation time. `timestamp` is UTC.

## Catalogue

Besides the runtime and health events below, every [audit trail](/audit/)
action is an event too: `key.created`, `config.changed`,
`auth.login_failed` and so on, with `seq`, `actor`, `detail` and `ip` in
`data`. `promptgate events` lists all of them.

### Runtime

Runtime events come from requests. Each one is deduplicated, so a
stuck client or a budget that stays exhausted for days can't flood a
receiver.

| event | when | `data` |
|---|---|---|
| `budget.warning` | a request sees a [budget](/budgets/) at 80 % or more. Fires once per scope, name, limit and period. | `scope` (`total`, `key`, `provider`, `endpoint`, `user`), `name` (or `key` and `user` for end users, the user as logged), `field` (`daily_usd`, `daily_tokens`, `monthly_usd`, `monthly_tokens`), `limit`, `spent`, `reset` |
| `budget.exceeded` | a request sees a budget used up. Fires once per scope, name, limit and period. | as `budget.warning` |
| `limit.exceeded` | a [rate limit](/limits/) refused a request. Fires for the first refusal per bucket and minute. | `scope` (`key`, `user`, `endpoint`, `model`, `provider`, `mcp_server`, `mcp_tool`, `api`), `name`; end-user buckets carry only `key`, never the id |
| `guardrail.blocked` | a [guardrail](/guardrails/) blocked a request or an answer, on any surface. Fires for the first block per key, guard and minute. | `guard`, `kind`, `key`, `surface` (`ai`, `mcp`, `api`), `status`, plus `route` and `endpoint`, `server` and `method`, or `api` |

A throttled event that was held back is not lost from view. The next
event for the same key carries `repeated`, the number held back since
the last one was sent.

Budgets are checked when a request starts. A budget that runs out with
the last request of the day therefore fires when the next request sees
it.

### Health

| event | when | `data` |
|---|---|---|
| `anomaly.detected` | an endpoint's error rate, p95 latency or spend leaves its usual range ([anomalies](/anomalies/)) | `endpoint`, `signal`, `value`, `usual`, `threshold`, `requests`, `window` |
| `anomaly.resolved` | the next check no longer finds it | `endpoint`, `signal` |
| `provider.failing` | a provider failed 5 requests in a row: a 5xx answer or unreachable, fallback attempts included. A 429 from the provider and a local refusal don't count, because the provider is up. | `provider`, `failures`, `last_error` |
| `provider.recovered` | a failing provider answered a request again | `provider`, `down_seconds` |
| `mcp.server_down` | a remote [MCP server](/mcp/) can't be reached, or a local server's program failed to start or crashed | `server`, `error` |
| `mcp.server_up` | a server that was down answers again | `server` |
| `oauth.needs_reconnect` | an [OAuth connection](/oauth/) lost its token (the refresh token was refused, or the secret key changed) | `connection`, `reason` |
| `log.dropped` | the request log dropped entries because the writer couldn't keep up. Fires at most every 30 s. | `dropped`, `dropped_total` |

A first connect that succeeds raises no event. Neither does a caller
that gives up while a server is starting, nor a server that wants
credentials it doesn't have yet.

## Secrets

Events never carry keys, tokens or request bodies. Error texts have the
query string and fragment of every URL cut off (`https://host/path?…`),
because that is where tokens tend to travel. End-user ids appear only
in `budget.*`, as the request log stores them. With
[`users.log: hashed`](/users/) that is the hash.

## Filters

Webhooks select events with patterns:

- a type: `mcp.server_down`
- a prefix: `budget.*`
- everything: `*`

A pattern that matches no event type is refused when the config loads.
It is almost always a typo that would silently deliver nothing.
