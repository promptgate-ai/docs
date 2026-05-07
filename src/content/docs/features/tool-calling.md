---
title: Tool / Function Calling
description: Pass `tools` and `tool_choice` through to any supported provider, get a normalized `tool_calls` array back regardless of provider quirks. Works for OpenAI-shaped APIs and Anthropic out of the box.
---

PromptGate routes tool / function-calling requests transparently. You send the OpenAI-shaped `tools` definition once, PromptGate translates it for whichever provider answers, and you get a uniform `tool_calls` array back — same shape no matter who served it.

## Send a tool call

```http
POST /api/{projectUuid}/{endpointSlug}
Authorization: Bearer pg_live_…
Content-Type: application/json

{
  "messages": [{ "role": "user", "content": "What's the weather in Berlin?" }],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Look up current weather for a city.",
      "parameters": {
        "type": "object",
        "properties": {
          "location": { "type": "string" },
          "unit": { "type": "string", "enum": ["c", "f"] }
        },
        "required": ["location"]
      }
    }
  }],
  "tool_choice": "auto"
}
```

`tool_choice` accepts the OpenAI vocabulary: `"auto"`, `"none"`, `"required"`, or an explicit `{"type":"function","function":{"name":"…"}}`. Anthropic and other backends are translated transparently.

## Normalized response

When the model decides to call a tool, the response carries a flat `tool_calls` array:

```json
{
  "ok": true,
  "data": {
    "id": "chatcmpl-…",
    "content": "",
    "model": "gpt-4o-mini",
    "finish_reason": "tool_calls",
    "tool_calls": [
      {
        "id": "call_a1",
        "name": "get_weather",
        "arguments": { "location": "Berlin", "unit": "c" }
      }
    ],
    "usage": { "prompt_tokens": 12, "completion_tokens": 5, "total_tokens": 17 }
  }
}
```

The `arguments` field is **already parsed** into a real object. OpenAI returns it as a JSON string upstream; PromptGate parses it for you. Anthropic returns it as an object; nothing to parse.

`tool_calls` is `null` when the model produced regular text. Use that as the branch condition in your client.

## Provider translation

| Provider | Inbound shape | Translation |
|---|---|---|
| OpenAI / Mistral / Groq / Together / Ollama | OpenAI-shaped | Pass-through |
| Anthropic | OpenAI-shaped (`{ type: "function", function: { … } }`) | Translated to `{ name, description, input_schema }`. `tool_choice` mapped: `"auto"` → `{type:"auto"}`, `"required"` → `{type:"any"}`, named → `{type:"tool", name}` |
| Cohere | (TBD) | Pass-through if already Cohere-shaped |

Already-native shapes pass through untouched, so if you target a single provider you can also send its raw format.

## Observability

- **Live Logs row** shows a `TOOL · N` chip when `tool_calls` is non-empty.
- **Detail modal** has a dedicated **Tool Calls** tab listing each call with name, id, and pretty-printed arguments.
- `gateway_logs.response_body.tool_calls` is queryable (the same JSON column already used for plain responses).

## Schema validation

If an endpoint has `output_schema` configured **and** the response carries tool calls, PromptGate **skips** schema validation (tool calls aren't text — they're structured invocations). Plain-text responses on the same endpoint still validate as before.

## Streaming

v1 ships with non-streaming tool calls only. Streaming responses pass through, but the SSE chunks aren't yet re-mapped to a normalized tool-call delta protocol. Streaming + tool calls is a follow-up.

## Limitations

- **Wrapper API (`/v1/chat/completions`)** — the AI Wrapper currently passes `tools` through but doesn't normalize tool_calls in the OpenAI-compatible response shape yet (OpenAI clients will see them in their native shape, which is fine for OpenAI-targeted apps).
- **Cohere v2** doesn't speak the OpenAI tools shape; its native tools API is not yet bridged.
- **Tool result messages** (role `tool` with `tool_call_id`) are forwarded as-is. PromptGate doesn't inspect or transform them — your client/agent is responsible for the round-trip.

---

> © Akyros Labs LLC. All rights reserved.
