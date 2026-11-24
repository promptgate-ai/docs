---
title: "Token saver — token_saver"
description: "Coding agents send every tool result back to the model on every turn: test runs with colour codes, npm install progress bars, the same file read three times, a…"
---

<!-- Generated from docs/guard-token-saver.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Coding agents send every tool result back to the model on every turn:
test runs with colour codes, `npm install` progress bars, the same file
read three times, a 2 MB log. The token saver trims that before the
provider sees it — you pay for fewer input tokens, and the model reads
less noise.

```yaml
guardrails:
  token_saver: {}                    # escape codes, whitespace, repeats
  keys:
    ci-agent: { token_saver: { truncate_bytes: 32000 } }   # also cap huge outputs
```

| rule | setting | default | removes |
|---|---|---|---|
| escape codes | `strip_ansi` | on | colours, cursor movement, window titles, hyperlinks, control characters, backspace overstrikes, and progress-bar states a carriage return redrew — the last one stays |
| whitespace | `squeeze` | on | trailing spaces and tabs, CRLF → LF, runs of blank lines (one blank line stays) |
| repeats | `dedupe_min_bytes` | `1024` | a tool result of at least this size that already appeared earlier in the request becomes `[Same output as an earlier tool result; repeated copy removed by PromptGate.]`; `0` turns it off |
| size cap | `truncate_bytes` | off | output beyond this size keeps its first `head_bytes` (¾) and last `tail_bytes` (¼), cut at line ends, with `[… 48213 bytes of output omitted by PromptGate …]` between |

Actions `apply` (default) and `log`: a **dry run** that changes nothing
and records what would have been saved — measure first, then switch to
`apply`. Roles `tool` by default; add `user` for agents that paste
output into user messages.

## What you see

The request log names each rule and the bytes it took out:

```text
token_saver: trimmed ansi×14 (3.2 KB); token_saver: trimmed duplicate×2 (41.7 KB)
```

The metric `promptgate_token_saver_bytes_total{key, mode}` adds them up
per key, `mode` `applied` or `dry_run`. Bytes ÷ 4 is a fair estimate of
tokens.

## Prompt caching

Providers cache the start of a request that repeats from the turn
before. Every rule here is deterministic and depends only on the
message and the ones before it: an unchanged history comes out
byte-identical every turn, so cached prefixes keep hitting. That is why
repeats keep the **first** copy and replace later ones — the history
before them never changes.

## Cautions

- Truncated or removed output is gone for the model. Size caps that are
  too small make agents re-run commands; start with a dry run and a
  generous `truncate_bytes`.
- Only message content is trimmed, never attachments.
- Other guardrails see the trimmed text: a secret in output cut by
  `truncate_bytes` no longer reaches the provider, and isn't reported.

Speed: a 245 KB request with 200 KB of coloured test output takes
≈ 1.2 ms, decoding included.

Common settings (`enabled`, `action`, `roles`) and scopes are described in
[guardrails](/guardrails/).
