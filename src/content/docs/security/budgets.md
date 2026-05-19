---
title: Budgets
description: Pre-flight kill-switch — refuse the upstream call when the request would push spend over the cap.
---

PromptGate runs a **pre-flight budget gate** before every provider call. We estimate the cost of the *current* request (prompt tokens + max_output_tokens × pricing), add it to the month-to-date spend, and if the sum would push over the cap we refuse with **HTTP 402 Payment Required** — the upstream call is never made. No tokens burned, no provider invoice growth.

This is the "Baar-style" kill-switch: enforcement before the bytes leave the host, not after the bill arrives.

| Control | Field | Scope | Status on block |
|---|---|---|---|
| Per-request token cap | `usage_hard_limit_tokens` | Per-endpoint | 422 |
| Endpoint monthly USD budget | `monthly_budget_usd` × `estimated_cost_per_1k_tokens_usd` | Per-endpoint | **402** |
| Token monthly USD budget | `monthly_budget_usd_cap` on the API token | **All surfaces** — Gateway, Wrapper, Agent Proxy | **402** |

All are optional — `null` means unlimited.

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

## Monthly USD budget — endpoint level

```
monthly_budget_usd:                   25.00
estimated_cost_per_1k_tokens_usd:      0.0020   (e.g. gpt-4o-mini)
```

Both fields are required for the budget check to fire. Without `cost_per_1k_tokens`, the gateway can't compute spend — so it silently skips the check rather than reject everything.

How the pre-flight gate decides:

```
spent     = sum(total_tokens) × cost_per_1k / 1000   (this month, this endpoint)
estimated = (prompt_tokens + max_output_tokens) × cost_per_1k / 1000   (this request)
block if (spent + estimated) > monthly_budget_usd
```

If the sum would breach the cap, the upstream call is refused:

```json
{
  "ok": false,
  "error": "Endpoint monthly budget would be exceeded: ~$24.9876 spent + ~$0.0501 estimated for this request, budget $25.00. Resets at the start of next month."
}
```

Status: **402 Payment Required**.

## Monthly USD budget — token level

Set on the API token (`monthly_budget_usd_cap`). The gate is **cross-surface** — applies to AI Gateway endpoint calls, the AI Wrapper's `/v1/chat/completions`, and the Agent Proxy's `/v1/messages` and `/v1/responses`. Wherever the token's bearer ends up, the cap holds.

The estimate uses the live **[Model Pricing](/observability/cost-dashboard/)** catalogue for the resolved `provider:model`, falling back to the endpoint's `cost_per_1k` when no catalogue row exists.

```json
{
  "ok": false,
  "error": "Token monthly budget would be exceeded: ~$4.9912 spent + ~$0.0203 estimated for this request, cap $5.00. Resets at the start of next month.",
  "type": "budget_exhausted"
}
```

Status: **402**. The token detail page shows a live **Budget · this month** card with current spend vs cap, a progress bar (green < 80% < warn < 100% < red) and a one-line explainer of the active state.

### Per-field override semantics

A token-level `monthly_budget_usd_cap` **replaces** the endpoint's cap for that request — never min(), never both. So a permissive token can grant more headroom than the endpoint default, a strict one tightens it. Same per-field-override rule as `rate_limit_per_minute` / `rate_limit_per_hour`.

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

**Token detail page** (`Tokens → click name`) — the General tab shows a **Budget · this month** card with current spend, cap, percentage, and progress bar. Includes wrapper / proxy traffic.

**Cost Dashboard** (`Observability → Cost`) — project-wide spend breakdown.

For a Tinker check on raw `cost_usd`:

```bash
docker compose exec app php artisan tinker
$token = \App\Models\ApiToken::query()->where('name', 'tenant-42')->first();
$spent = \App\Models\GatewayLog::query()
    ->where('api_token_id', $token->id)
    ->where('created_at', '>=', now()->startOfMonth())
    ->sum('cost_usd');
echo "spent: \${$spent} | cap: \${$token->monthly_budget_usd_cap}\n";
```

---

Next: **[SSRF Protection](/security/ssrf/)**.

---

> © Akyros Labs LLC. All rights reserved.
