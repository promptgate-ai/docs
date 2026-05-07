---
title: Endpoint Evals
description: Per-endpoint goldensets you can re-run after every config change to catch regressions before real traffic hits them.
---

Endpoint Evals are JSON goldensets attached to a specific AI Gateway endpoint. Each item is an `(input, expected)` pair. Running the set executes every item against the **current** endpoint configuration (provider, prompts, guardrails, schemas, routing rules) and records pass/fail per item — so when you tweak a prompt or swap a model, you can answer "did anything break?" in under a minute.

## Why

| Situation | Eval answer |
|---|---|
| You changed the system prompt — does the new one still produce the structured output downstream consumers depend on? | Run the schema-validating eval. |
| A routing rule now sends some traffic to a cheaper model — do the cheap-model responses still cover the keywords? | Run the contains eval. |
| You bumped temperature from 0 to 0.7 — does the response still stay under the token budget? | Run the max_total_tokens eval. |

## Define a set

`Endpoints → (your endpoint) → Evals → New eval set`. Items are a JSON array; each item looks like:

```json
{
  "name": "summary mentions price",
  "input": {
    "messages": [
      { "role": "user", "content": "Summarize: The new model costs $20/M tokens." }
    ]
  },
  "expected": {
    "contains": ["$20", "tokens"],
    "not_contains": ["I cannot"],
    "matches_schema": null,
    "min_total_tokens": 5,
    "max_total_tokens": 200
  }
}
```

## Expectations

| Field | Pass when |
|---|---|
| `contains` | Every substring is present in the response (case-insensitive). |
| `not_contains` | None of the substrings appear (case-insensitive). |
| `matches_schema` | Response is valid JSON and validates against the supplied JSON Schema. |
| `min_total_tokens` | Response total_tokens ≥ value. |
| `max_total_tokens` | Response total_tokens ≤ value. |

All listed expectations must pass for the item to pass. Expectations are independent — leave any field out if you don't care.

## Run + diff

Hit **Run** on a set and you'll be redirected to the run detail page when execution finishes. The page shows:

- aggregate counters (passed/failed/total, latency, tokens),
- per-item status with the failure kind (`missing` / `forbidden` / `schema` / `tokens_low` / `tokens_high` / `exec_error`) and the exact substring or schema error,
- a **diff vs. previous run**: which items regressed, which got fixed, pass/fail delta — so you can land a config change confidently.

## Failure kinds

| Kind | Meaning |
|---|---|
| `missing` | A `contains` substring was not found. |
| `forbidden` | A `not_contains` substring appeared. |
| `schema` | Response was either not JSON or didn't validate. |
| `tokens_low` / `tokens_high` | Token count outside the configured bounds. |
| `exec_error` | Endpoint threw before producing a response (guardrail block, provider error, etc.). |

## Storage + audit

Sets live in `endpoint_eval_sets`, runs in `endpoint_eval_runs` (with full per-item results inline as JSON so the diff doesn't need to re-execute). Every run writes an `eval.run` audit entry with the totals.

## Limitations (v1)

- Items run **sequentially**; large sets take roughly *N × endpoint p95*.
- Eval calls share the response cache with normal traffic. The cache key auto-rotates on prompt/model/options changes, so a config change *will* re-run live; if you need to force-bypass the cache for an eval, manually purge first.
- Wrapper / API Gateway endpoints don't have evals yet — AI Gateway only.

---

> © Akyros Labs LLC. All rights reserved.
