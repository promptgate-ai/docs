---
title: "Secret scanner — secrets"
description: "API keys, tokens, private keys and passwords in connection strings — before they leave the network. An engineer pastes a snippet with a key, an agent reads a…"
---

<!-- Generated from docs/guard-secrets.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

API keys, tokens, private keys and passwords in connection strings —
before they leave the network. An engineer pastes a snippet with a key,
an agent reads a `.env` file: the request is refused, or the secret is
masked and the model sees `[AWS_ACCESS_KEY]`.

Two rule sets, used together:

- **PromptGate's own** — AWS, Google, GitHub (all token types), GitLab,
  Slack, OpenAI (incl. `sk-proj-` / `sk-svcacct-` keys), Anthropic,
  OpenRouter, Groq, xAI, Hugging Face, Stripe, JWTs, private keys, npm,
  PyPI, Twilio, SendGrid, PromptGate's own `pg_` keys, and
  `scheme://user:password@host` (only the password is the secret).
  These win where both sets find the same key.
- **gitleaks** — 221 formats from the [gitleaks](https://github.com/gitleaks/gitleaks)
  rule set (MIT), with its entropy thresholds and allowlists, so
  placeholders such as `sk-xxxx…` or `${API_KEY}` don't count.

| field | default | |
|---|---|---|
| `kinds` | all | detect only these kinds, e.g. `[aws_access_key, github_pat]` |
| `exclude` | `[generic_api_key, hashicorp_tf_password, kubernetes_secret_yaml]` | kinds to skip; the defaults are generic `key = "…"` patterns that fire on sample code. `exclude: []` turns them on |
| `gitleaks` | `true` | `false` uses PromptGate's rules only |
| `custom` | — | your own formats: `{kind, pattern, keywords}`; RE2 syntax, or `/pattern/flags` as in v1 |

Actions `block` (default), `mask`, `log`, `redact`; roles all — tool results are
where secrets usually appear. Attachments are scanned like messages, so
a key in an uploaded `.env` or spreadsheet is found too.

```yaml
guardrails:
  secrets:
    action: mask
    custom:
      - { kind: internal_token, pattern: 'itk_[a-z0-9]{32}', keywords: [itk_] }
```

Speed: each rule's regular expression only runs where its keyword
occurs, and only in a window as long as a match can be — keywords are
the literals every match must contain, derived from the expressions
(see `tools/gensecrets`). A 2 KB chat request takes 13 µs, 200 KB of
source code 2.5 ms. Text crafted to wake every rule is cut off after
50 ms + 0.25 ms per KB and reported as `incomplete_scan`: with `block`
the request is refused, never passed unchecked.

Measured with [pgfuzz](https://github.com/promptgate-ai/pgfuzz)
(1,400 synthetic secrets of seven kinds in code snippets): 100% caught.
Run over 1.4 MB of real source code and docs: no false positives.

The gitleaks set is updated with
`go run ./tools/gensecrets -in gitleaks.toml` (the file from the gitleaks
repository). Legacy Vault tokens (`s.…`, before Vault 1.10) are not
detected; `hvs.` tokens are.

Common settings (`enabled`, `action`, `roles`) and scopes are described in
[guardrails](/guardrails/).
