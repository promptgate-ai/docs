---
title: "Operations"
description: "What PromptGate tells the people who run it: every request in a log and in numbers, events when something needs attention, a tamper-evident trail of every…"
---

<!-- Generated from docs/operations.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

What PromptGate tells the people who run it: every request in a log
and in numbers, events when something needs attention, a tamper-evident
trail of every change, and alerts when an endpoint behaves unlike
itself.

## What PromptGate reports

| feature | does | |
|---|---|---|
| request log | every request — model, MCP, API — with key, [end user](/users/), status, tokens, cost and timing; `promptgate logs`, `stats` | [configuration](/configuration/#request-log-and-pricing) |
| metrics | Prometheus on a separate port: requests, latency, tokens, cost, spend, guardrail findings, webhooks, MCP and API traffic | [metrics](/metrics/) |
| events | a budget running out, a provider failing, an MCP server down, an OAuth connection that needs a person, a list that can't be fetched | [events](/events/) |
| webhooks | events sent to your URL, signed (Standard Webhooks), retried for two days; `promptgate webhooks` lists, tests and redelivers | [webhooks](/webhooks/) |
| audit trail | every change and sign-in from the web UI, the CLI and agents, hash-chained so a changed or deleted entry shows; `audit verify` | [audit](/audit/) |
| anomaly alerts | each AI Gateway endpoint against its own past week: error rate, latency, spend | [anomalies](/anomalies/) |

Everything in one config:

```yaml
logging:
  retention: 7d                    # request rows
  stats_retention: 90d             # per-minute totals behind stats and budgets
metrics:
  listen: 127.0.0.1:9464           # off by default
  token: ${PROMPTGATE_METRICS_TOKEN}
webhooks:
  ops-alerts:
    url: https://hooks.example.com/promptgate
    secret: ${PROMPTGATE_WEBHOOK_SECRET}     # whsec_… or 24+ bytes
    events: [budget.*, provider.failing, mcp.server_down]
  siem:
    url: https://siem.internal.example/ingest
    secret: ${SIEM_WEBHOOK_SECRET}
    events: ["*"]                  # every event, audit entries included
    private: true                  # the receiver is on a private network
audit:
  retention: 400d                  # default: kept forever
anomalies:
  sensitivity: 3.5                 # higher is calmer
```

The log writer, the audit trail and webhook deliveries work in the
background, off the request path.
