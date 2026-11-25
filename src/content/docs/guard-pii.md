---
title: "PII filter — pii"
description: "Personal data — e-mail addresses, phone numbers, IBANs, credit card numbers, US social security numbers and IP addresses — masked before a provider sees it.…"
---

<!-- Generated from docs/guard-pii.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Personal data — e-mail addresses, phone numbers, IBANs, credit card
numbers, US social security numbers and IP addresses — masked before a
provider sees it. The model reads `Mail [EMAIL] or call [PHONE]` and
can still answer.

| kind | finds | checked with |
|---|---|---|
| `email` | `ana.b+tag@firma.de` | a domain with a top-level domain; `scheme://user:pw@host` is left to `secrets` |
| `phone` | `+49 30 1234567`, `0049 …`, `(555) 123-4567`, `555-123-4567`, `1-555-123-4567`, `030 1234567`, `0171/1234567` | international numbers need `+` or `00`; national ones a trunk `0` or the US layout. Bare digit runs never match |
| `iban` | `DE89 3704 0044 0532 0130 00`, with or without spaces | the country's exact length and the mod-97 check digits |
| `credit_card` | 12–19 digits, bare or grouped by spaces or dashes | issuer prefix and length, Luhn check |
| `ssn` | `123-45-6789`, `123 45 6789`; nine bare digits only with "SSN" or "social" close by | the ranges the SSA issues (no `000`, `666`, `9xx`) |
| `ip_address` | IPv4 (also with port or CIDR) and IPv6 | loopback, `0.0.0.0` and `::` are skipped — they fill configs and say nothing about anyone |

| field | default | |
|---|---|---|
| `kinds` | all | detect only these kinds, e.g. `[email, iban]` |
| `validate` | `true` | `false` drops the checksum and range checks — more matches, more false positives |
| `allow` | — | values never reported, e.g. `support@acme.com`; `@acme.com` allows a whole domain |
| `lists` | — | more `allow` values from files or URLs — see [lists](/guard-lists/) |
| `custom` | — | your own formats: `{kind, pattern}`; RE2 syntax, or `/pattern/flags` as in v1 |

Actions `mask` (default), `block`, `log`, `redact`; roles all — customer records
arrive in tool results as often as in prompts.

```yaml
guardrails:
  pii:
    allow: ["@acme.com"]
    custom:
      - { kind: employee_id, pattern: 'EMP-\d{6}' }   # masked as [EMPLOYEE_ID]
  keys:
    support-bot: { pii: { action: block, kinds: [credit_card, iban] } }
```

The built-in kinds are hand-written scanners rather than regular
expressions: one pass jumps from digit to digit, and checksums weed out
look-alikes such as order numbers, dates, versions and timestamps. A
2 KB chat request takes 2.6 µs including the walk, 200 KB of prose
0.16 ms. Measured with [pgfuzz](https://docs.promptgate.dev/pgfuzz/)
(5,000 synthetic values of five kinds, inline and in Markdown or code
blocks): 100% caught. Over 2.6 MB of real source code and docs, every
finding was real data — author addresses, test card numbers,
documentation examples — and none a false positive. Spelled-out
addresses (`ana at firma dot de`) are not detected; names and street
addresses are found by [`pii_contextual`](/guard-pii-contextual/).

Common settings (`enabled`, `action`, `roles`) and scopes are described in
[guardrails](/guardrails/).
