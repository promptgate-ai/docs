---
title: Keyword Blocklist
description: Project-defined word/phrase list that triggers a 422 on match.
---

The **Keyword Blocklist** rejects requests whose content contains any word or phrase from a configured list. Useful for hard rules: "never let users mention competitor X", "block requests about regulated topics", "stop the chatbot from discussing internal codenames".

## Configuration

```json
{
  "enabled": true,
  "mode": "block",
  "words": ["secret", "internal-codename", "competitor-X"]
}
```

`words` is a list of strings. Each is matched **case-insensitively** against the concatenated message content.

## Matching semantics

- **Substring match** — `"foo"` matches `"foobar"`. If you want word-boundary matching, use the [PII Filter's custom_patterns](/security/pii-filter/) with a regex like `/\bfoo\b/i`.
- **Case-insensitive** — `"Secret"` matches `"SECRET"`, `"secret"`, `"SeCrEt"`.
- **First match wins** — the guardrail stops at the first hit and 422s.

## Behaviour

```json
{
  "ok": false,
  "error": "Request blocked: keyword 'competitor-X' detected in input."
}
```

The matched word is named in the error so you can debug. **Be aware** that this exposes which word tripped — if your blocklist is itself sensitive, that's a leak. Use `block_message` (roadmap) to customise the error if that matters.

## Performance

Linear scan of the input against each word, case-folded once. ~10µs for 100 words on typical input. Free compared to a provider call.

## When to use

✅ **Compliance** — regulated terms, sanctioned country names, controlled-substance keywords.
✅ **Brand protection** — prevent the chatbot from discussing competitors.
✅ **Internal hygiene** — block accidental codename leaks ("Project-Phoenix").
✅ **Profanity** — paired with mask mode (not yet supported on this guardrail) you'd redact; for now block.

❌ **Subtle topic blocking** — "don't talk about politics" is hard to encode as words. Use a strong system prompt instead.
❌ **Multi-language** — unless you list the equivalents in every language.

## Inheritance

Three-level merge. **At each level, the entire list replaces the parent's** — this guardrail does not concatenate lists. So:

- Global: `["secret", "internal-codename"]`
- Project (override): `["competitor-X"]` → final list is `["competitor-X"]`, NOT `["secret", "internal-codename", "competitor-X"]`.

If you want project-specific additions on top of the global list, repeat the global entries in the project rule. Or rely on the global rule and only override at endpoint level for exceptions.

## Examples

### Block competitors

```json
{
  "enabled": true,
  "mode": "block",
  "words": ["acme corp", "globex industries", "initech"]
}
```

### Block sensitive internal terms

```json
{
  "enabled": true,
  "mode": "block",
  "words": ["project-phoenix", "operation-thunder", "skunkworks"]
}
```

### Hard-block obvious profanity

```json
{
  "enabled": true,
  "mode": "block",
  "words": ["...", "...", "..."]
}
```

(Use a curated list — don't roll your own from scratch. Open-source profanity dictionaries exist.)

---

Next: **[Content Length](/security/content-length/)**.

---

> © Akyros Labs LLC. All rights reserved.
