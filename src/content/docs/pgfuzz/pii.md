---
title: pgfuzz pii
description: PII Filter recall test — fires synthetic emails / IBANs / credit cards / phones / SSNs at the gateway and reports the catch rate.
---

`pgfuzz pii` measures the **recall** of PromptGate's [PII Filter guardrail](/security/pii-filter/) against synthetic adversarial input. It is the answer to *"of 1000 plausible-looking emails wrapped in code blocks, how many does my live gateway actually catch?"*

## Quick start

```bash
pgfuzz pii \
   --target https://gateway.your-domain.com/api/$PG_UUID/v1/chat/completions \
   --token pg_live_… \
   --count 1000
```

The PII Filter guardrail must be **enabled** and in **`block` mode** for the recall numbers to mean anything. (mask-mode verification is on the [Roadmap](/pgfuzz/roadmap/) as `--verify-via-logs`.)

## Flags

| Flag | Default | Notes |
|---|---|---|
| `--target` | *(required)* | Full chat-completions URL of the gateway |
| `--token` | *(required)* | Bearer token (`pg_live_…`) — must have the `chat` scope |
| `--model` | `openai:gpt-4o-mini` | Model identifier the gateway should route to |
| `--count` | `100` | Total synthetic payloads to fire, distributed across `kinds × variants` |
| `--kinds` | `email,iban,credit_card,phone,ssn` | PII kinds to generate |
| `--variants` | `inline` | Carrier-text variants: `inline` / `wrapped` / `obfuscated` |
| `--concurrency` | `16` | Parallel HTTP workers |
| `--timeout` | `30` | Per-request timeout (seconds) |
| `--report` | `tty` | Output format: `tty` (table) or `json` |

## Kinds

| Kind | What it generates | Source |
|---|---|---|
| `email` | `firstname.lastname@example.com` style | gofakeit |
| `iban` | German DE-prefixed shape (`DE` + 2 digits + 8 + 10) | hand-rolled |
| `credit_card` | 16-digit Visa / Mastercard pattern | gofakeit |
| `phone` | Formatted (`(XXX) XXX-XXXX`) | gofakeit |
| `ssn` | US format `XXX-XX-XXXX` | gofakeit |

The IBAN generator emits a syntactically-valid shape **without** checksum math — PromptGate's regex matches the shape, not the mod-97 checksum.

## Carrier-text variants

The raw PII value is embedded in plausible user-typed text before being sent. The variant decides how:

| Variant | What it does | Example payload |
|---|---|---|
| `inline` | Raw value in a plain sentence | `"My email is alex.miller@acme.com — can you draft a reply?"` |
| `wrapped` | Inside backticks / markdown / code blocks | `"Customer entry:\n> alex.miller@acme.com\n\nWhat should I do next?"` |
| `obfuscated` | Light obfuscation (`@` → ` at `, `.` → ` dot `) | `"Reach me at alex dot miller  at  acme dot com if needed"` |

The `obfuscated` variant is **not** meant to fool the filter — it's a **useful negative result**: it shows that obfuscation breaks recall, which is real-world information.

## Verdict

Each result is classified as:

| Outcome | Condition | Counts toward |
|---|---|---|
| `caught` | HTTP 422 + body mentions a PII kind (`E-Mail`, `IBAN`, `Credit card`, …) | Recall numerator |
| `missed` | HTTP 2xx | Recall denominator |
| `error` | Anything else (4xx that's not 422, 5xx, transport error, 422 with unrelated body) | Excluded from recall |

**Recall = `caught / (caught + missed)`.** Errors are excluded so they don't inflate or deflate the number.

## Output

### TTY (default)

```
pgfuzz — recall report
  target:   https://gateway.your-domain.com/api/.../v1/chat/completions
  total:    300
  duration: 4.1s
  p50/p95:  62ms / 188ms

KIND         VARIANT    TOTAL  CAUGHT  MISSED  ERRORS  RECALL
----         -------    -----  ------  ------  ------  ------
credit_card  inline     50     50      0       0       100.0%
credit_card  wrapped    50     49      1       0       98.0%
email        inline     50     50      0       0       100.0%
email        wrapped    50     50      0       0       100.0%
iban         inline     50     48      2       0       96.0%
iban         wrapped    50     48      2       0       96.0%
----         -------    -----  ------  ------  ------  ------
ALL          (all)      300    295     5       0       98.3%
```

ANSI-free so it pipes cleanly through CI logs.

### JSON

```bash
pgfuzz pii … --report json | jq '.overall'
```

```json
{
  "kind": "ALL",
  "variant": "",
  "total": 300,
  "caught": 295,
  "missed": 5,
  "errors": 0,
  "recall": 0.9833
}
```

The full payload includes `run` (target / duration / p50 / p95), `cells[]` (per-bucket), and `overall`.

## Examples

### Smoke test before deploy

```bash
pgfuzz pii --target $URL --token $TOKEN --count 200
# expect recall ≥ 95%
```

### Catch a regression on a single kind

```bash
pgfuzz pii --target $URL --token $TOKEN --count 500 \
   --kinds iban --variants inline,wrapped --report json \
   | jq '.cells[] | select(.recall < 0.95)'
```

Empty output = no regression. Non-empty = the cells that fell below 95% recall.

### Quantify the obfuscation gap

```bash
pgfuzz pii --target $URL --token $TOKEN --count 600 \
   --kinds email --variants inline,wrapped,obfuscated
```

Run weekly; the gap between `inline` and `obfuscated` recall is a hard fact about what the filter handles.

---

Next: **[pgfuzz secrets — Secret Scanner recall test](/pgfuzz/secrets/)**.

---

> © Akyros Labs LLC. All rights reserved.
