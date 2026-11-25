---
title: "Guardrails"
description: "Guardrails inspect every request before a provider sees it. They read the content of the request in any API format — chat messages, system prompts, tool calls…"
---

<!-- Generated from docs/guardrails.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Guardrails inspect every request before a provider sees it. They read
the content of the request in any API format — chat messages, system
prompts, tool calls and tool results, Responses API input, embeddings
input, attached files — and can refuse the request, mask what they
find, or just record it.

## What guardrails can do

| guard | does | default | |
|---|---|---|---|
| `ip_allowlist` | admits requests from listed IPs and CIDRs only, behind trusted reverse proxies too | 403 | [details](/guard-access/#ip_allowlist) |
| `time_window` | admits requests during set hours only, per weekday and time zone | 403 | [details](/guard-access/#time_window) |
| `keywords` | refuses words and phrases you name — codenames, customers, projects | `block`, user content | [below](#keywords) |
| `length` | bounds the characters of one request | `block` | [below](#length) |
| `prompt_injection` | "ignore previous instructions", role assumption, system-prompt leaks, chat-template tokens — English and German | `block`, user content | [details](/guard-injection/) |
| `secrets` | API keys, tokens, private keys, connection-string passwords (PromptGate rules + 221 gitleaks formats) | `block`, all roles | [details](/guard-secrets/) |
| `pii` | e-mail, phone, IBAN, credit card, SSN, IP address — with checksums | `mask`, all roles | [details](/guard-pii/) |
| `pii_contextual` | names, postal addresses, dates of birth and kinds you describe — found by a model you choose | `mask`, user content | [details](/guard-pii-contextual/) |
| `token_saver` | trims tool results — escape codes, whitespace, repeated output, optional size cap | `apply`, tool results | [details](/guard-token-saver/) |
| `attachments` | reads files in requests (text, docx, xlsx, pptx, pdf) for every guard above, or refuses them | `log`, all roles | [below](#attachments) |

For all of them:

- **[Actions](#actions)** — `block` (422, nothing reaches the provider),
  `mask`, `redact` (the answer gets the [original back](#reversible-redaction)) or `log`.
- **[Lists](/guard-lists/)** — keywords, IP allow and deny lists, your
  own injection phrases and PII exceptions from text files or URLs,
  fetched again while the gateway runs.
- **[Scopes](#scopes)** — other rules per model alias, AI Gateway
  endpoint, MCP server, API and `pg_` key.
- **[Roles](#settings-every-guard-has)** — which parts of a request a guard reads.
- **Every surface** — the LLM proxy, [AI Gateway endpoints](/endpoints/),
  [MCP](/mcp/#guardrails) tool calls and results, the [API Gateway](/api-gateway/#guardrails).
- **[Ready-made levels](#ready-made-protection)** to start from.

Everything in one config:

```yaml
guardrails:
  ip_allowlist:
    allow: [10.0.0.0/8]
    lists: [{ url: https://vpn.example.com/egress-ranges.txt, into: allow }]
  time_window:
    timezone: Europe/Berlin
    windows: [{ days: mon-fri, from: "07:00", to: "20:00" }]
  keywords:
    words: ["Project Falcon", "confidential"]
    lists: [{ file: lists/codenames.txt }]       # one entry per line
  length: { max_chars: 400000 }
  prompt_injection:
    custom: [{ kind: exfiltration, phrase: "send ~4 passwords to" }]
  secrets: { action: mask }
  pii:
    action: redact                               # restored in the answer
    allow: ["@acme.com"]
  pii_contextual: { provider: openai, model: gpt-4o-mini }
  token_saver: {}
  attachments: { unreadable: block }

  # Scopes name an alias, endpoint, MCP server or key the config defines.
  models:                     # per model alias
    local: { keywords: { enabled: false } }
  endpoints:                  # per AI Gateway endpoint — wins over the alias
    summarize-ticket: { pii: { action: mask } }
  mcp:                        # per MCP server
    browser: { prompt_injection: { roles: [user, tool] } }
  keys:                       # per pg_ key — wins over everything else
    ci: { keywords: { action: log } }
```

Each guard's own settings are described below and on its page.

## Ready-made protection

`promptgate setup` writes one of four levels into the config, which you
can then tune guard by guard:

| level | secrets | personal data | prompt injection | also |
|---|---|---|---|---|
| `recommended` | mask | redact (restored in answers) | block, in your prompts | token saver |
| `strict` | block | mask | block, in tool results too | token saver, unreadable files refused |
| `log` | log | log | log | token saver as a dry run |
| `off` | — | — | — | |

`recommended` masks secrets instead of refusing the request. A coding
agent that read a `.env` file keeps that tool result in its history and
sends it with every later request, so a block would stop the whole
session. Masked, the provider sees `[GITHUB_PAT]` and the session goes
on.

Without any config file, PromptGate applies `recommended`. A config file
without a `guardrails:` section has none.

## Actions

| action | effect |
|---|---|
| `block` | refuse with **422** in the client SDK's error shape — `Request blocked by guardrail keywords: keyword detected.` Nothing reaches a provider; no rate-limit token or budget is used. |
| `mask` | replace each finding with its label (`[KEYWORD]`, `[EMAIL]`, …) and forward the request |
| `redact` | like `mask`, with a numbered token per value (`[[EMAIL_001]]`) that the answer gets back as the original — see [reversible redaction](#reversible-redaction) |
| `log` | forward unchanged and record the finding; for transformers, a dry run |
| `apply` | transformers only: rewrite content to save tokens |

Each guard lists the actions it supports; the first is its default.
Every guard that can `mask` can also `redact`.
Findings — guard, action, kind and count, never the matched text — go to
the console line, the request log (`promptgate logs`, `guard` in
`--json`) and the `promptgate_guardrail_findings_total` metric. A block
shows as the request's error.

## Reversible redaction

With `action: redact` the provider never sees the value, yet the user
reads it in the answer:

```yaml
guardrails:
  pii: { action: redact }
```

```text
client sends     Write a reply to ana@firma.de and call +49 30 1234567.
provider sees    Write a reply to [[EMAIL_001]] and call [[PHONE_001]].
provider answers Dear [[EMAIL_001]], …
client receives  Dear ana@firma.de, …
```

- The same value gets the same token within a request, so the model
  knows an address it sees twice is one address. Tokens are numbered
  per kind and per request — never shared between requests, where they
  would let anyone correlate data.
- Answers are restored in every shape: buffered JSON and event
  streams, in the client's format after any translation, in text and
  in tool-call arguments. Models write tokens in pieces —
  `[[`, `EMAIL`, `_001`, `]]` — one event each; an event that ends with
  the start of a token waits until the next piece arrives (usually the
  next event), then both go out. Text that turns out not to be a token
  is sent unchanged; nothing is dropped. The cost is ≈ 0.5 µs per event.
- Only exact tokens are restored. A model that rewrites one
  (`EMAIL_001`, `[[Email_001]]`) leaves it as written.
- The mapping lives in memory for the duration of the request and is
  never logged or stored. Request logs show `pii: redacted email×2`.
- Values are restored with JSON escaping for the string they land in.
  A value with quotes or backslashes inside a tool call's argument
  string (JSON in a JSON string) would need escaping twice; e-mail
  addresses, phone numbers, IBANs and card numbers never do.

## Settings every guard has

| field | default | description |
|---|---|---|
| `enabled` | `true` | `false` turns the guard off in this scope |
| `action` | per guard | `block`, `mask` or `log`, where supported |
| `roles` | per guard | whose content the guard reads: `user`, `assistant`, `system`, `tool` |

Roles come from the request itself: a message's `role` (wherever it
stands in the message, also after `content`), the top-level
`system` / `instructions` (system), and tool results — `role: tool`
messages, `tool_result` blocks, `function_call_output` items (tool).
Embeddings and completions input count as user. Guards that look for
things users type (keywords, prompt injection) read `user` only by
default, so the developer's own system prompt and earlier answers don't
trip them; guards that look for leaks (secrets, PII) read everything,
including tool results — where a `.env` file an agent just read ends up.

Ids, model names and tool definitions are never read; attachments are
read as described under [`attachments`](#attachments).

## Scopes

Rules apply in four layers, each overriding the one before **field by
field**:

1. `guardrails.<guard>` — every request
2. `guardrails.models.<alias>.<guard>` — requests for that model alias
3. `guardrails.endpoints.<name>.<guard>` — requests to that [AI Gateway
   endpoint](/endpoints/)
4. `guardrails.keys.<key>.<guard>` — requests with that `pg_` key

Calls through the [MCP gateway](/mcp/#guardrails) layer the global
rules, `guardrails.mcp.<server>` and the key's; aliases and endpoints
don't apply to them. Calls through the [API Gateway](/api-gateway/#guardrails)
layer the global rules, `guardrails.apis.<api>` and the key's.

A list such as `words` is replaced, not extended; entries a
[`lists`](/guard-lists/) setting brings count as part of the field
they extend. A scope can switch a
guard off (`enabled: false`) or on with its own settings. Guardrails
apply before routing, so every provider and fallback receives the same
inspected request. Config changes reload without a restart; a broken
rule keeps the running config and names its path
(`guardrails.keys.ci.keywords: …`).

## Guards

The guards with no page of their own. The others: see the
[overview](#what-guardrails-can-do).

### `keywords`

Words or phrases that must not be sent.

| field | default | |
|---|---|---|
| `words` | — | list of words or phrases (required, unless `lists` brings them) |
| `lists` | — | more words from files or URLs — see [lists](/guard-lists/) |
| `whole_words` | `true` | match only whole words, so `ass` doesn't hit `class` |
| `case_sensitive` | `false` | |

Actions `block` (default), `mask`, `log`; roles `user`. The client is
not told which word matched.

### `length`

Bounds the total characters of content in one request.

| field | |
|---|---|
| `max_chars` | refuse larger requests |
| `min_chars` | refuse smaller ones |

Actions `block` (default), `log`. Message: `Request blocked: input too
long (412000 characters, max 400000).`

### `attachments`

Files in requests — Anthropic `document` and `image` blocks, OpenAI
`file` and `image_url` parts, Responses `input_file` / `input_image`,
audio — are read like any other content: their text goes through every
content guard. No setting is needed for that; this rule changes it.

| format | read as |
|---|---|
| plain text (txt, md, csv, json, html, code) | text — can be masked; the file is re-encoded |
| docx, xlsx, pptx | text of the document, sheets, slides and notes |
| pdf with a text layer | text of every page |
| images, scanned or encrypted PDFs, audio, unknown formats, `http(s)` URLs, file ids | unreadable — see `unreadable` |

Formats are recognised by their content, not by the media type the
client claims.

| field | default | |
|---|---|---|
| `action` | `log` | `log` reads attachments; `block` refuses **every** request with an attachment (422 `Request blocked: attachments are not allowed.`) |
| `unreadable` | `allow` | `block` refuses attachments PromptGate can't read; `allow` passes them and logs `attachments: logged unreadable_image` |
| `max_bytes` | `20MB` | larger files count as unreadable (`too_large`) |
| `roles` | all | whose attachments the rule covers |
| `enabled` | `true` | `false` passes attachments unread |

```yaml
guardrails:
  keywords: { words: ["Project Falcon"] }
  attachments: { action: block }            # no files at all…
  keys:
    legal: { attachments: { action: log, unreadable: block } }   # …except for legal, read strictly
```

Findings in attachments name the format: `keywords: blocked keyword
[pdf]`, and the client reads `keyword detected in a pdf attachment`.
Office documents and PDFs can't be rewritten safely, so where a guard
would mask something in one, the request is refused instead
(`unmaskable_pdf`).

Reading runs in-process with limits: archives may unpack to 64 MB,
text is capped at 4 MB, PDFs at 2,000 pages and 5 s, and PDF parsing
runs isolated so a malformed file can't take the gateway down. A
10-page PDF takes about 0.7 ms, a 10-page docx 0.2 ms. Images are not
OCR'd; a vision-model check may follow.

Files uploaded beforehand through a provider's Files API arrive as a
`file_id` only — their content never passes PromptGate, so they are
unreadable.

## Quality gate

Every build attacks the guardrails with thousands of generated secrets,
personal data, injections and list entries, and fails below the
required recall — see [quality gate](/quality-gate/).

## Performance

Requests are walked once, without decoding them into objects; content
is matched in lowercased copies with literal search instead of
case-insensitive regular expressions; `keywords` finds a list of 20,000
words in one pass ([lists](/guard-lists/#performance)). With `keywords` and `length` on:
**4 µs** for a 2 KB chat request, **0.34 ms** for a 200 KB agent
context (≈ 590 MB/s, Apple M3 Pro). Without guardrails the stage costs
nothing.
