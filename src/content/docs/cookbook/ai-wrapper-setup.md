---
title: Recipe — Multi-provider AI Wrapper
description: Stand up an AI Wrapper that routes 'fast' to Groq, 'smart' to Anthropic, and 'cheap' to OpenAI mini — with one URL for clients.
---

The AI Wrapper isn't just an OpenAI proxy — it's a **multi-provider router**. This recipe sets up three aliases that map to three different providers, so the same client code can target whichever backend is appropriate for the task.

End state: your client sends `model: "fast"` for chat, `model: "smart"` for hard reasoning, `model: "cheap"` for batch jobs — and PromptGate routes each to the right upstream behind the scenes.

## Prerequisites

- AI Wrapper project created (see **[OpenAI via Gateway](/cookbook/openai-via-gateway/)**)
- Credentials registered for at least three providers (OpenAI, Anthropic, Groq)

## Step 1 — Bind providers in the wrapper

Project sidebar → **Providers**. Tick **Enabled** + assign a credential for each:

| Provider | Credential | Status |
|---|---|---|
| OpenAI | `OpenAI Production` | ✅ |
| Anthropic | `Anthropic Production` | ✅ |
| Groq | `Groq Production` | ✅ |

Other providers stay disabled.

## Step 2 — Define aliases

Project sidebar → **Aliases**. Add three:

| Alias | Provider | Model |
|---|---|---|
| `fast` | `groq` | `llama-3.1-8b-instant` |
| `smart` | `anthropic` | `claude-sonnet-4-6-20251001` |
| `cheap` | `openai` | `gpt-4o-mini` |

## Step 3 — Verify discovery

```bash
curl $PG_URL/api/$PG_UUID/v1/models \
  -H "Authorization: Bearer $PG_TOKEN" | jq
```

Expected output (excerpt):

```json
{
  "object": "list",
  "data": [
    { "id": "fast", "object": "model", "owned_by": "promptgate", "is_alias": true },
    { "id": "smart", "object": "model", "owned_by": "promptgate", "is_alias": true },
    { "id": "cheap", "object": "model", "owned_by": "promptgate", "is_alias": true },
    { "id": "openai:*", "object": "model", "owned_by": "promptgate", "is_alias": false },
    { "id": "anthropic:*", "object": "model", "owned_by": "promptgate", "is_alias": false },
    { "id": "groq:*", "object": "model", "owned_by": "promptgate", "is_alias": false }
  ]
}
```

So clients can use the aliases OR `provider:model` directly.

## Step 4 — Pick the right alias per call

```python
from openai import OpenAI

client = OpenAI(base_url=PG_BASE, api_key=PG_TOKEN)

# Quick UI chat — Groq is fast and cheap
client.chat.completions.create(model="fast", messages=[...])

# Complex reasoning — Anthropic Sonnet
client.chat.completions.create(model="smart", messages=[...])

# Batch summarisation — OpenAI mini, lots of throughput
client.chat.completions.create(model="cheap", messages=[...])
```

The client code is identical — the model picker becomes the router.

## Step 5 — Swap a provider, change nothing client-side

You realise Groq's `llama-3.1-8b-instant` is occasionally flaky and you'd rather use OpenAI's gpt-4o-mini for `fast` too:

- Edit the `fast` alias.
- Change Provider to `openai`, Model to `gpt-4o-mini`.
- Save.

Client code didn't change. Next request through `model: "fast"` lands at OpenAI.

## Step 6 — Per-provider observability

In Live Logs, filter by `provider:groq` to see only Groq-served requests. Or by `model:llama-3.1-8b-instant` to see Llama traffic specifically. The Metrics page shows per-provider breakdown out of the box.

This is invaluable when:

- One provider has an outage — you can spot it in seconds.
- You're A/B-testing two backends — see latency / token cost per provider.
- You're cost-attributing — separate spend by provider.

## Step 7 — Hard cap per alias (optional)

Aliases themselves don't carry rate limits or budgets — those are endpoint-level features. If you want per-alias enforcement:

1. Create an **AI Gateway** project (separate from this AI Wrapper).
2. Make one endpoint per "alias", with the right provider/model/credential.
3. Configure the rate limit / budget on each endpoint.

Trade-off: clients now use the AI Gateway's `/api/{uuid}/{slug}` URL shape, not the OpenAI-compatible `/v1/chat/completions`. So you lose drop-in OpenAI SDK support but gain per-endpoint policy.

For most use cases the wrapper is enough — gate at the **token** level (issue separate tokens for separate apps) and rely on the global guardrails for content safety.

## What you've built

- ✅ One URL for clients, three providers behind it.
- ✅ Friendly model names (`fast` / `smart` / `cheap`) decoupled from upstream.
- ✅ Live observability per provider.
- ✅ Trivially swappable backends — edit an alias, no code change.

---

Next: **[Proxy GitHub via OAuth](/cookbook/api-gateway-github-oauth/)**.

---

> © Akyros Labs LLC. All rights reserved.
