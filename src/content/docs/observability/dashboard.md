---
title: Dashboard
description: At-a-glance health view for the gateway — KPIs, traffic chart, top endpoints, recent activity.
---

The **Dashboard** is the landing page after login. It rolls up the most useful signals across all projects into one view: live throughput, error rate, latency, top endpoints, recent activity.

## What's on it

![Dashboard — placeholder](#)

### Hero strip

A live-updating row of large indicators:

- **Requests / sec** — instantaneous throughput (last 60s window).
- **Error rate** — `errors / total` over the last 60s. Coloured red if > 1%.
- **p95 latency** — 95th percentile latency (ok requests only) over the last 60s.

The strip refreshes every 5 seconds via a small JSON poll.

### KPI cards

Four cards summarising the past 24 hours:

| KPI | What it means |
|---|---|
| **Requests (24h)** | Total `gateway_logs` rows in the last 24h |
| **Tokens (24h)** | Sum of `total_tokens` |
| **Avg Latency** | Mean of `latency_ms` for `status=ok` rows |
| **Error Rate** | `count(error) / count(*)` as a percentage |

### Traffic chart

A stacked area chart of requests per hour over the past 7 days, segmented by `provider_key`. Lets you spot:

- Hourly cycles (morning peak, evening drop).
- Provider mix shifts (suddenly gpt-4o-mini-heavy after a config change).
- Outage signatures (cliff drops).

### Provider status panel

One row per registered provider:

- Status dot (ok / warn / err).
- Total requests / errors in the last 24h.
- Average latency.
- Active credentials count.

Same as the Providers admin page but condensed.

### Top endpoints

Top 5 endpoints by request count over the last 24h. Each row links to the endpoint detail page.

### Recent activity

Last 10 entries from `audit_logs`. Time-stamped, severity-coloured. Click to filter the audit log by that event.

## Refresh + cost

Most of the data comes from one query against `gateway_logs` and `audit_logs`, run on page load. The hero strip uses a separate small endpoint that returns just the live rates.

For high-volume gateways, consider:

- Indexing `gateway_logs(created_at, project_id, status)` if it's not already.
- Pruning old rows (`gateway_logs > 90d`) to keep queries fast.

## Project scope

The Dashboard is **gateway-wide** — it sums across every project. For project-scoped views, use **[Metrics](/observability/metrics/)** inside the project.

## When the gateway is fresh

A brand-new gateway with no traffic shows zero everywhere. That's expected. Walk through the **[Quick Start](/getting-started/quick-start/)** to send your first request — the dashboard updates immediately.

---

Next: **[Metrics](/observability/metrics/)** — project-scoped charts.

---

> © Akyros Labs LLC. All rights reserved.
