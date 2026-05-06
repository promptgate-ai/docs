---
title: Sessions
description: Server-side conversation state for AI Gateway endpoints.
---

A **session** is server-side conversation state attached to one AI Gateway endpoint. The client passes a `session_id` on every request; PromptGate prepends the stored history before calling the model.

This is opt-in per endpoint and exists because:

- You don't want to ship the entire transcript with every request.
- You want enforcement of message / token caps that survive across restarts.
- You want sessions purged automatically when idle.

## Enabling sessions

On the endpoint wizard, **Tab 5 — Session**:

- **Sessions enabled** — toggle.
- **Session TTL (seconds)** — `60`–`604800` (1 minute–7 days). Idle sessions auto-expire.
- **Max messages** — `1`–`500`. Cap on the conversation length.
- **Max tokens** — optional total token cap (sum of `prompt + completion` across all turns).

Saving the endpoint with sessions enabled means subsequent calls **may** include `session_id`. They don't have to — if absent, no state is recorded for that request.

## Lifecycle

```
┌─ First call ─────────────────────────────────────────────┐
│  POST /api/X/my-chat                                     │
│  { "message": "Hello, my name is Sam." }                 │
│                                                          │
│  → Gateway creates a new endpoint_session row,           │
│    stores the user message + assistant reply,            │
│    returns:                                              │
│  {                                                       │
│    "ok": true,                                           │
│    "content": "Nice to meet you, Sam!",                  │
│    "meta": { "session_id": "0e2f...c4" }                 │
│  }                                                       │
└──────────────────────────────────────────────────────────┘

┌─ Subsequent calls ───────────────────────────────────────┐
│  POST /api/X/my-chat                                     │
│  {                                                       │
│    "message": "What's my name?",                         │
│    "session_id": "0e2f...c4"                             │
│  }                                                       │
│                                                          │
│  → Gateway loads stored history (system prompt + every   │
│    prior turn), prepends to messages, calls provider,    │
│    appends new turn to storage, returns the same         │
│    session_id.                                           │
└──────────────────────────────────────────────────────────┘
```

The token that created the session is the only one that can use it. Other tokens get a 403.

## Enforcement

| Trigger | Response |
|---|---|
| `session_id` not found OR belongs to a different token | 403 |
| Session expired (idle > TTL) | 410 — and the row is deleted |
| `max_messages` reached on next turn | 429 |
| `max_tokens` would be exceeded | 429 |

Sessions are **purged hourly** by the scheduler — the cleanup deletes any session whose `last_activity_at < now - ttl`. This keeps `endpoint_sessions` from growing unbounded.

## Storage

Each turn writes one row in `endpoint_session_messages` (or however your migration names it — check `database/migrations/`). The row stores the role, content, prompt + completion tokens, and timestamps. The session row itself tracks `total_messages`, `total_tokens`, `last_activity_at`.

## Streaming and sessions

You can combine the two: enable both on the endpoint, send `"stream": true` with a `session_id`. The streaming response still ends with `[DONE]` and the gateway records the assistant's full content into the session after the stream closes.

## Cleaning up

Sessions older than the TTL are deleted automatically. To wipe all sessions for an endpoint manually:

```bash
docker compose exec app php artisan tinker
\App\Models\EndpointSession::query()->where('endpoint_id', 42)->delete();
```

## When to use sessions

✅ Conversational endpoints where the user expects continuity.
✅ Multi-turn agents where you want server-enforced caps.
✅ Compliance scenarios where the conversation has to be logged server-side regardless of client behaviour.

❌ Stateless endpoints (one-shot summarise, classify, translate). Skip sessions; the client doesn't need them.
❌ Public-facing demos. Sessions hold context — anonymous users sharing one token would leak each other's transcripts.

---

Next: **[JSON Schema Validation](/features/schemas/)**.

---

> © Akyros Labs LLC. All rights reserved.
