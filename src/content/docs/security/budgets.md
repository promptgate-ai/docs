---
title: Budgets
description: Per-request token caps + monthly USD budgets on AI Gateway endpoints.
---

PromptGate enforces two budget controls **before** the provider is called, so a runaway prompt or a forgotten loop can't drain your API spend.

| Control | Field | What it caps |
|---|---|---|
| Per-request token cap | `usage_hard_limit_tokens` | Estimated input tokens for a single request. |
| Monthly USD budget | `monthly_budget_usd` × `estimated_cost_per_1k_tokens_usd` | Sum of `total_tokens` over the current calendar month. |

Both are **per-endpoint** (AI Gateway only). Both are optional — `null` means unlimited.

## Per-request token cap

```
usage_hard_limit_tokens: 8000
```

The enforcer estimates input tokens from the concatenated message length using the documented OpenAI heuristic of **~4 characters per token** (`ceil(len/4)`). If the estimate exceeds the cap, the request is rejected:

```json
{
  "ok": false,
  "error": "Request exceeds endpoint per-request token limit: ~12500 tokens estimated, cap is 8000."
}
```

Status: **422**. The provider is never called.

### Why a heuristic?

We could call a tokenizer for each provider's actual count — but that adds latency, and the cap is meant to leave headroom anyway. 4 chars/token is close enough to a hard cap that's there to prevent megaprompts from hitting the gateway, not to do precise accounting. For accurate accounting, use post-hoc `gateway_logs.total_tokens`.

## Monthly USD budget

```
monthly_budget_usd:                   25.00
estimated_cost_per_1k_tokens_usd:      0.0020   (e.g. gpt-4o-mini)
```

Both fields are required for the budget check to fire. Without `cost_per_1k_tokens`, the gateway can't compute spend — so it silently skips the check rather than reject everything.

How spend is computed:

```
sum(total_tokens) over (this calendar month, this endpoint)
× estimated_cost_per_1k_tokens_usd / 1000
```

If the resulting figure is ≥ `monthly_budget_usd`, requests are rejected:

```json
{
  "ok": false,
  "error": "Endpoint monthly budget exhausted: ~$24.9876 spent, budget $25.00. Resets at the start of next month."
}
```

Status: **422**.

### Why an estimate?

`total_tokens` from the provider is an actual count, but `estimated_cost_per_1k_tokens_usd` is your nominal price — not necessarily what your provider invoiced. The number is **approximate** and meant as a guardrail, not as accounting. For real billing, reconcile against your provider's invoice.

### Why month boundary?

`now()->startOfMonth()` is the cut-off. Spend resets at midnight on the 1st of each calendar month, in your `APP_TIMEZONE`. So a $25/month budget gives you ~$25 every month, with the boundary at month rollover.

## Where checks fire

In the AI Gateway pipeline, **before guardrails**:

```
1. Auth + scope
2. Rate limit
3. >>> Budget enforce <<<     ← here
4. Guardrails
5. Schema, prompt, provider call
```

This ordering matters: a request that's already going to be rejected for budget reasons doesn't pay for guardrail work (no LLM-backed PII detection, no regex sweeps). Cheap checks first.

## Configuration

Endpoint wizard → **Tab 3 — Limits**:

```
Max output tokens:                  4096    (different field — caps response size)
Request token limit:                8000    (this is usage_hard_limit_tokens)
Monthly budget USD:                 25.00
Cost per 1K tokens (estimated):     0.0020
```

Live cost estimate at the bottom of the tab — "1000 tokens × $0.0020/1k ≈ $0.0020 per request, ~12 500 requests / month within budget".

## Behaviour summary

| Configuration | Effect |
|---|---|
| All four null | No budget enforcement. |
| Only `usage_hard_limit_tokens` set | Per-request cap enforced. Monthly skipped. |
| Only `monthly_budget_usd` set, no `cost_per_1k` | Both checks skipped (can't compute spend). |
| Both monthly fields set | Cumulative cap enforced. |
| Both per-request + monthly | Both enforced. First trip wins. |

## Examples

### Cheap-model endpoint, generous limits

```
Provider: openai
Model:    gpt-4o-mini
Cost/1k:  0.0020
Monthly:  25.00       (~$25/mo = 12 500 requests of 1000 tokens each)
Per-req:  8000        (cap 32k chars input)
```

### Premium-model endpoint, tight cap

```
Provider: anthropic
Model:    claude-sonnet-4-6
Cost/1k:  0.0060
Monthly:  10.00       (~$10/mo = 1 666 requests of 1000 tokens each)
Per-req:  6000
```

### Local Ollama endpoint, no budget

```
Provider: ollama
Model:    llama3
Cost/1k:  null        (free, no spend to track)
Monthly:  null
Per-req:  16000       (still cap absurd inputs)
```

## Resetting

The monthly window resets automatically on the 1st of the next month. To reset manually (e.g. after fixing a bug that ate budget on legitimate requests, you want to give back the spend):

```bash
docker compose exec app php artisan tinker
\App\Models\GatewayLog::query()
    ->where('endpoint_id', 42)
    ->where('created_at', '>=', now()->startOfMonth())
    ->update(['total_tokens' => 0]);
```

Use carefully — this falsifies the gateway log for analytics. Better to let it ride and adjust the budget upward if needed.

## Inspecting current spend

There's no first-class "current spend" UI per endpoint (yet). The Metrics page shows token usage; multiply by `cost_per_1k / 1000`.

For a quick check via Tinker:

```bash
docker compose exec app php artisan tinker
$endpoint = \App\Models\Endpoint::query()->where('slug', 'my-endpoint')->first();
$tokens = \App\Models\GatewayLog::query()
    ->where('endpoint_id', $endpoint->id)
    ->where('created_at', '>=', now()->startOfMonth())
    ->sum('total_tokens');
$spent = $tokens * $endpoint->estimated_cost_per_1k_tokens_usd / 1000;
echo "tokens: {$tokens} | spent: \${$spent} | budget: \${$endpoint->monthly_budget_usd}\n";
```

---

Next: **[SSRF Protection](/security/ssrf/)**.

---

> © Akyros Labs LLC. All rights reserved.
