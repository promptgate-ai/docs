---
title: "Endpoint routes"
description: "Part of AI Gateway endpoints."
---

<!-- Generated from docs/endpoint-routes.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Part of [AI Gateway endpoints](/endpoints/).

Routes send a request to another model when conditions hold — long
input to a model with a bigger context, VIP keys to a better model,
cheaper models once the budget runs low:

```yaml
routes:                       # tried in order, the first match wins
  - name: long-input
    when: { input_tokens: { gt: 8000 } }
    use: { model: "openai:gpt-4.1-mini" }
  - name: vip
    when: { keys: [enterprise], vars: { priority: { eq: high } } }
    use: { model: claude-sonnet, params: { temperature: 0 } }
  - name: budget-tight
    when: { monthly_spend_pct: { gte: 80 } }
    use: { model: fast }
  - name: nightly
    when: { time_of_day: { between: ["22:00", "06:00"] }, weekdays: [mon, tue, wed, thu, fri] }
    use: { model: "groq:llama-3.3-70b-versatile" }
```

| condition | holds when |
|---|---|
| `input_tokens` | the prompt (messages + system), estimated as characters / 4, compares: `gt`, `gte`, `lt`, `lte`, `eq` |
| `messages` | the number of messages compares |
| `monthly_spend_pct` | the endpoint's spend this month, in % of its monthly budget (USD, else tokens), compares; never without such a budget |
| `stream` | the client streams (`true`) or not |
| `time_of_day` | the time in `budgets.timezone` is in `between: [from, to)`; past midnight wraps |
| `weekdays` | the day in `budgets.timezone` is one of `mon` … `sun` |
| `keys`, `users` | the `pg_` key / [end user](/users/) is one of these |
| `vars.<name>` | the variable's value `eq` a text, is `in` a list, or `matches` a regular expression |

All set conditions must hold; a route without `when` always does.
`use.model` is an alias or `provider:model`; `use.params` are set over
the endpoint's (and the client's). Routes are compiled at load, and
they act before the provider is chosen, so rate limits, budgets,
guardrails and fallbacks follow the model the route picked. The route
that matched is logged (`promptgate logs` shows `route=…`).
