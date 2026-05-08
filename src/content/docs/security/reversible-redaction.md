---
title: Reversible Redaction
description: Tokenize sensitive data before it reaches the LLM and substitute the real values back in the response. The LLM never sees your customer's email; your developer does.
---

Reversible Redaction is the **headline guardrail for the Agent Proxy use case**. It solves the gap traditional PII masking leaves: if you mask `john@acme.com` to `[REDACTED]` in the prompt, the LLM responds about `[REDACTED]` and your user sees a useless answer. With reversible redaction, the LLM sees an opaque token; your user sees their original data back; nobody loses utility, and the LLM provider never had the real value.

## How it works

1. **Inbound (before the LLM call)** — every message body is scanned with the configured detectors (email / phone / IBAN / credit card / SSN / IPv4 + admin custom patterns). Each match is replaced with a stable opaque token like `[[EMAIL_001]]`. The mapping `token → real` is kept in memory for the request only.
2. **Outbound (after the response)** — the assistant content AND any tool-call arguments get scanned for the same tokens. Every token is substituted back with the original value before the response leaves PromptGate.

Result: the LLM saw `[[EMAIL_001]]`; the client saw `john@acme.com`. Both ends are consistent.

## Properties

- **Stable per request, fresh across requests.** Same value reused in one prompt → same token (so the LLM treats them as one entity). Different requests get fresh counters; correlatable tokens across requests would themselves be a privacy leak.
- **Never persisted.** The mapping lives only inside the request lifecycle. There's no database row, no log entry containing `john@acme.com → EMAIL_001`. Audit logs see only the redacted form.
- **Token format `[[KIND_NNN]]` is intentional.** Brackets are unusual enough that LLMs preserve them verbatim when echoing input, and unique enough not to collide with normal text.
- **Tool-call arguments are restored too.** If the LLM calls `send_email({ to: "[[EMAIL_001]]" })`, the client sees `to: "john@acme.com"` — your downstream tool never has to reverse anything.

## Configure

Under **Guardrails → Reversible Redaction**:

| Field | Effect |
|---|---|
| **Enabled** | Toggle the policy. Inheritance: Global → Project. |
| **Detector kinds** | Pick from `email` / `phone` / `iban` / `credit_card` / `ssn` / `ipv4`. Default: all. |
| **Custom patterns** | Admin-defined regex pairs `(label, pattern)`. The label becomes the token prefix. |

Project-level config overrides global. Disable at the project level to opt out of an inherited rule.

## Custom patterns

Common cases admins add per project:

```text
Order ID  : /\bORD-\d{6}\b/         → [[ORDER_ID_001]]
Customer  : /CUST-[A-Z0-9]{8}/      → [[CUSTOMER_001]]
Internal  : /\b[A-Z]{3}\d{4}\b/     → [[INTERNAL_001]]
```

Patterns must compile under PHP `preg_match` (PCRE). The Guardrails configure modal validates compilation server-side and rejects bad regex with a friendly error.

## Limitations

- **Wrapper / Agent-Proxy only.** AI Gateway endpoints (`POST /api/{uuid}/{slug}`) don't run reversible redaction yet — they have a fixed prompt + fixed provider, so PII masking via the existing PII Filter is usually the right tool for them.
- **String-only.** Image / file inputs aren't scanned (the LLM sees them as base64 anyway; redaction wouldn't survive).
- **Streaming responses.** Tokens in streaming chunks are restored; in v1 the substitution happens after the full response is buffered, so streaming-with-redaction still works but loses the very-first-byte latency advantage.

---

> © Akyros Labs LLC. All rights reserved.
