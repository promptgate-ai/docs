---
title: Live Logs
description: Auto-refreshing tail of gateway_logs for the active project — filter syntax, request/response inspector, pause/resume.
---

Project sidebar → **Live Logs** is a real-time view of the project's gateway requests. Every request lands in `gateway_logs`; the Live Logs page polls for new rows and renders them as a stream.

## What's on it

![Live Logs — placeholder](#)

| Column | Meaning |
|---|---|
| Time | `created_at` formatted as `HH:mm:ss.mmm` |
| Status | `ok` / `error` (coloured chip) |
| Endpoint | Slug, with link |
| Provider | Provider key + model |
| Latency | `latency_ms` |
| Tokens | `total_tokens` |
| Action | "View" — opens the modal |

The newest rows are at the top.

## Auto-refresh

Default: **poll every 2 seconds**. New rows slide in.

Click **Pause** to freeze the view (useful when reading a specific request without it scrolling away). Click **Resume** to restart.

## Filter syntax

The search box accepts a small DSL:

| Filter | Effect |
|---|---|
| `status:ok` / `status:error` | Filter by status |
| `provider:openai` | Filter by provider key |
| `model:gpt-4o-mini` | Filter by provider_model |
| `endpoint:my-slug` | Filter by endpoint_slug |
| `error:timeout` | Substring match on error_message |
| Bare text | Substring match across all fields |

Combine: `status:error provider:openai endpoint:summarize`.

## The request modal

Click **View** on a row → a modal with three tabs:

### Tab 1 — Request

Shows the **request body** (JSON-pretty-printed). For chat completions, that's the messages array.

### Tab 2 — Response

Shows the **assistant content** plus token counts and finish reason.

### Tab 3 — Raw

Full `gateway_logs` row as JSON: every column, every metadata field. Useful when debugging the audit / log pipeline itself.

## Performance + privacy

- The poll endpoint returns at most 50 new rows per call — `id > $last_seen_id`.
- Logs include the **request body** by default. If your endpoint receives sensitive data, consider redacting it via a guardrail (e.g. mask-mode PII filter) so the log entry itself is sanitised.
- Logs persist forever by default. Prune via `php artisan tinker` if you need to (see [Database Setup](/getting-started/database/#pruning-old-logs)).

## Linking from elsewhere

The endpoint detail page's "Recent trace" links to **Live Logs filtered to that endpoint**. So you can drill from a 1h KPI down to the actual requests behind it.

## Limitations

- ❌ No streaming via SSE — the page polls. Truly live (push) is a roadmap item; for most volumes 2-second polling is indistinguishable.
- ❌ No export to CSV from Live Logs (use the Audit Log's CSV export for forensic purposes — gateway logs export is roadmap).
- ❌ Filter is in-memory after fetch; it doesn't push the filter to the database. So very-busy gateways may see slight lag when filtering by rare values.

---

Next: **[Playground](/observability/playground/)**.

---

> © Akyros Labs LLC. All rights reserved.
