---
title: Metrics
description: Project-scoped traffic, tokens, latency, and error rate charts.
---

Project sidebar → **Metrics** opens the per-project metrics page. Same data backbone as the Dashboard (`gateway_logs`), filtered to the active project.

## What's on it

![Metrics — placeholder](#)

### KPI strip

Four cards at the top:

| KPI | Window |
|---|---|
| Requests | Last 24h, with 7d hint |
| Tokens | Last 24h, with 30d hint |
| Avg Latency | Last 24h |
| Error Rate | Last 24h |

### Charts

Two side-by-side area charts:

- **Requests / day (30d)** — daily request count, segmented by provider.
- **Tokens / day (30d)** — daily token total, segmented by provider.

Plus a latency histogram (p50, p95, p99) over the same window.

### Provider breakdown

Stacked bar showing the share of traffic per provider over the last 24h.

### Top endpoints (this project)

Top 5 endpoints in this project by request count, with status / latency / token counts. Click an endpoint to jump to its detail page.

### Recent activity (this project)

Last 50 entries from `audit_logs` filtered to this project.

## Filter

A small time-range picker at the top of the page lets you switch between 24h / 7d / 30d. The charts and KPIs update accordingly.

## Behind the scenes

`MetricsController::index` runs ~6 queries against `gateway_logs` filtered by `project_id` plus the time window. None of them are in real time — pages render in 50–200ms typically. If your `gateway_logs` is huge, see [Database Setup → Tuning](/getting-started/database/#tuning-for-production) for index hints.

## Difference from Dashboard

- **Dashboard**: gateway-wide, includes all projects.
- **Metrics**: scoped to one project.

Use metrics when you're investigating a specific project's behaviour.

## What it doesn't include (yet)

- ❌ Per-endpoint sparklines on the metrics page itself (you have to click into the endpoint).
- ❌ Custom dashboards.
- ❌ Alerting (use webhooks for that — fire on `gateway_log.error` or audit events).

For Prometheus / Grafana style dashboards, you can pull the data directly from `gateway_logs` via SQL or via a small adapter.

---

Next: **[Live Logs](/observability/live-logs/)**.

---

> © Akyros Labs LLC. All rights reserved.
