---
title: pgfuzz — Recall / Fuzz Suite
description: Companion CLI that bombards a live PromptGate gateway with synthetic adversarial payloads and reports recall / false-positive / latency.
---

**pgfuzz** is a companion Go CLI that runs **outside** PromptGate. It points at a live gateway, fires N synthetic adversarial payloads at it, and reports how many were caught by the gateway's guardrails.

```bash
pgfuzz pii \
   --target https://gateway.your-domain.com/api/$PG_UUID/v1/chat/completions \
   --token pg_live_… \
   --count 1000 \
   --kinds email,iban,credit_card \
   --variants inline,wrapped
```

## Why it exists

PromptGate ships with a 574-test Pest suite that verifies guardrail **logic** — "given input X, does the PII regex match?" That's a different question from the one compliance teams actually ask:

> Out of 1000 plausible-looking emails with adversarial wrappings, what fraction does the live PII Filter actually catch?

That's a **statistical** question. Answering it needs synthetic data, parallel HTTP fire, aggregate counting. That's pgfuzz.

Uses cases:

- **Pre-launch confidence** — verify guardrails catch ≥99% of plausible PII before going live
- **Regression catch** — tweak a PII regex, re-run, see recall drop instantly. Pest can't catch this
- **Customer-facing trust** — "here's pgfuzz, point it at your install, get a compliance report"

## Status

| | |
|---|---|
| **Repo** | `promptgate-ai/pgfuzz` |
| **License** | Apache-2.0 |
| **Visibility** | Private until PromptGate 1.0 ships. Binaries available on request for pilot customers |
| **MVP shipped** | 2026-05-22 — `pgfuzz pii` + `pgfuzz secrets` |

When PromptGate 1.0 lands publicly, pgfuzz flips public and ships pre-built binaries via GitHub Releases (and likely a Homebrew tap).

## Honest caveats

- **Not a pentest.** This is *recall / fuzz testing* against synthetic data. Real adversarial pentesting is human work — pgfuzz won't replace a security engineer.
- **Synthetic ≠ production.** Recall on a synth corpus is a **lower bound**. Real-world adversarial input can break the filter in ways generated data never will.
- **Consumes real budget.** Every payload pgfuzz sends is a real chat-completion. Run against a test project, or budget for the spend.

## How it works

```
┌──────────┐    parallel HTTP    ┌─────────────┐
│  pgfuzz  │ ──────────────────> │  PromptGate │
│          │                     │   gateway   │
│ corpus   │                     │             │
│ runner   │ <────── 422 / 2xx ──│ guardrails  │
│ verdict  │                     │             │
│ report   │                     │             │
└──────────┘                     └─────────────┘
     │
     v
  TTY + JSON
```

1. **Corpus** — generators per `kind` (email, iban, credit_card, phone, ssn / aws, github, …) emit synthetic values. PII corpus has carrier-text variants (inline / wrapped / obfuscated).
2. **Runner** — worker-pool HTTP firing with configurable concurrency. Deterministic result ordering so the aggregator can bucket by `kind × variant` cleanly.
3. **Verdict** — classifies each response: `422 + matching-kind body = caught`, `2xx = missed`, everything else = `error` (excluded from recall %).
4. **Report** — per-bucket + overall summary in TTY (tabwriter) or JSON. p50/p95 latency, total duration, recall percentage.

## Subcommands

| Command | What it tests | Status |
|---|---|---|
| [`pgfuzz pii`](/pgfuzz/pii/) | PII Filter recall | ✅ MVP |
| [`pgfuzz secrets`](/pgfuzz/secrets/) | Secret Scanner recall | ✅ MVP |
| [`pgfuzz injection`](/pgfuzz/injection/) | Prompt-injection patterns (7 categories × direct/wrapped/obfuscated variants) | ✅ |
| `pgfuzz budget` | Pre-flight 402 compliance | 📋 |
| `pgfuzz ratelimit` | 429 + Retry-After behaviour | 📋 |
| `pgfuzz policy` | IP allowlist + time-window enforcement | 📋 |
| `pgfuzz auth` | Token edge cases (revoked / wrong-scope / expired) | 📋 |
| `pgfuzz load` | Burst load + p50/p95/p99 latency | 📋 |

See the [Roadmap](/pgfuzz/roadmap/) for the full Phase 2 backlog.

---

Next: **[pgfuzz pii — PII Filter recall test](/pgfuzz/pii/)**.

---

> © Akyros Labs LLC. All rights reserved.
