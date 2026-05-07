---
title: Anomaly Alerts
description: 5-minute statistical detector that fires the endpoint.anomaly webhook when error rate, latency, or spend spikes more than 3.5 × MAD above the 7-day baseline median.
---

Anomaly Alerts watch every active AI Gateway endpoint for sudden changes in three signals — **error rate**, **p95 latency**, and **spend** — and fire the `endpoint.anomaly` webhook the moment a 5-minute window deviates significantly from its own 7-day pattern. No threshold to configure, no false-positive avalanche from short bursts.

## How detection works

Every 5 minutes (via the `promptgate:detect-anomalies` Artisan command, scheduled by the framework):

1. Collect the **current 5-minute snapshot** for the endpoint: total requests, errors, p95 latency, total tokens.
2. Walk back **7 days** of `gateway_logs` for the same endpoint and compute the same metric per 5-minute bucket → **baseline series**.
3. Compute **median** and **MAD** (median absolute deviation) of the baseline. MAD is a robust alternative to standard deviation that doesn't blow up on a single past spike.
4. Threshold = `median + 3.5 × MAD`. If the current value is above it, record an anomaly and fire the webhook.

Why MAD instead of stddev? One bad day a week ago shouldn't make today look "normal" forever after. MAD is bounded by the typical spread, not the worst case.

## Defaults

| Knob | Value | Why |
|---|---|---|
| Window | 5 minutes | Short enough to catch real outages, long enough to filter single-request flukes |
| Multiplier | 3.5 × MAD | ~99.5% of normal traffic stays under it |
| Min baseline samples | 6 | Below that we abstain — not enough history to judge |
| Min current samples | 5 | Don't alarm on a single failed test request |

## Webhook payload

`endpoint.anomaly`:

```json
{
  "endpoint_slug": "summarize",
  "kind": "error_rate",
  "current_value": 66.6,
  "baseline_median": 0.5,
  "threshold": 8.7,
  "sample_count": 15,
  "window_seconds": 300,
  "detected_at": "2026-05-07T12:05:00+00:00"
}
```

`kind` is one of `error_rate`, `latency`, or `spend`. Values are in their natural units: percent, milliseconds, USD.

## Idempotency

Anomalies are bucketed by 5-minute windows. Re-running the detector over the same window for the same endpoint + kind never creates a duplicate row and never re-fires the webhook.

## UI

The Live Logs page surfaces a red **ANOMALIES · LAST 24H** panel above the request table when any anomaly fired in the last 24 hours, listing time, endpoint, kind, current value, and baseline median for each. Subscribe to the webhook for real notifications (Slack, PagerDuty, ops chat).

## Limitations (v1)

- AI Gateway endpoints only — API Gateway proxy traffic isn't analysed yet.
- Spend uses each endpoint's `estimated_cost_per_1k_tokens_usd`. Endpoints without a rate set never trigger spend anomalies.
- Single-multiplier rule. Per-endpoint sensitivity is a future iteration if real traffic demands it.

---

> © Akyros Labs LLC. All rights reserved.
