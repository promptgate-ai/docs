---
title: "Names and addresses — pii_contextual"
description: "Some personal data has no format a scanner can check: \"Ana Schmidt\", \"Hauptstraße 5, 10115 Berlin\", a date of birth in a sentence. This guard asks a model —…"
---

<!-- Generated from docs/guard-pii-contextual.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Some personal data has no format a scanner can check: "Ana Schmidt",
"Hauptstraße 5, 10115 Berlin", a date of birth in a sentence. This
guard asks a model — any provider in your config, with its server-side
key — and treats what it reports like every other finding: mask,
redact, block or log.

```yaml
providers:
  openai: { api_key: ${OPENAI_API_KEY} }

guardrails:
  pii: {}                                   # formats: e-mail, IBAN, …
  pii_contextual:                           # meaning: names, addresses
    provider: openai
    model: gpt-4o-mini
    custom:
      - { kind: patient_id, description: "hospital patient numbers like P-12345" }
```

## How it works

1. Before the request is scanned, the guard collects the texts of its
   roles (default `user`) and asks the model about each new one — in
   parallel, at most `max_calls` per request, long texts in chunks of
   `chunk_chars`.
2. The model answers with a list of findings, not with rewritten text:
   `{"entities":[{"kind":"person_name","text":"Ana Schmidt"}]}`.
3. PromptGate looks for those exact strings in the request, as whole
   words, and masks them — `[PERSON_NAME]`, `[ADDRESS]` — or redacts,
   blocks or logs. A finding that isn't in the text is dropped: the
   model can't invent what gets changed, and it never rewrites the
   request itself.

Answers are cached by text (20,000 entries, in memory, kept across
config reloads). Agents resend the whole conversation every turn; only
the new messages cost a call.

## Settings

| field | default | |
|---|---|---|
| `provider`, `model` | required | the model to ask; the provider needs a server-side `api_key` and is checked when the config loads |
| `kinds` | `[person_name, address]` | built in: `person_name`, `address`, `date_of_birth` |
| `custom` | — | your own kinds: `{kind, description}` — the description is what the model is told to look for |
| `on_error` | `allow` | when the model can't be asked (down, timeout, garbled answer, more than `max_calls` new texts): `allow` passes the request unchecked and logs `pii_contextual: logged unavailable`; `block` refuses it |
| `timeout` | `10s` | for all calls of one request |
| `min_chars` | `12` | shorter texts aren't checked |
| `chunk_chars` | `8000` | longer texts are split at line ends |
| `max_calls` | `8` | per request |
| `concurrency` | `4` | calls at once |

Actions `mask` (default), `block`, `log`, `redact`; roles `user` by
default — every role you add means more calls.

## Costs and limits

- Every new text is a model call: a request with new text waits for
  the model's answer (one round trip, the calls run in parallel), and
  the tokens are on the provider's bill. The calls don't
  count against rate limits or budgets and aren't in the request log.
- Quality is the model's: small models miss some names and flag some
  common words. Combine with `pii` for everything with a format.
- The text is sent to the provider you name. For data that must not
  leave your network, point `provider` at a local model (Ollama, vLLM —
  any OpenAI-compatible server).
- Text crafted to talk the model out of reporting can succeed; the
  prompt tells it to treat the text as data, not instructions.

Common settings (`enabled`, `action`, `roles`) and scopes are described in
[guardrails](/guardrails/).
