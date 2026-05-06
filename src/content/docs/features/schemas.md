---
title: JSON Schema Validation
description: Validate inputs and outputs against JSON Schema before / after the provider call.
---

AI Gateway endpoints can carry an **input schema** and / or an **output schema**. PromptGate validates the request payload against the input schema before calling the provider, and validates the model's response content against the output schema after.

Powered by [`justinrainbow/json-schema`](https://github.com/justinrainbow/json-schema), Draft 7.

## Configuring schemas

In the endpoint wizard, **Tab 7 — Schema**.

Both fields are JSON pasted as text. The form validates that what you paste is valid JSON Schema before saving. Empty = no validation (the default).

![Schema config — placeholder](#)

## Input schema

Validates the **client's request payload**.

Example:

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4000
    },
    "language": {
      "type": "string",
      "enum": ["en", "de", "fr", "es"]
    }
  },
  "required": ["message"]
}
```

A request like:

```json
{ "message": "" }
```

…fails: `message` violates `minLength`. Response: **422** with the validator error in the body. The provider is never called.

## Output schema

Validates the **assistant's response content**, parsed as JSON.

Example: you want the model to return strict structured output:

```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 5
    }
  },
  "required": ["summary", "tags"]
}
```

If the model returns valid JSON matching the schema, the response is the model output verbatim.

If the model returns text that:

- Isn't valid JSON, or
- Is JSON but doesn't match the schema

…the gateway returns **502 Bad Gateway** with the validation error. The thinking is: the upstream gave you something you weren't expecting; failing fast is safer than passing it through.

:::tip[Combine with system prompt]
For output-schema endpoints, you almost always want a system prompt that says "Return ONLY a JSON object matching this schema" — and ideally pass the schema in the prompt itself. Models are much better at producing valid output when they know what shape you want.
:::

## How validation interacts with sessions

Input validation runs against **the user's message in this turn**, not the full session history. Output validation runs against **the assistant's response for this turn**.

## How validation interacts with streaming

If the endpoint has an output schema, **streaming is disabled** — we can't validate JSON until the response is complete. The gateway buffers the full response and validates before returning. (The endpoint wizard surfaces this — you can't enable both simultaneously.)

## Failure modes

| Situation | Response |
|---|---|
| Invalid JSON in the input schema field at endpoint create | Form validation error |
| Request payload doesn't match input_schema | 422 with details |
| Model output isn't JSON | 502 |
| Model output is JSON but fails output_schema | 502 with details |

## When to use schemas

- ✅ Endpoints that an automated pipeline calls — strict shape, predictable failure mode.
- ✅ Endpoints exposed to MCP — schemas double as the tool's input definition.
- ❌ Conversational endpoints — too restrictive, the model writes prose.
- ❌ Internal experiments — adds friction without much payoff.

## Working examples

### Strict classification endpoint

System prompt:

```
You classify customer-support tickets. Return ONLY a JSON object with:
- "category" — one of: "billing", "technical", "account", "other"
- "priority" — one of: "low", "medium", "high"
- "summary" — a single-sentence description.

Do not include any explanation or markdown.
```

Output schema:

```json
{
  "type": "object",
  "properties": {
    "category": { "type": "string", "enum": ["billing", "technical", "account", "other"] },
    "priority": { "type": "string", "enum": ["low", "medium", "high"] },
    "summary": { "type": "string", "minLength": 1, "maxLength": 200 }
  },
  "required": ["category", "priority", "summary"],
  "additionalProperties": false
}
```

Now downstream code can `json.loads(response.content)` with confidence.

### Validated user input

```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "pattern": "^[A-Z0-9-]{6,20}$"
    }
  },
  "required": ["code"]
}
```

Combined with the request body `{"code": "ABC-123"}`, this rejects badly-formatted codes before the provider ever sees them — saves you tokens and shields the model from garbage input.

---

Next: **[Streaming](/features/streaming/)**.

---

> © Akyros Labs LLC. All rights reserved.
