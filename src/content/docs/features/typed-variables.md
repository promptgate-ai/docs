---
title: Typed Input Variables
description: Per-endpoint whitelist of named, typed variables — substituted into your prompts at request time.
---

AI Gateway endpoints can declare an ordered list of **typed input variables**. When set, the gateway:

1. Expects the request body to be a JSON object whose keys match the schema.
2. Rejects unknown keys (422).
3. Coerces values to the declared types and checks constraints.
4. Substitutes the validated values into `{{name}}` placeholders in **both** the system prompt and the user-prompt template.
5. Sends the rendered template as the user message to the upstream provider — the raw JSON payload never leaves the gateway.

If no variables are declared, the legacy `{{input}}` flow is used (the raw user message is substituted into a single `{{input}}` placeholder).

## When to use this

Pick typed variables when:

- You want clients to send structured data, not a free-form string.
- You want to reject malformed input at the gateway boundary (before billing the provider).
- The prompt template references multiple distinct values (name, age, locale, tone, …) and you want each one validated independently.

Keep `{{input}}` when you only need a single freeform user message.

## Configuring variables

In the endpoint wizard, **Tab 06 — Prompt**, click **+ Add variable**.

Each variable has:

| Field | Required | Notes |
|-------|----------|-------|
| Name | yes | Must match `^[a-zA-Z_][a-zA-Z0-9_]*$`. Used as `{{name}}` in templates. |
| Type | yes | One of `string`, `text`, `int`, `float`, `bool`, `date`, `enum`. |
| Required | no (default `true`) | `false` makes the variable optional. |
| Max length | string / text only | Reject if `mb_strlen` exceeds this. |
| Pattern | string / text only | PCRE regex — the value must match. |
| Min / Max | int / float only | Inclusive numeric bounds. |
| Allowed values | enum only | Comma-separated list. |
| Description | no | UI hint, never sent to the model. |

Below the table, the system prompt and user-prompt template each get a chip-row of declared variables. Click a chip to insert `{{name}}` at the cursor.

## Type coercion

| Type | Accepts | Coerced to |
|------|---------|------------|
| string / text | string, int, float | string |
| int | int, numeric string | int |
| float | int, float, numeric string | float |
| bool | bool, `"true"`/`"false"`, `"1"`/`"0"`, `"yes"`/`"no"`, `"on"`/`"off"` | bool |
| date | ISO-8601 (`YYYY-MM-DD` or full timestamp) | string (passed through) |
| enum | string matching one of `allowed` | string |

## Request shape

With this schema:

```json
[
  {"name": "name", "type": "string", "max_length": 30},
  {"name": "age",  "type": "int", "min": 0, "max": 150},
  {"name": "tone", "type": "enum", "enum": ["formal", "casual"]}
]
```

Clients POST:

```bash
curl -X POST https://gateway.example.com/api/{project_uuid}/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-endpoint",
    "messages": [
      {"role": "user", "content": "{\"name\":\"Ada\",\"age\":30,\"tone\":\"formal\"}"}
    ]
  }'
```

(The `content` of the last user message must be the JSON-encoded variables object.)

## Rendering

With `prompt`:

```
Persona: {{tone}}
```

And `user_prompt_template`:

```
Greet {{name}}, who is {{age}} years old.
```

After substitution, the provider sees:

```json
[
  {"role": "system", "content": "Persona: formal"},
  {"role": "user",   "content": "Greet Ada, who is 30 years old."}
]
```

## Errors (HTTP 422)

| Cause | Message |
|-------|---------|
| Payload is not a JSON object | *Variables payload must be a JSON object.* |
| Required value missing | *Missing required variable: `name`.* |
| Unknown key | *Unknown variable not allowed by endpoint schema: `evil`.* |
| Type mismatch | *`age` must be an integer.* |
| Length violation | *`name` exceeds max_length of 30.* |
| Range violation | *`age` is above max (150).* |
| Enum violation | *`tone` must be one of: formal, casual.* |
| Bad date | *`birthdate` must be an ISO-8601 date (YYYY-MM-DD or full timestamp).* |

All errors include the variable name; values are never echoed back, so a secret accidentally posted in the wrong field won't leak via the error log.

## Coexistence with `input_schema`

Typed `variables` and the raw `input_schema` (JSON-Schema) field are independent: when both are set on the same endpoint, typed variables take precedence and the JSON-Schema validator is skipped. New endpoints should prefer typed variables; raw JSON-Schema remains supported for advanced cases that need the full Draft-7 vocabulary.
