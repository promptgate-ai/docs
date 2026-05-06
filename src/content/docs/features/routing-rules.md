---
title: Routing Rules
description: YAML-based, context-aware routing for AI endpoints — pick a different provider/model when input is large, schemas are present, the budget runs low, or the clock hits a window.
---

Routing Rules let an **AI endpoint** decide its provider/model **per request** instead of being fixed at design time. Rules are defined as YAML on the endpoint, evaluated top-to-bottom, and the **first matching rule wins**. If no rule matches, the endpoint's default provider is used (so adding rules is always safe — they only narrow behavior).

## Why use them

| Situation | Rule |
|---|---|
| Cheap default model can't handle 200k-token prompts | Switch to a long-context model when `input_tokens` is large |
| Strict JSON schema enforcement only on some providers | Switch when `has_output_schema` is true |
| You're 90 % through your monthly budget | Fall back to a cheaper provider |
| Off-peak rate makes a big model affordable at night | Use the bigger model between 22:00 and 06:00 |

## Where to configure

`Endpoints → (your endpoint) → Routing` tab. Snippet templates are provided for the common cases.

## YAML format

```yaml
rules:
  - when:
      input_tokens: ">= 100000"
    use:
      template: anthropic-claude-sonnet
      credential: claude-prod
    decision: "long-context"

  - when:
      has_output_schema: true
    use:
      template: openai-gpt-4o
      credential: openai-prod
    decision: "schema-strict"

  - when:
      monthly_spend_pct: ">= 90"
    use:
      template: openai-gpt-4o-mini
      credential: openai-prod
    decision: "budget-pinch"

  - when:
      time_of_day: "22:00-06:00"
    use:
      template: anthropic-claude-opus
      credential: claude-prod
    decision: "off-peak"
```

### Conditions (`when`)

| Field | Type | Match |
|---|---|---|
| `input_tokens` | comparison | `">= 100000"`, `"< 4000"` |
| `messages_count` | comparison | `">= 10"` |
| `has_output_schema` | bool | `true` / `false` |
| `has_input_schema` | bool | `true` / `false` |
| `streaming` | bool | request asked for SSE |
| `monthly_spend_pct` | comparison | `">= 90"` (% of monthly budget consumed) |
| `time_of_day` | window | `"22:00-06:00"` (UTC, wraps midnight) |

All conditions in a single `when:` block must match (logical **AND**).

### Action (`use`)

| Field | Description |
|---|---|
| `template` | Provider template slug (e.g. `openai-gpt-4o`) |
| `credential` | Credential name in the project |
| `model` | Optional override of the template's model |
| `decision` | Free-form label that ends up in `gateway_logs.routing_decision` and the live-logs modal |

## Observability

Every routed request stamps `routing_decision` on its `gateway_logs` row, and the live logs UI surfaces it in the modal title. Filtering by decision label is the fastest way to verify a rule is firing.

## Validation

Rules are validated server-side on save (Endpoints store/update). If the YAML is malformed or references an unknown template/credential, the form rejects with a clear error — you can't ship a broken endpoint.

---

> © Akyros Labs LLC. All rights reserved.
