---
title: Embeddings
description: OpenAI-compatible /v1/embeddings on the AI Wrapper. Route by `model` to OpenAI, Mistral, Groq, Together, Ollama, or Cohere — same request shape, same response shape.
---

The AI Wrapper now exposes `/v1/embeddings`, OpenAI-compatible, so RAG pipelines can route through PromptGate just like chat. Send the OpenAI-shaped request, get the OpenAI-shaped response, regardless of which provider answers.

## Request

```http
POST /api/{projectUuid}/v1/embeddings
Authorization: Bearer pg_live_…
Content-Type: application/json

{
  "model": "openai:text-embedding-3-small",
  "input": "Embed this sentence."
}
```

`input` accepts a single string or an array of strings (up to the provider's batch limit). Optional fields:

| Field | Where it applies |
|---|---|
| `dimensions` | OpenAI / Mistral — request a smaller vector |
| `input_type` | Cohere — `search_document` (default), `search_query`, `classification`, `clustering` |

## Response

```json
{
  "object": "list",
  "data": [
    { "object": "embedding", "index": 0, "embedding": [0.1, 0.2, …] }
  ],
  "model": "text-embedding-3-small",
  "usage": { "prompt_tokens": 3, "total_tokens": 3 }
}
```

Same envelope no matter who served it. Vectors come back as `float[]` (already parsed from JSON).

## Provider matrix

| Provider | Implementation | Notes |
|---|---|---|
| OpenAI | `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` | `dimensions` supported on `-3-*` models |
| Mistral | `mistral-embed` | Same OpenAI shape |
| Groq | (not currently — Groq doesn't host embeddings) | Returns 400 |
| Together AI | OpenAI-shaped embeddings | Pass-through |
| Ollama | local embeddings models | Pass-through |
| Cohere | `embed-english-v3.0`, `embed-multilingual-v3.0`, … | Translated: `texts` + `input_type` upstream, normalized response |
| Anthropic | (Anthropic has no embeddings API) | Returns 400 |
| Google | (planned) | Returns 400 |

If you point the wrapper at a provider without embeddings support, you get a 400 with `"error.message": "Provider :p does not support embeddings."` — fail loud, don't pretend.

## Routing via aliases

The same wrapper-alias / preset machinery that routes chat works for embeddings. Define an alias `model: "embed:fast"` in the wrapper and route it to `openai:text-embedding-3-small`. Clients call the alias, you swap the underlying provider any time without touching their code.

## Cost & observability

Today: embedding calls are not yet logged into `gateway_logs` (the table is shaped for chat). They go through the provider directly. We'll add a dedicated `embedding_logs` table or extend `gateway_logs` with an `op_type` column in a follow-up — for now, embeddings live "outside" the cost dashboard. The provider's own usage dashboard is the source of truth for the bill.

## Limitations (v1)

- No caching yet (chat-cache hash is shaped around `messages`, not `input`).
- No streaming (embeddings have no streaming concept).
- Single endpoint (the wrapper). AI Gateway endpoints don't have an `embeddings` request shape — they're chat-shaped by design.

---

> © Akyros Labs LLC. All rights reserved.
