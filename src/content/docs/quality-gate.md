---
title: "Quality gate"
description: "Every build runs scripts/pgfuzz-gate.sh: it builds the binary and a mock provider, starts the gateway with secrets, pii and prompt_injection in block mode, a…"
---

<!-- Generated from docs/quality-gate.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Every build runs `scripts/pgfuzz-gate.sh`: it builds the binary and a
mock provider, starts the gateway with `secrets`, `pii` and
`prompt_injection` in block mode, a 10,000-entry `keywords` list for
one key, a per-user rate limit, the endpoints pgfuzz probes, an MCP server and an
API (pgfuzz's own echo servers) and the [web UI](/ui/), and runs
[pgfuzz](https://docs.promptgate.dev/pgfuzz/) with
`scripts/pgfuzz/gate.yaml` — 26 stages:

| stage | payloads | must reach |
|---|---|---|
| secrets | 1,400 synthetic keys of seven providers in code | 99% caught |
| pii | 2,500 e-mails, IBANs, cards, phones, SSNs — inline and in Markdown/code | 99% caught |
| injection | 2,100 attacks of seven kinds, English and German — plain, in a sentence, with zero-width characters | 99% caught |
| keywords | 2,000 prompts with entries of a 10,000-entry [list file](/guard-lists/) — inline, other case, with punctuation, on a line of their own | 100% caught |
| negatives | every benign payload: order numbers, placeholder keys, "ignore the warnings", code, prose | 100% passed |
| users-isolated | 20 [end users](/users/) at a per-user limit of 3: within it, one over, then users not seen yet | 100% as expected |
| users-required | a key with `users: required`, with and without an id | 100% as expected |
| users-ignored | a key with `users: ignore`, one id past the limit | 100% as expected |
| endpoints-variables | [endpoint](/endpoints/) variables: wrong types, ranges, lengths, patterns, lookalike characters, unknown names, malformed bodies (400) and valid boundaries (200) | 100% as expected |
| endpoints-schema | answers that break the endpoint's output schema (502, never 200) | 100% as expected |
| endpoints-sessions | [sessions](/endpoint-sessions/) continued by their owner (200), another user, another key, forged and broken ids (404) | 100% as expected |
| endpoints-cache | the [cache](/endpoints/#cache): a hit for the same key, a miss for another | 100% as expected |
| mcp-access | the [MCP gateway](/mcp/): no valid key 401, no GET stream 405, foreign origins 403 | 100% as expected |
| mcp-names | a key limited to one tool lists and reaches only it — other tools in any spelling, forged cursors, PromptGate's own tools: never | 100% as expected |
| mcp-protocol | header/body mismatches, unknown protocol versions, parse and structure errors, sessions bound to their key | 100% as expected |
| mcp-size | an oversized tool result is an error, the gateway goes on | 100% as expected |
| mcp-arguments | 700 secrets in tool arguments never reach the server | 99% caught |
| mcp-results | 700 injections in tool results never reach the agent | 99% caught |
| api-access | the [API Gateway](/api-gateway/): no valid key 401, APIs outside a key's list 403, unknown names, wrong methods | 100% as expected |
| api-headers | the caller's `pg_` key, cookies, spoofed forwarding headers and the user id header never reach the API | 100% as expected |
| api-paths | no path climbs out of the API's base, in any encoding (`%2e`, `%2f`, `..;`, overlong UTF-8, double encoding) | 100% as expected |
| api-ssrf | loopback without `private: true` and the cloud metadata address refused, redirects not followed | 100% as expected |
| api-size | body caps in both directions | 100% as expected |
| api-requests | 700 secrets in request bodies never reach the API | 99% caught |
| api-answers | 700 injections in answers never reach the caller | 99% caught |
| ui | the [web UI](/ui/), as an attacker would try it: every page and action without a session or with forged cookies, forms without or with a wrong CSRF token and from another site, password guessing (429), unknown names vs wrong passwords, session fixation, open redirects, cookie flags, security headers, path traversal, markup in query parameters — 232 checks | 100% held |

Today every stage is at 100%. Run it locally with a checkout of pgfuzz
next to this repository:

```bash
PGFUZZ_DIR=../pgfuzz scripts/pgfuzz-gate.sh   # report: pgfuzz-report.json
```
