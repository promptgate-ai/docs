---
title: "Rate limits"
description: "PromptGate caps request rates per pg_ key, per end user, per model alias and per provider. A request over a limit gets 429 with a Retry-After header (seconds…"
---

<!-- Generated from docs/limits.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate caps request rates per `pg_` key, per [end user](/users/), per
model alias and per provider. A request over a limit gets **429** with a `Retry-After` header
(seconds until the next request would pass) and an error in the shape your
SDK expects. It is never sent upstream, but it is logged like every other
request.

```yaml
limits:
  keys:
    "*": 60/m                          # every pg_ key: 60 requests per minute
    ci-bot: {requests: 600/m, burst: 50}
  models:
    smart: 100/h                       # alias from `models:`
  providers:
    openai: 50/s                       # all traffic to openai, any caller
  users:
    "*": 30/m                          # every end user, each on their own counter
```

## Rates

A rate is `N/period`: `10/s`, `60/m`, `1000/h`, `5000/d`, or any duration
as the period (`100/10s`). The short form `60/m` is the same as
`{requests: 60/m}`.

`burst` is how many requests may arrive at once after a quiet phase. It
defaults to `N`: `60/m` allows 60 back-to-back requests, then one per
second. Set `burst` lower to smooth traffic — `{requests: 60/m, burst: 5}`
allows five at once, then one per second.

## Scopes

| scope | applies to | notes |
|---|---|---|
| `keys.<name>` | requests with that `pg_` key | names may refer to keys created later; passthrough requests (own provider key) have no `pg_` key and are not key-limited |
| `users.<id>` | requests naming that [end user](/users/) | counted per key and user: the id `42` under two keys is two users; requests without an id, and keys with `users: ignore`, aren't user-limited |
| `endpoints.<name>` | requests to that [AI Gateway endpoint](/endpoints/) | must name an endpoint |
| `models.<alias>` | requests for that [alias](/routing/#model-aliases) | must name an alias in `models:` |
| `providers.<name>` | every request routed to that provider | shared by all callers — protects the provider account's own quota |
| `mcp.<server>`, `mcp.<server>/<tool>` | calls through the [MCP gateway](/mcp/#keys-limits-and-guardrails) to that server or tool | shared by all callers, like providers; `"*"` covers servers only — a tool limit is always named |
| `apis.<api>` | calls through the [API Gateway](/api-gateway/#logs-stats-limits-and-metrics) to that API | shared by all callers: it protects the API and its quota; `"*"` gives every other API its own bucket |

`"*"` sets the limit for every name in a scope without an entry of its own;
each name still gets its own allowance (`keys."*": 60/m` means 60 per minute
*per key*, not 60 shared).

A request is checked against its key, its user, its endpoint, its alias
and its provider, in that order, and must pass all of them. MCP calls
count only against `limits.mcp` — tool, then server — not against the
key's model limits; MCP list requests are cached and not limited. API
Gateway calls count only against `limits.apis`, after the key, method
and path were accepted. If a later check refuses it, the earlier
ones are not charged.

## Behaviour

- Limits are enforced in memory with token buckets; checking one costs
  well under a microsecond (see the benchmark).
- Per-user limits stay as cheap with many users: about 0.1 µs per check
  with 100,000 active users, and about 130 bytes of memory per user who
  sent a request recently. Users whose allowance has refilled completely
  are forgotten.
- Editing `limits:` takes effect on the next request without a restart, and
  allowances already used stay used — a reload doesn't reset anyone.
- Counters live in the process: a restart starts everyone fresh, and
  several PromptGate instances each enforce their own limits. Shared
  counters for multi-node setups are planned.
- A provider's own 429 is passed through unchanged; PromptGate's 429 says
  `rate limit exceeded for key ci-bot (600/m)` so the two are easy to tell
  apart. For a user it says `rate limit exceeded for this user (30/m)`:
  the message is also logged, and it must not reveal ids that
  `users.log: hashed` keeps out of the log.

The first refusal per bucket and minute is published as `limit.exceeded`
([events](/events/)).
