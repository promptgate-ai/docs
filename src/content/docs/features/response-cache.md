---
title: Response Cache
description: Per-endpoint exact-match response cache that returns identical requests from disk inside the configured TTL — cuts upstream cost without semantic guessing.
---

The Response Cache is an opt-in, per-endpoint, exact-match cache. When two requests hit the same endpoint with the same model, options, and messages, the second one is served from disk inside the TTL window — no provider call, no token spend, no latency. The cache is **deliberately conservative**: it only matches identical inputs, so it never returns a "close enough" answer.

## Configure

`Endpoints → (your endpoint) → Limits` tab. Two fields:

- **Enable exact-match cache** — checkbox.
- **TTL (seconds)** — how long a cached entry stays valid. Required (a missing TTL means the cache is inactive even when enabled — defensive).

Suggested starting points: **60s** for chat-style endpoints with high duplication, **3600s** for FAQ-shaped endpoints, **86400s** (1 day) for code-generation endpoints with long-stable prompts.

## What's in the cache key

The cache key is a sha256 over:

- the endpoint id (so two endpoints sharing a model don't share entries)
- the **resolved** provider + model after routing rules run
- the request's options (`temperature`, `top_p`, `max_tokens`)
- the **post-prompt-injection** messages array (so the system prompt + template are part of the key)

Practical consequence: changing the system prompt, swapping the model in routing, or tweaking temperature **invalidates the cache automatically** — the new requests just hash to a new key. Old entries age out via TTL.

## What's *not* cached

| Case | Why |
|---|---|
| Streaming requests | The client expects SSE chunks; we only cache the consolidated non-streaming response. |
| Replays from logs | Replays have `parent_request_id`; they're investigations, not real traffic — they always run live. |
| Failed requests | Errors are not deterministic enough to be useful as cache hits. |
| Wrapper API (`/v1/chat/completions`) | First version is AI Gateway endpoints only. Wrapper caching is a future iteration. |

## Observability

- The Live Logs row shows a **CACHE** chip when the request was served from cache.
- The detail-modal title appends "CACHE HIT" so you don't miss it when scrolling.
- The Live Logs page header has a **CACHE HIT %** KPI showing the share of OK requests served from cache.

```sql
-- Cache hits by endpoint last 24h
SELECT endpoint_slug, COUNT(*) AS hits
FROM gateway_logs
WHERE cache_hit = TRUE
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY hits DESC;
```

## Storage

Cache entries live in the dedicated `endpoint_response_cache` table (not Laravel's general cache driver) so admins can inspect, purge, and rely on `gateway_logs`-style retention. Each row carries `expires_at`, `hit_count`, `provider_model`, prompt/completion/total tokens, and the response body.

Expired entries can be purged on demand with `ResponseCacheService::purgeExpired()`; future iterations will add this to the daily `promptgate:prune` schedule.

## Semantic caching

Exact-match is the foundation. Semantic caching (cosine-similarity match against prior request embeddings) is a follow-up — same configuration surface, different `cache_mode`, requires an embeddings provider. Enabling it on a Cloud-Edition endpoint will be a one-click change once shipped.

---

> © Akyros Labs LLC. All rights reserved.
