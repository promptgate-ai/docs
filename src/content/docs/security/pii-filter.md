---
title: PII Filter
description: Regex-based detection for emails, IBANs, credit cards, phone numbers, SSNs, IPs — plus LLM-backed contextual detection for person names and addresses.
---

The **PII Filter** detects personal data in chat input and either **redacts** it inline or **blocks** the request entirely. Two detection layers:

1. **Regex layer** — fast, deterministic, ~10 microseconds per request. Catches emails, IBANs, credit cards, phone numbers, SSNs, IP addresses.
2. **Contextual LLM layer** — slower, optional. Catches person names and street addresses that don't match obvious regex. ~200–800ms per request when enabled.

Plus you can add **custom regex patterns** with your own labels.

## The built-in types

Configured via `types: [...]` in the guardrail rule.

### Identifiers

| Type | Pattern target | Example |
|---|---|---|
| `email` | RFC 5322-ish | `alice@example.com` |
| `ip_address` | IPv4 | `192.168.1.42` |

### Financial

| Type | Pattern target | Example |
|---|---|---|
| `iban` | IBAN with optional spaces | `DE89 3704 0044 0532 0130 00` |
| `credit_card` | 13–19 digit runs with optional separators | `4111-1111-1111-1111` |

### Government IDs

| Type | Pattern target | Example |
|---|---|---|
| `ssn_us` | US Social Security format | `123-45-6789` |

### Phone numbers

Specific patterns match before generic — order matters when designing your `types` list.

| Type | Pattern target |
|---|---|
| `phone_us` | US format with optional `+1` country code |
| `phone_de` | German format (`+49`, `0049`, `0…`) |
| `phone_generic` | Catch-all international |

### Contextual (LLM-backed)

| Type | Detection method |
|---|---|
| `person_name` | LLM call. Configure `PII_CONTEXTUAL_*` env vars. |
| `address` | LLM call. Same config as above. |

When the contextual config isn't set, these types are silently skipped — the regex layer still runs.

See the **[Configuration](/getting-started/configuration/#contextual-pii-detection-llm-backed)** section for the env vars.

### Custom patterns

Beyond the built-ins, you can add **custom regex** with your own label:

```json
{
  "custom_patterns": [
    { "label": "EmployeeID", "pattern": "/\\bEMP-\\d{6}\\b/" },
    { "label": "OrderID",    "pattern": "/\\bORD-[A-Z]{2}-\\d{8}\\b/" }
  ]
}
```

Custom patterns run **after** built-ins. Each is tested with `@preg_match` first — if invalid, the pattern is silently skipped (so a typo won't crash the gateway).

## Modes

### Mask mode (default)

Detected substrings are replaced inline:

```
Input:  "Email me at alice@example.com when ready"
Output: "Email me at [E-Mail REDACTED] when ready"
```

The redacted text replaces the original in the request before the provider sees it. The provider never sees the PII.

For contextual types, the LLM returns the redacted version of the **whole input**, with `[PERSON REDACTED]` / `[ADDRESS REDACTED]` substituted.

### Block mode

The first detected match throws **422**:

```json
{
  "ok": false,
  "error": "Request blocked: E-Mail detected in input."
}
```

The provider is never called.

## Configuration

In the project Guardrails page, click **Configure** on the PII Filter card.

![PII configure modal — placeholder](#)

The modal has a **Mode** selector (Mask / Block) and three sub-tabs:

### Tab 1 — Built-in

Group view of the built-in types. Tick the ones you want to enable. Contextual types show a chip:

- **`LLM`** — config is wired (credential + model set), the type works.
- **`not configured`** — type is disabled until `PII_CONTEXTUAL_*` env vars point at a credential.

### Tab 2 — Custom Patterns

Add rows of `(label, pattern)`. The pattern field expects a PHP-style regex (with delimiters, e.g. `/.../`).

### Tab 3 — Test Pattern

In-browser regex tester. Paste a pattern, paste sample text, see the matches highlighted live. **Doesn't hit the server** — pure JS regex evaluation. Useful for sanity-checking a pattern before saving it.

## Configuration shape

The stored rule looks like:

```json
{
  "enabled": true,
  "mode": "mask",
  "types": ["email", "iban", "credit_card", "phone_generic", "ip_address"],
  "custom_patterns": [
    { "label": "EmployeeID", "pattern": "/\\bEMP-\\d{6}\\b/" }
  ]
}
```

`types` is a list of built-in keys. `custom_patterns` is a list of objects. Both are optional — omitting `types` enables all built-ins; omitting `custom_patterns` skips custom.

## Contextual detection (LLM)

When you enable `person_name` or `address` types AND have a credential bound, the filter:

1. Runs all regex types first (email, IBAN, etc. → fast, redacted inline).
2. Calls the configured LLM exactly once with the (already partially redacted) text.
3. Sends a JSON-mode prompt: "redact any person names and addresses; return `{redacted, found}`".
4. If `found` is non-empty:
   - **Mask mode**: replaces text with the LLM's redacted version.
   - **Block mode**: throws 422 listing the labels found.
5. If the LLM call fails, returns malformed JSON, or exceeds `max_input_chars`: **silently falls back** to the regex output. The gateway stays up.

This means contextual detection is best-effort. It's a useful extra layer but not a hard guarantee — for compliance-grade redaction, treat regex-only as the floor.

## Configuration: env vars

Set these in `backend/.env` then `php artisan config:clear`:

```bash
PII_CONTEXTUAL_ENABLED=true
PII_CONTEXTUAL_CREDENTIAL_ID=3            # ID of an App\Models\Credential row
PII_CONTEXTUAL_MODEL=gpt-4o-mini          # Cheap + fast is the right pick
PII_CONTEXTUAL_MAX_CHARS=8000             # Skip detection on inputs longer than this
```

The credential's `provider_key` picks which adapter is called. `gpt-4o-mini` works well; `claude-haiku-…` and `groq:llama-3.1-8b-instant` are also fine.

## Performance

| Layer | Cost per request |
|---|---|
| Regex types (any number) | ~10–50µs |
| Custom patterns | ~10µs each |
| Contextual LLM | 200–800ms (one call regardless of how many contextual types are enabled) |

The contextual LLM call is the only meaningful latency adder. Skip it for low-latency endpoints; enable it for endpoints where the data sensitivity justifies the cost.

## Examples

### Strict — block any PII

```json
{
  "enabled": true,
  "mode": "block",
  "types": ["email", "iban", "credit_card", "ssn_us", "phone_us", "phone_de", "phone_generic", "ip_address", "person_name", "address"]
}
```

Any PII = 422. Use for endpoints handling regulated data.

### Lenient — redact and proceed

```json
{
  "enabled": true,
  "mode": "mask",
  "types": ["email", "iban", "credit_card"]
}
```

Public-facing endpoints where users might paste an email; redact, don't reject.

### Internal — custom IDs only

```json
{
  "enabled": true,
  "mode": "mask",
  "types": [],
  "custom_patterns": [
    { "label": "InternalID", "pattern": "/\\bACME-\\d{8}\\b/" }
  ]
}
```

No built-in PII detection (data is already sanitised), but redact internal identifiers from logs.

---

Next: **[Prompt Injection](/security/prompt-injection/)**.

---

> © Akyros Labs LLC. All rights reserved.
