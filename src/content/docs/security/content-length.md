---
title: Content Length
description: Min / max length cap on user input. Cheap protection against degenerate or wasteful inputs.
---

The **Content Length** guardrail enforces a minimum and / or maximum on the **character count** of the concatenated message content. Cheapest possible defence against:

- One-character inputs that aren't worth a provider call (`min`)
- Multi-megabyte inputs that would blow your token budget (`max`)
- Buffer overflow attempts and DoS-by-megaprompt

## Configuration

```json
{
  "enabled": true,
  "min": 5,
  "max": 50000
}
```

Either or both can be set. Both are optional — omitting one means no bound in that direction.

The mode is implicitly `block` — there's no useful "mask" semantics for length.

## Behaviour

| Input length | `min: 5, max: 50000` | Result |
|---|---|---|
| 0 chars | violates min | 422 |
| 1–4 chars | violates min | 422 |
| 5–50 000 chars | OK | passes |
| 50 001+ chars | violates max | 422 |

422 response:

```json
{
  "ok": false,
  "error": "Request blocked: content length 80012 exceeds maximum 50000."
}
```

## Multi-byte handling

Length is measured with `mb_strlen()` — character count, not byte count. So `"日本語"` is 3, not 9. Match what your `usage_hard_limit_tokens` budget expects.

## Combining with budgets

This guardrail is a **fast** length cap that runs before guardrails / provider call. The **[budget enforcer](/security/budgets/)** has a per-request token cap (`usage_hard_limit_tokens`) that estimates tokens at ~4 chars/token.

In practice they cover similar ground but at different levels:

- **Content Length** — character cap, runs in the guardrail step. Prevents degenerate inputs from even entering the pipeline.
- **Token cap** — token-estimate cap, runs in the budget step. Closer to actual provider cost.

You usually want both: a generous content-length cap (e.g. 100 000 chars) to reject truly absurd inputs, and a tighter token cap (e.g. 8 000 tokens) tuned to your endpoint's actual context window.

## Performance

`mb_strlen()` of a few hundred KB completes in microseconds. Free compared to anything else.

## Recommended defaults

For most endpoints:

```json
{
  "enabled": true,
  "min": 1,
  "max": 50000
}
```

For high-context endpoints (long-document summarisation, etc.):

```json
{
  "enabled": true,
  "min": 100,
  "max": 500000
}
```

For short-form classifiers (single-sentence input):

```json
{
  "enabled": true,
  "min": 1,
  "max": 1000
}
```

## When to enable

✅ **Always**. The cost is microseconds and the protection is meaningful (DoS, runaway tokens, degenerate inputs).

❌ Never disable globally unless you've convinced yourself another layer is catching the same thing.

---

Next: **[Rate Limits](/security/rate-limits/)**.

---

> © Akyros Labs LLC. All rights reserved.
