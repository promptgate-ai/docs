---
title: pgfuzz secrets
description: Secret Scanner recall test — fires synthetic AWS / GitHub / Slack / OpenAI / Anthropic / Stripe / JWT keys at the gateway and reports the catch rate.
---

`pgfuzz secrets` is the secret-scanner sibling of [`pgfuzz pii`](/pgfuzz/pii/). Same statistical question, different corpus: *"of 100 plausible-looking AWS access keys embedded in code-snippet payloads, how many does my live [Secret Scanner guardrail](/security/secret-scanner/) catch?"*

## Quick start

```bash
pgfuzz secrets \
   --target https://gateway.your-domain.com/api/$PG_UUID/v1/chat/completions \
   --token pg_live_… \
   --count 200
```

The Secret Scanner guardrail must be **enabled** and in **`block` mode**.

## Flags

| Flag | Default | Notes |
|---|---|---|
| `--target` | *(required)* | Full chat-completions URL of the gateway |
| `--token` | *(required)* | Bearer token (`pg_live_…`) — must have the `chat` scope |
| `--model` | `openai:gpt-4o-mini` | Model identifier the gateway should route to |
| `--count` | `100` | Total synthetic payloads to fire, distributed across `kinds` |
| `--kinds` | `aws,github,slack,openai,anthropic,stripe,jwt` | Secret kinds to generate |
| `--concurrency` | `16` | Parallel HTTP workers |
| `--timeout` | `30` | Per-request timeout (seconds) |
| `--report` | `tty` | Output format: `tty` (table) or `json` |

## Kinds

Each generator emits a **syntactically-valid but locally-generated** string — matches the published prefix / format, never deployed anywhere real. PromptGate's scanner matches on shape, so synth strings trip it identically to real credentials.

| Kind | Prefix | Length / shape |
|---|---|---|
| `aws` | `AKIA` | + 16 chars `[A-Z2-7]` |
| `github` | `ghp_` | + 36 chars alphanumeric |
| `slack` | `xoxb-` | + 11 digits + `-` + 11 digits + `-` + 24 alphanumeric |
| `openai` | `sk-` | + 48 alphanumeric |
| `anthropic` | `sk-ant-api03-` | + 95 chars (alphanumeric + `_-`) |
| `stripe` | `sk_live_` | + 24 alphanumeric |
| `jwt` | *(no prefix)* | 3 base64url-ish segments separated by `.` |

## Carrier templates

The raw secret is wrapped in plausible code-snippet payloads — the way an LLM agent typically leaks one:

```
Here's the snippet I'm working with — please refactor it:
```const key = "AKIAIOSFODNN7EXAMPLE";```
```

```
Why is my script failing? I set the env var like this:
export AWS_KEY="AKIAIOSFODNN7EXAMPLE"
```

```
The README says to put this in config.json:
{ "token": "AKIAIOSFODNN7EXAMPLE" }
```

Each template variant is chosen at random per sample.

## Verdict

Same semantics as `pgfuzz pii`:

| Outcome | Condition |
|---|---|
| `caught` | HTTP 422 + body mentions a secret kind (`AWS`, `GitHub`, `Slack`, `OpenAI`, …) or `secret` / `blocked` / `redact` |
| `missed` | HTTP 2xx |
| `error` | Anything else — excluded from recall |

## Output

### TTY

```
pgfuzz — recall report
  target:   https://gateway.your-domain.com/api/.../v1/chat/completions
  total:    210
  duration: 2.9s
  p50/p95:  58ms / 142ms

KIND       VARIANT  TOTAL  CAUGHT  MISSED  ERRORS  RECALL
----       -------  -----  ------  ------  ------  ------
anthropic  inline   30     30      0       0       100.0%
aws        inline   30     30      0       0       100.0%
github     inline   30     30      0       0       100.0%
jwt        inline   30     27      3       0       90.0%
openai     inline   30     30      0       0       100.0%
slack      inline   30     30      0       0       100.0%
stripe     inline   30     30      0       0       100.0%
----       -------  -----  ------  ------  ------  ------
ALL        (all)    210    207     3       0       98.6%
```

### JSON

Same payload shape as `pgfuzz pii` — full `Summary` with `run`, `cells[]`, `overall`.

## Examples

### Verify all kinds before a release

```bash
pgfuzz secrets --target $URL --token $TOKEN --count 350
# expect recall ≥ 95% per kind
```

### Catch a regression after a scanner-pattern change

```bash
pgfuzz secrets --target $URL --token $TOKEN --count 1000 \
   --kinds aws,github,openai --report json \
   | jq '.cells[] | select(.recall < 0.99)'
```

### Per-kind deep dive

```bash
pgfuzz secrets --target $URL --token $TOKEN --count 200 \
   --kinds jwt --concurrency 8
```

JWTs are the most format-flexible kind (any base64-ish 3-segment value matches). Use this to tune your false-positive vs recall tradeoff.

---

Next: **[Roadmap — Phase 2 subcommands](/pgfuzz/roadmap/)**.

---

> © Akyros Labs LLC. All rights reserved.
