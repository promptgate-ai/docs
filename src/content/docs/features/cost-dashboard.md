---
title: Cost Dashboard
description: Per-provider, per-endpoint, per-token spend computed from gateway_logs × the configured rate per 1k tokens — plus a "saved by cache" block.
---

The Cost Dashboard at `/projects/{p}/cost` answers one question: **where is the money going, and how much is the cache saving?**. It joins every row in `gateway_logs` against the per-endpoint `estimated_cost_per_1k_tokens_usd` rate and rolls up the results.

## What it shows

- **Spend (24h / MTD)** with last-month comparison.
- **Cache saved (24h / MTD)** — money the cache prevented from leaving the bank.
- **Cache save %** — share of would-be MTD cost served from cache.
- **Spend / day (30d)** stacked chart with billed vs cache-saved bars.
- **By endpoint (30d)** — requests, tokens, rate, 30-day cost, cache hit %.
- **By provider (30d)** — token volume + 30-day cost.
- **Top tokens (30d)** — which API tokens drove the spend.

## How "cost" is computed

For each `gateway_logs` row:

```
billable_tokens = total_tokens   (or 0 if cache_hit)
cost            = (billable_tokens / 1000) × endpoint.estimated_cost_per_1k_tokens_usd
saved           = (cached_tokens  / 1000) × endpoint.estimated_cost_per_1k_tokens_usd  (when cache_hit)
```

If an endpoint has no rate set, its rows contribute zero cost — they still show up in token counts so you can spot rate gaps.

## Limitations

- **Estimated, not invoiced** — provider invoices include taxes, contracts, and rounding the dashboard doesn't see. Use it for trend, not bookkeeping.
- **Per-endpoint flat rate** — input vs output token pricing differences aren't modelled (most provider price sheets do separate them). If you need that fidelity, set the rate to a blended weight.
- **Retention applies** — Community Edition keeps 7 days of `gateway_logs`. The 30d window naturally truncates there until the row count grows.

---

> © Akyros Labs LLC. All rights reserved.
