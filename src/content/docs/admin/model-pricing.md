---
title: Model Pricing
description: Per-(provider, model) input + output rates used to compute cost on every request — auto-refreshed from the LiteLLM catalogue, overridable per row.
---

PromptGate computes the **dollar cost of every request at write time** using a per-(provider, model) input + output rate from the **model pricing catalogue**. The catalogue auto-refreshes daily from the community-maintained [LiteLLM pricing JSON](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) and accepts manual overrides that survive every subsequent refresh.

## Where the cost shows up

- Every row in `gateway_logs` carries a `cost_usd` column populated at write time.
- The **Cost Dashboard** (`/projects/{uuid}/cost`) sums these values for the 24-hour / month-to-date / 30-day rollups.
- The **Budget Enforcer** uses month-to-date `cost_usd` to enforce `monthly_budget_usd` caps.
- Per-request cost is shown in the **Playground** response footer.

## How a row is picked

Resolve order, given `(provider_key, model)` from a request:

1. **Manual exact match** — `(provider, model)` + `source = manual`.
2. **Auto exact match** — `(provider, model)` + `source = auto`.
3. **Longest-prefix fallback** — a row whose model is a prefix of the request's model, longest first. E.g. `gpt-4o-mini` covers `gpt-4o-mini-2024-07-18`.
4. **Per-endpoint fallback** — the endpoint's own `estimated_cost_per_1k_tokens_usd` (blended total-tokens rate). Preserves the pre-catalogue behaviour.
5. **Null** — no cost logged for the row; Cost Dashboard reads it as zero.

## Admin: `/admin/pricing`

The page is split into three sections:

| Section | What it does |
|---|---|
| **KPI row** | Total rows, last-refresh status + age, count of unmapped models, schedule cadence. |
| **Unmapped models** | `(provider, model)` pairs seen in `gateway_logs` over the last 30 days that have no pricing row. "Map prices" pre-fills the modal with the pair locked, so you only set rates. |
| **Pricing catalogue** | All rows, paginated. Edit any auto row to flip it to `manual` (immune to future refreshes). Add a brand-new manual entry. |

The **Refresh now** button at the top right runs `php artisan pricing:refresh` on demand. Every run is captured in the **Recent refresh runs** disclosure with seen / added / updated / skipped counts.

## Refresh internals

The command `php artisan pricing:refresh` fetches the JSON, then for each row:

1. Reads `litellm_provider` and maps it to one of our provider keys: `openai`, `anthropic`, `google` (covers `gemini`, `vertex_ai-*`), `mistral`, `groq`, `cohere`, `together`, `ollama`. Anything else → **skipped**.
2. Strips the provider prefix off the LiteLLM key (`groq/llama3-70b-8192` → `llama3-70b-8192`).
3. Converts `input_cost_per_token` and `output_cost_per_token` (per token) to per-million for human-readable storage.
4. Upserts an `auto` row. **`manual` rows are never overwritten** — operator overrides win permanently.

Schedule lives in `routes/console.php`:

```php
Schedule::command('pricing:refresh')->dailyAt('04:30')->withoutOverlapping();
```

## Manual entries

Click **+ Add manual entry** to register a custom row. Use it for:

- **Enterprise contract rates** that differ from public pricing.
- **Models LiteLLM hasn't catalogued yet** (new releases, fine-tunes, private deployments).
- **Mapping unmapped models** seen in your logs.

Once saved, the row carries `source = manual` and is shown with a bright `manual` chip. Editing an existing `auto` row also flips it to `manual`.

## Data model

```sql
model_pricing
  id, provider_key, model,
  input_per_1m_usd, output_per_1m_usd,
  source ('auto' | 'manual'),
  notes,
  created_at, updated_at
  UNIQUE (provider_key, model)

model_pricing_refreshes
  id, source_url, status,
  models_seen, models_added, models_updated, models_skipped,
  error_message,
  started_at, finished_at
```

## API

The catalogue is **operator-only** for now — no public API surface. The `Management API` (`/api/v1/control/*`) does not yet expose pricing endpoints. If you need to bulk-load rates from IaC, run `php artisan pricing:refresh` from your provisioning step or seed the table via a custom seeder.
