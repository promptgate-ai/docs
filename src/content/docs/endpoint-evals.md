---
title: "Evals and replay"
description: "Part of AI Gateway endpoints. Both run requests through the gateway's current config inside the CLI — real providers, the full pipeline, no running gateway…"
---

<!-- Generated from docs/endpoint-evals.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Part of [AI Gateway endpoints](/endpoints/). Both run requests through
the gateway's current config inside the CLI — real providers, the full
pipeline, no running gateway needed — and are not logged as traffic.
The CLI uses a temporary `pg_` key of its own, so the config needs
server-side provider keys; with passthrough only, pass a provider key
with `--provider-key`.

## Evals

`evals/<endpoint>.yaml` next to the config holds test cases for an
endpoint (or pass `--file`):

```yaml
cases:
  - name: summarises a login problem
    variables: { priority: high, body: "Login fails since the update" }
    expect:
      contains: [login]              # case-insensitive
      not_contains: ["I'm sorry"]
      matches: '"priority":\s*"high"' # regular expression (RE2)
      max_latency: 5s
      max_output_tokens: 400
  - name: rejects unknown variables
    variables: { colour: red }
    expect: { status: 400, contains: ["not a variable"] }
```

Endpoints without variables take `messages` instead. `status` defaults
to 200; an endpoint's [output schema](/endpoints/#schemas) is checked
by the gateway itself, so a case whose answer breaks it fails with
status 502.

```
$ promptgate eval summarize-ticket
PASS  summarises a login problem  812ms  412→96 tok
FAIL  rejects unknown variables   0.3ms  0→0 tok  status 200, want 400: …

1/2 passed (50 %)
promptgate: pass rate 50 % is below --min-pass 100 %
```

The exit code is 1 when fewer than `--min-pass` (0–1, default 1) of
the cases pass, so `promptgate eval` can gate a CI pipeline before a
prompt change ships. `--json` prints every result with answer, status,
tokens and latency.

## Replay

`promptgate replay <id>` sends a logged request again and prints the new
answer next to the original numbers; `--model` sends it to another model
(an alias or `provider:model`) to compare. It needs `logging.bodies:
true`: the log then keeps each request as the provider got it — after
guardrails, so masked values stay masked — and its answer, up to 1 MB
each. The id is the first column of `promptgate logs`.
