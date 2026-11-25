---
title: "pgfuzz — PromptGate Recall Suite"
description: "Companion CLI for PromptGate — AI Gateway Platform. Bombards a live gateway with synthetic adversarial payloads and reports recall / false-positive / latency /…"
---

<!-- Generated from pgfuzz/README.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Companion CLI for **PromptGate — AI Gateway Platform**. Bombards a live gateway with synthetic adversarial payloads and reports recall / false-positive / latency / cost.

```bash
pgfuzz pii --target http://127.0.0.1:7878/v1/chat/completions \
   --token pg_… \
   --count 1000 \
   --types email,iban,credit_card,phone,ssn \
   --report json
```

Targets the PromptGate Go gateway (v0.3+): any `pg_` key, the OpenAI
chat path, and a guardrail in `block` mode (refusals are 422). For the
archived Laravel v1, use `$PG_URL/api/$PG_UUID/v1/chat/completions` and
a `pg_live_…` token.

## Why

Unit tests check logic (does the PII regex match `[email protected]`?). pgfuzz answers a different question: out of 1000 synthetic emails with adversarial wrappings, what's the actual recall rate? That's the question compliance teams care about.

Uses cases:

- **Pre-launch confidence** — verify the guardrails actually catch ≥99% of plausible PII before going live
- **Regression catch** — tweak a regex, re-run, see recall drop instantly
- **Customer-facing trust** — "download pgfuzz, point at your install, get a compliance report"

## Status

Phase 1 ships `pii`, `secrets`, `injection` and `keywords` recall tests, a `negatives` false-positive test, a `users` test of end-user limits and key policies, an `endpoints` test of AI Gateway endpoints, a `ui` test of the web UI's security, an `mcp` test of the MCP gateway and an `api` test of the API Gateway. Other categories (`budget`, `ratelimit`, `policy`, `load`) are on the backlog. The PromptGate repository runs a plan of all eight against every build (`scripts/pgfuzz-gate.sh`).

## Honest caveats

- Not a "pentest" in the formal sense — it's recall / fuzz testing. Real adversarial pentesting is human work.
- Synthetic data ≠ production data. Recall on a synth corpus is a *lower bound*; real-world might be worse.
- Recall alone rewards blocking everything. Run `negatives` next to every recall test: it shows what a guardrail gets wrong.
- The tool **consumes real budget** on your gateway. Run against a test project or accept the cost.

## Subcommands

| Command | What it tests | Status |
|---|---|---|
| `pgfuzz pii` | PII Filter recall — emails / IBANs / CCs / phones / SSNs in clean + adversarial wrappings | ✅ MVP |
| `pgfuzz secrets` | Secret Scanner recall — AWS / GitHub / Slack / OpenAI / Anthropic / Stripe / JWT (JWTs are well-formed: base64url JSON header and payload) | ✅ |
| `pgfuzz injection` | Prompt injection patterns — ignore-previous / role-assumption / disregard / override / system-prompt-leak / chat-template smuggling / instruction-bypass, in English and German, with direct / wrapped / obfuscated variants | ✅ |
| `pgfuzz keywords` | Keyword list recall — words drawn from `--list`, the file the gateway's `keywords` guardrail reads (`lists: [{file: …}]`), written inline, in other case, with punctuation and at the edge of the message; plan stages take `list:` | ✅ |
| `pgfuzz negatives` | False-positive rate — benign payloads that look like PII, secrets or injection (order numbers, placeholder keys, "ignore the warnings", "write a system prompt"), plus code and prose, in English and German; a 422 or 403 counts as a false positive. `--min-pass-rate 1` fails on any | ✅ |
| `pgfuzz endpoints` | AI Gateway endpoints with known definitions (`--print-config`): `--expect variables` (wrong types, ranges, lengths, patterns, lookalike characters, unknown names: 400; valid and boundary values: 200), `schema` (answers breaking the output schema never pass: 502), `sessions` (other users, another key `--token2`, forged and broken ids: 404), `cache` (a hit for the same key, never for another). `--min-rate 1` fails on any deviation | ✅ |
| `pgfuzz ui` | The gateway's web UI, probed like an attacker would: `--expect access` (no page or action without a session, also with forged cookies), `forms` (no change without the session's CSRF token or from another site), `login` (guessing throttled to 429, unknown names indistinguishable, no session fixation, no open redirect, HttpOnly + SameSite=Strict cookie), `headers` (strict CSP, framing and sniffing blocked, no traversal on /static), `reflect` (markup in query parameters never comes back unescaped), `all` | ✅ |
| `pgfuzz users` | End users named in `X-PromptGate-User`: `--expect isolated` (each user has their own `--per-user` limit: within it 200, one more 429, users not seen yet still 200), `required` (no id: 400), `ignored` (ids from an end-user-held key are never limited). Ids are unique per run; `--min-rate 1` fails on any deviation | ✅ |
| `pgfuzz mcp` | PromptGate's MCP gateway, with `pgfuzz mcp-echo` behind it: `--expect access` (no valid key 401, no GET stream 405, foreign origins 403), `names` (a key limited to one tool lists and reaches only it — other tools in any spelling, a header naming another tool, forged cursors, PromptGate's own tools: never), `protocol` (header/body mismatch -32020, unknown versions -32022, parse and structure errors, sessions bound to their key and ended by DELETE, batches only in 2025-03-26), `arguments` (secrets in tool arguments never reach the server — recall), `results` (injections a server returns never reach the agent — recall), `size` (an oversized result is an error, the gateway goes on), `all` | ✅ |
| `pgfuzz run --plan` | Execute a multi-stage YAML test plan — what teams version-control as their compliance suite | ✅ |
| `pgfuzz budget` | Pre-flight 402 compliance | 📋 |
| `pgfuzz ratelimit` | 429 + Retry-After behaviour | 📋 |
| `pgfuzz policy` | IP allowlist + time-window enforcement | 📋 |
| `pgfuzz auth` | Revoked / wrong-scope / expired token edge cases | 📋 |
| `pgfuzz api` | PromptGate's API Gateway, with `pgfuzz api-echo` behind the APIs `--print-config` defines: `--expect access` (no valid key 401, APIs outside a key's list 403, unknown names reach nothing, methods 405), `headers` (the caller's pg_ key as Bearer or X-Api-Key, cookies, proxy credentials, spoofed X-Forwarded-*/Forwarded/X-Real-Ip, the user id header and hop-by-hop headers never reach the API; the API's own credential does; Set-Cookie, WWW-Authenticate, HSTS don't come back), `paths` (no path climbs out of the base in any encoding — %2e, %2f, %5c, `..;`, overlong UTF-8, double encoding), `ssrf` (loopback without `private: true` and the metadata address refused, redirects not followed), `size` (body caps both ways), `requests` (secrets in request bodies never reach the API — recall), `answers` (injections in answers never reach the caller — recall), `all` | ✅ |
| `pgfuzz load` | Burst load + p50/p95/p99 | 📋 |

## MCP gateway

```bash
pgfuzz mcp-echo --addr 127.0.0.1:19595 &
# Gateway: mcp.servers.pgfuzz.url: http://127.0.0.1:19595/mcp
#          guardrails: secrets {action: block}, prompt_injection {roles: [user, tool]}
#          a second key: promptgate keys create narrow --mcp pgfuzz/echo
pgfuzz mcp --target http://127.0.0.1:7878/mcp --token pg_… --token2 pg_narrow… \
  --expect all --count 300 --min-rate 0.99
```

The echo server answers with what its tools are given — `echo` returns
its text, `echo64` its base64 data decoded (a result the arguments don't
show), `big` a text of the requested size — so the probe decides what the
gateway sees in arguments and in results.

## API Gateway

```bash
pgfuzz api-echo --addr 127.0.0.1:19696 &
pgfuzz api --print-config 127.0.0.1:19696   # the gateway's apis: entries
# Gateway: guardrails: secrets {action: block}, prompt_injection {roles: [user, tool]}
#          a second key: promptgate keys create narrow --api pgfuzz
pgfuzz api --target http://127.0.0.1:7878/api --token pg_… --token2 pg_narrow… \
  --expect all --count 300 --min-rate 0.99
```

The echo API answers with what it received — method, path as sent and
decoded, query, headers, body — so the probe sees exactly what reached
it; on request it sets cookies, redirects to the metadata address,
answers with N bytes or with base64-decoded text (an answer the request
doesn't show).

## End users

```bash
# Gateway: limits.users "*": 3/h — every user may send 3 requests per hour.
pgfuzz users --target $PG_URL/v1/chat/completions --token $PG_KEY \
   --expect isolated --users 20 --per-user 3 --min-rate 1
```

```text
CHECK         EXPECT   TOTAL  AS EXPECTED  OTHER   ERRORS  RATE
other_users   200      20     20           0       0       100.0%
over_limit    429      20     20           0       0       100.0%
within_limit  200      60     60           0       0       100.0%
```

A gateway that counts all users against one allowance fails `within_limit`
and `other_users`. In a plan, `kind: users` takes `expect`, `users`,
`per_user` and `user_header`; `count` is not used.

## Endpoints

```bash
# Add the probed endpoints to the gateway (endpoints: section or files).
pgfuzz endpoints --print-config --model openai:gpt-4o-mini
pgfuzz endpoints --target $PG_URL/v1/chat/completions --token $PG_KEY \
   --token2 $PG_OTHER_KEY --expect sessions --rounds 10 --min-rate 1
```

A gateway that lets another user or key continue a session fails
`session_other_user` / `session_other_key`; one whose cache answers
across keys fails `cache_other_key`. In a plan, `kind: endpoints` takes
`expect`, `rounds`, `token2` and `mount`. Reports never contain keys.

## Web UI

```bash
pgfuzz ui --target http://127.0.0.1:7879 --user admin \
   --password "$(cat ui-initial-password)" --expect all --min-rate 1
```

`forms`, `reflect` and `login` sign in; a first admin who must choose a
password gets a random one, so run it against a test instance. `login`
runs last — it locks a made-up name out on purpose. In a plan, `kind: ui`
takes `target` (the UI's base URL), `user`, `password` and `expect`.
Reports never contain the password.

## CI integration

`--min-recall` makes every subcommand CI-friendly — non-zero exit when any cell or overall recall falls below the threshold:

```bash
pgfuzz pii \
   --target $PG_URL/v1/chat/completions \
   --token $PG_TOKEN \
   --count 500 \
   --min-recall 0.95 \
   --output report.json
```

For multi-stage gates, write a plan YAML once and call `pgfuzz run`:

```bash
pgfuzz run --plan compliance.yaml --output report.json
```

See `examples/plan.yaml` for the full plan format (defaults, env-var expansion, per-stage `min_recall`).

## Build

```bash
go build ./cmd/pgfuzz
./pgfuzz --help
./pgfuzz --version
```

Pre-built binaries land on the GitHub release page on tag (darwin arm64+amd64, linux amd64+arm64, windows amd64).

## License

Apache License 2.0 — see `LICENSE`.

PromptGate itself (the gateway) is BSL 1.1 — a separate license decision. pgfuzz uses Apache-2.0 because compliance-verification tooling only earns its trust through enterprise auditability and community-contributed corpora, both of which need a permissive license.

---

**Akyros Labs LLC** — hello@akyroslabs.com
