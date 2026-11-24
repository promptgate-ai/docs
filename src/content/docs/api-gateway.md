---
title: "API Gateway"
description: "Agents and apps call more than models and MCP servers: plain HTTP APIs — GitHub, Jira, an internal service. The API Gateway puts those calls behind the same…"
---

<!-- Generated from docs/api-gateway.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Agents and apps call more than models and MCP servers: plain HTTP APIs —
GitHub, Jira, an internal service. The API Gateway puts those calls
behind the same `pg_` keys: one route per API, the real credential lives
only in PromptGate, and every call is logged and rate-limited like model
traffic.

```
client ──▶ PromptGate /api/github/repos/acme/app ──▶ https://api.github.com/repos/acme/app
           (pg_ key)                                  (Authorization from PromptGate)
```

## Calling an API

```sh
promptgate keys create ci            # the API Gateway accepts only pg_ keys
curl -H "Authorization: Bearer pg_…" http://127.0.0.1:7878/api/github/repos/acme/app/issues?state=open
```

`/api/github/repos/acme/app/issues?state=open` goes to
`https://api.github.com/repos/acme/app/issues?state=open`: the path below
the API's name is joined to its `url`, the query string is kept. The key
may also come as `X-Api-Key` or `Api-Key`; it never reaches the API.

- **Paths:** encoded slashes stay encoded (`group%2Fproject` for
  GitLab), but no segment may climb above the base path — `..`,
  `%2e%2e`, `.%2E`, `..%2f`, `..\`, `..;` (path parameters, which
  servlet containers strip) and NUL bytes answer 400.
- **Bodies** stream in both directions; event streams
  (`text/event-stream`) and answers of unknown length are flushed as
  they arrive. A request body over `max_request_bytes` answers 413; an
  answer over `max_response_bytes` answers 502 when its length is known
  and is cut off when it isn't.
- **Answers** of the API pass through unchanged — status, body and
  headers — except hop-by-hop headers and those that would act on
  PromptGate's own origin or confuse the caller about its key:
  `Set-Cookie`, `Strict-Transport-Security`, `Public-Key-Pins`,
  `Alt-Svc`, `WWW-Authenticate`. Redirects are passed back, never
  followed.
- **Retries** (`retries: n`) repeat `GET`, `HEAD`, `OPTIONS`, `PUT` and
  `DELETE` after a connection error or a 502, 503 or 504, with a short
  pause; the body is read once and sent again. `POST` and `PATCH` are
  never repeated. A refused destination or a timeout of the whole call
  isn't either.
- Every answer carries `X-PromptGate-Request-Id` (`req_…`), also
  available to the API as `{{ request_id }}`.

PromptGate's own errors use one shape, so they can't be mistaken for the
API's:

```json
{"error": {"type": "forbidden", "message": "key \"ci\" may not call API \"billing\""}}
```

| Status | `type` | When |
|---|---|---|
| 401 | `unauthorized` | no or unknown `pg_` key |
| 403 | `forbidden` | the key's `apis` list doesn't name the API |
| 404 | `not_found` | unknown or disabled API |
| 405 | `method_not_allowed` | method not in `methods` (with `Allow`) |
| 400 | `bad_request` | path escapes the base, invalid user id |
| 413 | `request_too_large` | body over `max_request_bytes` |
| 422 / 403 / 415 | `guardrail_blocked` | a [guardrail](#guardrails) refused the request, or can't read it |
| 429 | `rate_limited` | over `limits.apis` (with `Retry-After`) |
| 502 | `oauth_unavailable` | the API's OAuth connection has no token (not connected, needs a reconnect) |
| 502 | `destination_blocked` | the [SSRF check](#ssrf-protection) refused the address |
| 502 | `upstream_unreachable` / `response_too_large` / `guardrail_blocked` | no connection / answer over the cap / answer withheld |
| 504 | `upstream_timeout` | no complete answer within `timeout` |

## Guardrails

API calls run through the same [guardrails](/guardrails/) as model and
MCP traffic: the global rules, overridden by `guardrails.apis.<api>`,
then by the key's. What the caller sends counts as content of role
`assistant` (an agent wrote it, like MCP tool arguments), what the API
answers as role `tool` — prompt injection reads answers only with
`roles: [user, tool]`.

```yaml
guardrails:
  secrets: { action: block }            # every API call's request body too
  apis:
    github:
      prompt_injection: { roles: [user, tool] }   # issue texts written by strangers
      pii: { action: redact }           # the API sees [[EMAIL_001]], the caller its address
```

- **Which bodies:** JSON (every string value), text (`text/*`, XML,
  form data, NDJSON, GraphQL; a body without `Content-Type` when it is
  UTF-8). Binary bodies (`application/octet-stream`, images, …) and
  event streams pass without content inspection; `ip_allowlist` and
  `time_window` apply to every call.
- **Requests** are read whole when a content guard applies. A block
  answers 422 (`guardrail_blocked`, or the guard's own status:
  `ip_allowlist` and `time_window` answer 403); a compressed text body
  answers 415 — it can't be read, so it isn't passed blind.
- **Answers** are read whole when a content guard applies or the
  request had redactions: PromptGate asks the API for
  `Accept-Encoding: identity`, masks what the guards mask, puts
  redacted values back and sends the result with its new
  `Content-Length`. A blocked answer is withheld with 502
  (`guardrail_blocked` — the caller did nothing wrong); a compressed
  text answer the guards can't read is withheld too.
- Findings go to the log row's guard column, like everywhere else.

## Logs, stats, limits and metrics

Every request is one row in the request log — refused ones too — with
surface `api`: the API as provider, the method as model, the path below
the API as route (never the query string, which may carry tokens), key,
[end user](/users/), status, bytes, time to the API's headers and
duration. A request for an API that doesn't exist is logged without an
API, so made-up names never become metric labels.

```sh
promptgate logs --surface api
promptgate stats --by api            # or --by method, --surface api --by key
```

API rows stay out of model stats, cost, budgets and anomalies; their
per-minute totals have their own table. Rate limits protect the API and
its quota, shared by every key:

```yaml
limits:
  apis: { github: 300/m, "*": 60/m }   # 429 with Retry-After
```

Prometheus: `promptgate_api_requests_total{api,method,key,status}`,
`promptgate_api_request_duration_seconds{api}` and
`promptgate_ssrf_blocked_total{surface}` — see [metrics](/metrics/).

## Tested against

Every build runs pgfuzz's `api` probe against the API Gateway
(`scripts/pgfuzz-gate.sh`, seven stages): access and allowlists, the
caller's credentials and spoofed forwarding headers never reaching an
API, path traversal in every encoding (including `..;`, which servlet
containers read as `..`), the SSRF check and redirects, body caps, and
the guardrails' recall on request bodies and answers. Overhead: a plain
call costs about 0.25 ms at the median over calling the API directly —
see the benchmark.

## Configuration

```yaml
surfaces:
  api_gateway: { mount: /api }           # default
apis:
  github:
    url: https://api.github.com          # base; the path below /api/github is joined to it
    methods: [GET, POST, PATCH]          # default: GET HEAD POST PUT PATCH DELETE OPTIONS
    headers:
      forward: [accept, content-type, x-github-api-version]   # allowlist; default: all but blocked
      block: [x-debug]
      set:
        Authorization: "Bearer ${GITHUB_TOKEN}"
        X-Caller: "{{ key }}"
    timeout: 30s                         # whole call; default 30s
    max_request_bytes: 10485760          # default 10 MiB
    max_response_bytes: 104857600        # default 100 MiB
    query: keep                          # keep | drop the caller's query string
    retries: 0                           # 0–5; idempotent methods only
  inventory:
    url: http://10.0.4.12:8080/v1
    private: true                        # an internal service: skip the SSRF check
keys:
  - name: ci
    apis: [github]                       # empty: every API
```

| Field | Default | Meaning |
|---|---|---|
| `url` | the preset's API with `oauth` | absolute `http(s)` base URL, without query, fragment or credentials |
| `oauth` | — | an [OAuth connection](/oauth/#using-a-connection) whose token goes as `Authorization`; not together with an `Authorization` header in `set` |
| `methods` | all seven | allowed methods; others answer 405 |
| `headers.forward` | all | caller headers passed on; `Content-Type` and `Content-Encoding` always are. Never: the caller's credentials (`Authorization`, `X-Api-Key`, `Api-Key`, `Cookie`), `Host`, `Proxy-*`, `X-Forwarded-*`, `Forwarded`, `X-Real-Ip`, `X-PromptGate-*`, the user id header and hop-by-hop headers |
| `headers.block` | — | caller headers dropped |
| `headers.set` | — | headers added or overridden; `${ENV}` and the placeholders `{{ key }}` (key name), `{{ user }}` (the [end user](/users/) as the log keeps it: the id, or its hash with `users.log: hashed`) and `{{ request_id }}`; never logged or shown |
| `timeout` | `30s` | one call up to the end of the response |
| `max_request_bytes` / `max_response_bytes` | 10 MiB / 100 MiB | body caps in both directions |
| `query` | `keep` | `drop` sends no query string upstream |
| `retries` | `0` | repeats `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE` after a connection error, 502, 503 or 504 |
| `private` | `false` | allow a private, loopback or link-local destination |
| `forwarded` | `false` | add `X-Forwarded-For` (the caller, behind `server.trusted_proxies` too) and `X-Forwarded-Proto` |
| `disabled` | `false` | keep the entry, answer 404 |

Without a `User-Agent` from the caller none is sent. Names are lowercase
letters, digits and `-` (max 32). `apis` reload live; a changed mount
needs a restart. Header values are
checked on load: control characters (CR, LF) and unknown placeholders
are refused, and so are headers the gateway sets itself (`Host`,
`Content-Length`, `Transfer-Encoding`, `Connection`, …).

## SSRF protection

An API Gateway that forwards to configured URLs must not become a door
into the network it runs in. Every outbound connection of the API
Gateway — and of OAuth token requests — is checked **when it is
dialled**, on the address actually connected to: after DNS, for every
connection, so a name that resolves to a public address first and to
`127.0.0.1` a moment later (DNS rebinding) is still refused.

Refused destinations:

- loopback (`127.0.0.0/8`, `::1`), unspecified (`0.0.0.0/8`, `::`)
- private (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`)
- link-local, including the cloud metadata services (`169.254/16`,
  `169.254.169.254`, `fe80::/10`, `fd00:ec2::254`)
- shared CGNAT space (`100.64/10`), multicast, broadcast, reserved,
  documentation and benchmarking ranges
- IPv4 written as IPv6 — mapped (`::ffff:127.0.0.1`), NAT64
  (`64:ff9b::7f00:1`), 6to4 (`2002:7f00:1::`) — is judged by its IPv4
  address

Exceptions:

```yaml
security:
  ssrf:
    allow: [10.0.5.0/24, 192.168.1.10, intranet.example.com]  # IPs, CIDRs, exact host names
    mcp: false            # true: check remote MCP servers too (off: they often run on localhost)
```

An API with `private: true` skips the check entirely. It can be set in
the YAML and in the web UI, but never through PromptGate's own MCP
write tools: an agent can't open a path into the internal network.

When an HTTP proxy from the environment (`HTTPS_PROXY`) is used, the
connection goes to the proxy, so the target's addresses are checked
before the request instead; the proxy resolves the name again, which
leaves a small rebinding window. Use `NO_PROXY` or no proxy where that
matters.

Redirects are never followed: a 3xx answer goes back to the caller as
it is.
