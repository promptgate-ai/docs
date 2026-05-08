---
title: Secret Scanner
description: Detects AWS / GitHub / Slack / OpenAI / Stripe / JWT / private-key / npm / PyPI credentials in inbound prompts. Block the request or tokenize the secret before it reaches the LLM.
---

The Secret Scanner is the second egress-side guardrail. While [Reversible Redaction](/security/reversible-redaction/) handles personal data your developer wants back in the response, the Secret Scanner handles **credentials** — strings nobody should ever paste anywhere, let alone send to an LLM provider.

## What it catches

18 well-known patterns ship by default:

| Kind | Example shape |
|---|---|
| `aws_access_key` | `AKIA…16chars` / `ASIA…16chars` |
| `gcp_api_key` | `AIza…35chars` |
| `github_pat` | `ghp_…36chars` |
| `github_oauth` / `github_app` / `github_user` / `github_refresh` | `gho_` / `ghs_` / `ghu_` / `ghr_…36chars` |
| `slack_token` | `xoxb-…` / `xoxp-…` / `xoxa-…` / `xoxr-…` / `xoxs-…` |
| `openai_key` | `sk-…20+chars` |
| `anthropic_key` | `sk-ant-…20+chars` |
| `stripe_live` / `stripe_test` | `sk_live_…` / `rk_live_…` / `sk_test_…` / `rk_test_…` |
| `jwt` | three base64url segments separated by dots |
| `private_key` | `-----BEGIN [TYPE] PRIVATE KEY-----` blocks |
| `npm_token` | `npm_…36chars` |
| `pypi_token` | `pypi-…32+chars` |
| `twilio_sid` | `AC…32hex` |
| `sendgrid_key` | `SG.…22.…43` |

## Two modes

| Mode | What happens on a hit |
|---|---|
| **block** *(default)* | Request rejected with HTTP 422 and an error message listing the detected `kind`s — never the matched values themselves. |
| **redact** | The matched substrings are fed into [Reversible Redaction](/security/reversible-redaction/) as custom patterns. The LLM sees `[[AWS_KEY_001]]`; the user gets the secret back. |

Block mode is the default because the scanner exists for *paranoia*: a prod codebase shouldn't have an AWS key in it, and if one is in the prompt it's almost certainly an accident worth surfacing loudly. Redact mode is the right choice for personal-script projects where the developer is consciously asking the LLM about a script that *legitimately* uses a credential.

## Configure

Under **Guardrails → Secret Scanner**:

| Field | Effect |
|---|---|
| **Enabled** | Toggle the policy. |
| **Mode** | `block` or `redact`. |
| **Patterns** | Optional list of pattern keys to enable; default is "all 18". Useful when a project legitimately holds, say, Stripe test keys in its codebase. |

## Why block-mode error messages don't echo the match

A naive implementation would return `"Secret detected: AKIAIOSFODNN7EXAMPLE"` and call it a day. That writes the secret into:

- the HTTP response body the client logs,
- whatever observability you point at PromptGate (Sentry, Datadog, …),
- potentially the agent's history file.

PromptGate returns only the **kind** (`aws_access_key`, `github_pat`, …). The user knows what to remove without anyone re-leaking it.

## Adding your own patterns

For company-specific secrets (internal API tokens that follow your own format), use the **Reversible Redaction**'s `custom_patterns` instead — it's the same regex mechanism with the same tokenize-and-restore semantics. The Secret Scanner's pattern DB is for industry-standard providers; per-tenant patterns live in custom_patterns.

---

> © Akyros Labs LLC. All rights reserved.
