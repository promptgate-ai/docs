---
title: Replay from Logs
description: Re-run any logged request through the current endpoint config — edit the messages, see what changes, log the lineage with parent_request_id.
---

Replay lets you take any row in **Live Logs** and re-execute it through the **current** endpoint configuration: same provider, same prompts, same guardrails, same schemas, same routing rules — whatever they look like *now*. The original request is untouched; the replay is a brand-new log row, linked back via `parent_request_id`.

## When it's useful

| Situation | Replay answer |
|---|---|
| You changed an endpoint's system prompt — does yesterday's failing request now pass? | Replay it. |
| A guardrail flagged an input incorrectly — adjust the rule, replay, confirm. |
| You added a routing rule for long inputs — replay a real long-input log to verify it routes correctly. |
| A provider switched models — replay a few representative requests to compare cost/latency. |

## How to use

1. Open **Live Logs** for the project.
2. Click any row. The detail modal opens.
3. Switch to the **Replay** tab. The original messages are pre-filled in a JSON editor.
4. Edit if you want, then hit **Run replay**.
5. The result appears inline. A new log row shows up at the top of the table, with `parent_request_id` pointing back at the source.

## What replay does *not* do

- **No session attachment** — replays don't append to `endpoint_sessions`. They're investigations, not real traffic.
- **No rate limit consumption** — replays bypass per-endpoint rate limits (they're admin-initiated through the web UI, not API tokens).
- **No audit silence** — every replay writes a `gateway.replay` audit entry with `source_request_id`, `new_request_id`, and final status, so the activity log is honest about what was admin-driven.

## Data model

A new column `parent_request_id` (uuid, nullable, indexed) on `gateway_logs` references the original `request_id`. Queries:

```sql
-- All replays of a specific request
SELECT * FROM gateway_logs WHERE parent_request_id = '<uuid>';

-- Original + every replay, oldest first
SELECT * FROM gateway_logs
WHERE request_id = '<uuid>' OR parent_request_id = '<uuid>'
ORDER BY created_at;
```

Retention policy still applies: in **Community Edition**, replays older than 7 days are pruned along with the rest of `gateway_logs`. The chain stays intact for as long as both rows survive.

---

> © Akyros Labs LLC. All rights reserved.
