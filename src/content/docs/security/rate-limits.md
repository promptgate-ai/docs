---
title: Rate Limits
description: Per-endpoint per-minute / per-hour caps. Cache-backed, returns 429 + Retry-After.
---

PromptGate's rate limits are **per-endpoint**, with **per-minute** and **per-hour** windows that are independent of each other. Configurable on AI Gateway endpoints and API Gateway endpoints. When exceeded, the gateway returns **429** with a `Retry-After` header so well-behaved clients can back off precisely.

## Where they live

In the endpoint config:

| Field | AI Gateway | API Gateway |
|---|---|---|
| `rate_limit_per_minute` | ✅ | ✅ |
| `rate_limit_per_hour` | ✅ | ✅ |

Both are integers. **`null` means no limit** for that window. You can set one, both, or neither.

## How it works

Each endpoint has two independent counters, scoped by namespace + endpoint UUID + the bucket window:

```
rl:ep:{endpoint-uuid}:m:{minute-bucket}
rl:ep:{endpoint-uuid}:h:{hour-bucket}
```

(`ep` for AI Gateway endpoints, `ag` for API Gateway endpoints — independent namespaces, no collision.)

The bucket key is `floor(now / 60)` for minute or `floor(now / 3600)` for hour. So all requests in the same wall-clock minute share a bucket, regardless of when the first one arrived.

Increment happens atomically:

1. `Cache::add(key, 0, ttl)` — initialises the bucket on first hit (no-op if exists).
2. `Cache::increment(key)` — atomic +1, returns new value.
3. If the new value > the cap, return 429 + `Retry-After: <seconds left in bucket>`.

This works with any cache driver — file, array, redis, database — because both `add` and `increment` are atomic primitives Laravel's cache layer guarantees.

## What it doesn't do (yet)

- ❌ **Per-token** rate limits — e.g. "user X can make 10 RPS". Roadmap.
- ❌ **Per-IP** rate limits. Roadmap.
- ❌ **Sliding windows** — bucket boundaries are wall-clock-aligned, not request-aligned. A burst at 13:59:55 + 14:00:05 in a 1/min limit succeeds: each falls in a different bucket. Sliding-window is more accurate but more expensive.
- ❌ **Token-bucket** style burst allowances. The current shape is fixed-window.

For most gateway use cases, fixed-window is fine. If you need precise SLA-grade rate limiting, put a dedicated rate limiter (Envoy, Kong, etc.) in front of PromptGate.

## Behaviour

When the limit is hit:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 38
Content-Type: application/json

{
  "ok": false,
  "error": "Rate limit exceeded.",
  "scope": "minute",
  "retry_after": 38
}
```

The `scope` field tells you which window tripped (`minute` or `hour`). `retry_after` is the seconds remaining in the breached bucket (so well-behaved clients can wait exactly the right amount before retrying).

## Configuration

### AI Gateway

Endpoint wizard → **Tab 3 — Limits**:

```
Rate limit per minute: 60       (or empty = unlimited)
Rate limit per hour:   1000     (or empty = unlimited)
```

### API Gateway

Endpoint form → **Rate Limits** section. Same fields, same semantics.

## Examples

### Public-facing demo

```
rate_limit_per_minute: 6
rate_limit_per_hour:   60
```

A user gets ~one request every 10 seconds and hits the wall after an hour.

### Internal service caller

```
rate_limit_per_minute: 600
rate_limit_per_hour:   30000
```

Protects against runaway bugs without throttling normal traffic.

### Disabled (default)

```
rate_limit_per_minute: null
rate_limit_per_hour:   null
```

No limits. Useful for trusted internal callers where you'd rather catch problems via budgets and audit logs.

## Stacking with budgets

Rate limits and budgets are independent:

- **Rate limits** = "how often can you call?"
- **Budgets** = "how much can you spend?"

A token-cheap endpoint can have a high rate limit and a low monthly budget. A token-expensive endpoint can have a tight rate limit and a generous budget. Set them according to what each one actually protects.

See **[Budgets](/security/budgets/)**.

## Cache driver

Production should use **Redis** (`CACHE_STORE=redis`). The default `database` driver works but adds a DB hit per request — fine for low traffic, not great at scale. `array` doesn't survive across requests so it disables rate limits in practice (only set in tests).

## Inspecting current usage

There's no first-class "current bucket count" UI. To check via Tinker:

```bash
docker compose exec app php artisan tinker
\Illuminate\Support\Facades\Cache::get('rl:ep:abc-123:m:35198421');
```

Where the UUID is your endpoint's UUID and the integer is the current minute bucket.

## Behaviour summary

| Configuration | Result |
|---|---|
| Both null | No limit. |
| Per-minute only | Per-minute enforced; per-hour unlimited. |
| Per-hour only | Per-hour enforced; per-minute unlimited. |
| Both set | Both enforced independently. The first to trip fires 429. |

---

Next: **[Budgets](/security/budgets/)**.

---

> © Akyros Labs LLC. All rights reserved.
