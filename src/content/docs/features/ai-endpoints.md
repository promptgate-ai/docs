---
title: AI Endpoints
description: Fixed-prompt, fixed-provider AI endpoints with sessions, schemas, streaming, failover, guardrails, rate limits, and budgets.
---

AI Endpoints are the core building block of an `ai_gateway` project. Each endpoint defines a fixed system prompt, a provider configuration, and runtime settings. Your application sends user input to the endpoint URL; PromptGate runs guardrails, applies the prompts, calls the upstream model, validates the output, logs the result, and returns the response.

## Anatomy

```
POST /api/{project_uuid}/{endpoint_slug}
        │
        ▼
┌────────────────────────────┐
│ Token + scope check        │
│ Rate limit                 │
│ Budget check               │
│ Guardrails                 │
│ Input schema validation    │
│ System prompt + template   │
│ Provider call (+failover)  │
│ Output schema validation   │
│ Log + audit                │
└────────────────────────────┘
        │
        ▼
        Response
```

## Creating an endpoint

In your `ai_gateway` project: sidebar → **AI Endpoints** → **+ New endpoint**.

The wizard has 7 tabs. Only the first two are required; the rest have sensible defaults.

![Endpoint wizard — placeholder](#)

### Tab 1 — Core

| Field | Notes |
|---|---|
| **Name** | Shown in the UI and logs. |
| **Slug** | URL path segment. Auto-generated from name; editable. |
| **Description** | Optional notes for human readers. |
| **Expose as MCP tool** | Toggle. When on, the project's MCP Bridge serves this endpoint to MCP clients. |

The endpoint URL is `POST /api/{project_uuid}/{slug}`.

### Tab 2 — Provider

Two modes:

**Provider Template (recommended)** — pick a pre-baked bundle that already pairs a provider, model, and credential. The endpoint inherits everything; you can override `temperature`, `top_p`, `max_tokens` on the endpoint without touching the template.

**Manual** — pick each piece individually:

- **Provider** — `openai`, `anthropic`, `google`, `mistral`, `groq`, `together`, `ollama`, `cohere`
- **Model** — provider-specific identifier (`gpt-4o-mini`, `claude-3-5-sonnet-20241022`, …)
- **Credential** — list filtered by provider

**Failover** — optional list of backup `(credential, model)` pairs. When the primary call throws (5xx, timeout, rate limit), PromptGate retries the next entry. Runtime settings (temperature, top_p, max_tokens) are reused from the endpoint, not from the failover entry.

**Runtime settings:**

| Field | Range | Notes |
|---|---|---|
| `temperature` | 0–2 | 0 = deterministic, 1 = default, 2 = creative |
| `top_p` | 0–1 | Nucleus sampling. Don't tune both temp and top_p. |
| `max_output_tokens` | 1–200 000 | Hard cap per response. |

### Tab 3 — Limits

Cost / volume protection. Empty fields = unlimited.

| Field | Type | Behaviour |
|---|---|---|
| `usage_hard_limit_tokens` | int | Per-request cap on input tokens (~4 chars/token estimate). 422 if exceeded. |
| `monthly_budget_usd` | decimal | Cumulative ceiling per calendar month. |
| `estimated_cost_per_1k_tokens_usd` | decimal | Required if you set monthly_budget_usd — used to compute spend. |
| `rate_limit_per_minute` | int | 429 + Retry-After when exceeded. |
| `rate_limit_per_hour` | int | Independent second window. |

See **[Budgets](/security/budgets/)** and **[Rate Limits](/security/rate-limits/)** for the enforcement details.

### Tab 4 — Streaming

Toggle Server-Sent Events. When **on** and the client sends `"stream": true`:

- Response is streamed as `data:`-prefixed JSON chunks
- Each chunk has the OpenAI Chat Completion shape (delta inside `choices[0].delta.content`)
- Final chunk is `data: [DONE]`

When **off**, `stream: true` from the client is ignored.

See **[Streaming](/features/streaming/)** for the SSE format and client examples.

### Tab 5 — Sessions

Server-side conversation state. When **enabled**:

| Field | Notes |
|---|---|
| `session_ttl_seconds` | Auto-expire idle sessions (60–604800). |
| `session_max_messages` | Cap on the conversation length (1–500). |
| `session_max_tokens` | Optional total token cap. |

The gateway creates a session on the first request and returns `meta.session_id`. Subsequent requests include `session_id` to resume.

See **[Sessions](/features/sessions/)** for the flow + edge cases.

### Tab 6 — Prompt

| Field | Notes |
|---|---|
| `prompt` | System message prepended to every request. |
| `user_prompt_template` | Wraps the user's input. Use `{{input}}` as the placeholder. |

If `user_prompt_template` is empty, the user's message is passed through unchanged.

Example template:

```
You are responding to a customer support ticket.

Ticket from user:
{{input}}

Reply concisely.
```

### Tab 7 — Schema

JSON Schema validation, both directions.

| Field | Notes |
|---|---|
| `input_schema` | Validates the request payload. 422 if invalid. |
| `output_schema` | Validates the model's response content. 502 if invalid. |

See **[JSON Schema Validation](/features/schemas/)**.

## Calling an endpoint

### curl — single message

```bash
curl -X POST $URL/api/$UUID/$SLUG \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain quantum computing."}'
```

### curl — full conversation

```bash
curl -X POST $URL/api/$UUID/$SLUG \
  -H "Authorization: Bearer pg_live_..." \
  -d '{
    "messages": [
      {"role": "user", "content": "What is AI?"},
      {"role": "assistant", "content": "AI is..."},
      {"role": "user", "content": "Tell me more."}
    ]
  }'
```

### Python (requests)

```python
import os, requests

resp = requests.post(
    f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/{os.environ['PG_SLUG']}",
    headers={"Authorization": f"Bearer {os.environ['PG_TOKEN']}"},
    json={"message": "Explain quantum computing."},
    timeout=120,
)
resp.raise_for_status()
print(resp.json()["content"])
```

### Node.js (fetch)

```js
const url = `${process.env.PG_URL}/api/${process.env.PG_UUID}/${process.env.PG_SLUG}`;
const r = await fetch(url, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.PG_TOKEN}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Explain quantum computing.' }),
});
const data = await r.json();
console.log(data.content);
```

### With sessions

First request creates the session:

```json
POST .../my-chat
{ "message": "Hello, my name is Sam." }
```

Response:

```json
{
  "ok": true,
  "content": "Nice to meet you, Sam!",
  "meta": { "session_id": "0e2f...c4" }
}
```

Subsequent requests pass `session_id`:

```json
POST .../my-chat
{
  "message": "What's my name?",
  "session_id": "0e2f...c4"
}
```

The gateway prepends the stored history before calling the model.

### With streaming

```bash
curl -N -X POST $URL/api/$UUID/$SLUG \
  -H "Authorization: Bearer pg_live_..." \
  -d '{"message": "Write a poem.", "stream": true}'
```

The `-N` flag disables curl's output buffering so chunks land as they arrive.

## Endpoint list

The index page shows every endpoint for the project with:

- Name + slug (with eye icon → bridge URL modal)
- Provider or template chip
- ON/OFF status (deactivated endpoints reject all calls)
- **MCP** chip when `expose_as_mcp_tool=true`
- Edit / Deactivate actions

The KPI strip at the top shows total / streaming / sessions / **MCP tools** counts.

## Endpoint detail

Clicking a row opens the detail page with:

- Live status (1h KPIs: RPS, p95, errors)
- Routing policy (provider, model, credential, failover chain)
- Recent trace (last 10 requests)
- Prompt + schema preview
- **MCP card** when exposed (tool name, bridge URL, curl example)

## Programmatic discovery

Tokens with `admin` scope can list endpoints:

```bash
curl $URL/api/$UUID/endpoints \
  -H "Authorization: Bearer pg_live_..."
```

Returns:

```json
{
  "ok": true,
  "data": [
    { "uuid": "...", "name": "Hello World", "slug": "hello-world", "is_active": true, "expose_as_mcp_tool": false }
  ]
}
```

## Behaviour reference

| Situation | Response |
|---|---|
| No bearer token | 401 |
| Token from different project | 403 |
| Wrong scope (`admin`-only on chat endpoint) | 403 |
| Endpoint inactive | 404 |
| Per-minute rate limit hit | 429 + `Retry-After` |
| Per-request token cap exceeded | 422 |
| Monthly budget exhausted | 422 |
| Guardrail blocks request | 422 |
| Input schema invalid | 422 |
| Provider error after failover | 502 |
| Output schema invalid | 502 |
| Successful chat | 200 |

## Common patterns

- **Locked-down product endpoint** — set system prompt, input/output schema, low monthly budget, mask-mode PII filter, `expose_as_mcp_tool=false`.
- **Internal-tools agent** — sessions on, no schemas, generous limits, expose_as_mcp_tool=true, MCP scope token issued to the agent.
- **Public-facing demo** — strict per-minute rate limit, low monthly budget, content-length guardrail, no sessions.

---

Next: **[AI Wrapper](/features/ai-wrapper/)** — OpenAI-compatible mode.

---

> © Akyros Labs LLC. All rights reserved.
