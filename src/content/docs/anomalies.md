---
title: "Anomaly alerts"
description: "A running gateway compares every AI Gateway endpoint with its own past. Five seconds after each five-minute window ends, it looks at the window's"
---

<!-- Generated from docs/anomalies.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

A running gateway compares every [AI Gateway endpoint](/endpoints/)
with its own past. Five seconds after each five-minute window ends, it
looks at the window's

| signal | value |
|---|---|
| `error_rate` | failed requests / requests |
| `latency_p95` | 95th percentile duration of successful requests |
| `spend` | cost in USD from the price table |

and holds it against the endpoint's five-minute windows of the last
seven days: an anomaly is a value above *median + sensitivity × scaled
MAD* (median absolute deviation), with floors so small wobbles stay
quiet (5 points of error rate, 10 % and 50 ms of latency, 25 % and
$0.01 of spend). Only rises count. A window needs `min_requests`, and a
baseline six such windows.

```yaml
anomalies:
  enabled: true      # default; needs the request log
  sensitivity: 3.5   # higher is calmer
  min_requests: 5
```

Each anomaly is

- a warning in the gateway's log: `endpoint anomaly endpoint=faq
  signal=error_rate value=0.6 usual=0.05 threshold=0.23 window=14:35`,
- a row in the request log, shown by `promptgate anomalies [--since 24h]
  [--json]`,
- `promptgate_anomaly{endpoint, signal} 1` on the [metrics](/metrics/)
  endpoint while the latest window is anomalous — alert on it in
  Prometheus / Alertmanager.

The checks read the per-minute stats the request log keeps, so requests
pay nothing for them. Each new anomaly and its end are published as
[events](/events/) (`anomaly.detected`, `anomaly.resolved`).

Compared with v1: latency compares p95 with p95 (v1 compared p95 with
averages and over-alerted), and spend uses the price table.
