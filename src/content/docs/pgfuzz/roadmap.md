---
title: Roadmap
description: Phase 2 subcommands and distribution improvements for pgfuzz, lined up for post-launch.
---

`pgfuzz` shipped its MVP on 2026-05-22 — `pii` + `secrets` recall tests. Phase 2 fills out the rest of the planned subcommand catalog and the distribution channels. None of it is blocking the PromptGate 1.0 launch.

## Phase 2 subcommands

| Command | What it tests | Mechanism |
|---|---|---|
| **`pgfuzz injection`** | Prompt-injection patterns — DAN, "ignore previous instructions", system-prompt-leak, role-play override | Curated corpus of known jailbreak strings + synth variations |
| **`pgfuzz budget`** | Pre-flight 402 compliance — fires payloads of known cost until the cap, expects 402 at the correct token / dollar boundary | Calibrated payloads + `/admin/tokens` to mint a cap-bounded token |
| **`pgfuzz ratelimit`** | Burst N/min, expect 429 with a correct `Retry-After` header | Time-bucketed firing + header parse |
| **`pgfuzz policy`** | IP allowlist + time-window enforcement | `X-Forwarded-For` spoofing + per-request `--simulate-clock` flag |
| **`pgfuzz auth`** | Token edge cases — revoked / wrong-scope / cross-project / expired / malformed bearer | Mints + revokes via Management API; expects matching 401/403 |
| **`pgfuzz load`** | Burst-load profile — p50/p95/p99/p999 latency, throughput, failure-mode distribution | High-concurrency runner + Hdr histogram |

## Distribution improvements

| Feature | Notes |
|---|---|
| **HTML report** | `--report html` writes a shareable per-run report with sparklines, per-bucket failure examples, and a downloadable JSON sidecar |
| **`--verify-via-logs`** | Reads `gateway_logs` via Management API after each run; verifies mask-mode redactions actually replaced the upstream message. Closes the current "block-mode only" gap |
| **Homebrew tap** | `brew install promptgate-ai/tap/pgfuzz` |
| **GitHub Actions binaries** | Cross-platform releases per tagged version: `darwin-arm64`, `darwin-amd64`, `linux-amd64`, `linux-arm64`, `windows-amd64` |
| **Test plan files** | YAML configs (`pgfuzz run --plan plan.yaml`) so a team can version-control its compliance suite |
| **CI exit codes** | Non-zero exit when any `kind × variant` cell falls below a configurable threshold (`--min-recall 0.95`) |

## Anti-roadmap

Stuff pgfuzz is **not** going to do, despite being adjacent:

- **Bypass discovery / red-team.** That's adversarial pentesting — human work. pgfuzz measures recall against documented guardrail behaviour, not novel exploit chains.
- **Real-credential scanning.** pgfuzz generates *synthetic* secrets that match published formats. It will never read your `~/.aws/credentials` and try to exfiltrate.
- **A daemon / scheduler.** pgfuzz is one-shot CLI. Recurring runs belong in `cron` / GitHub Actions / your CI runner — not in pgfuzz itself.
- **A UI.** Pure CLI + JSON. Reports get rendered by whatever you pipe them into.

## Where the corpus grows

The synth-data generators are the actual asset. Community PRs that add regional formats expand recall coverage at zero marginal cost:

- UK National Insurance numbers (`pii`)
- Japanese phone formats (`pii`)
- South-American CPF / RUT IDs (`pii`)
- DigitalOcean / Cloudflare / Mailgun keys (`secrets`)
- Industry-specific patterns (HIPAA Member ID, IATA codes, …)

When pgfuzz flips public after PromptGate 1.0, the `corpus/` directory is the natural contribution surface. Each kind is a single Go function that returns a synthetic value — adding a new one is ~10 LOC.

---

> © Akyros Labs LLC. All rights reserved.
