---
title: "AI Gateway endpoints"
description: "An endpoint is a named prompt. You own the system prompt, the template, the model and its parameters in the config; apps only send the values that change, as…"
---

<!-- Generated from docs/endpoints.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

An endpoint is a named prompt. You own the system prompt, the template,
the model and its parameters in the config; apps only send the values
that change, as typed variables. Apps call `summarize-ticket` instead of
hard-coding prompts and model ids, and you change the prompt or the model
without touching an app.

## What endpoints can do

| feature | does | |
|---|---|---|
| prompts in the config | system prompt, template, model and parameters live in YAML; clients may override only the parameters you allow | [below](#defining-endpoints) |
| typed variables | `string`, `text`, `int`, `float`, `bool`, `date`, `enum` with bounds, lengths and patterns — all problems of a request reported at once (400) | [below](#variables) |
| schemas | a JSON Schema for the input; answers checked against an output schema, asked again, a 502 instead of a broken answer | [below](#schemas) |
| routes | another model by prompt size, spend, time, key, user or variable values | [routes](/endpoint-routes/) |
| sessions | the conversation kept between requests; clients send only the new message | [sessions](/endpoint-sessions/) |
| cache | identical requests answered from memory — no provider call, no cost — per key, user or everyone | [below](#cache) |
| versions | every change is a version, logged with each request; `history` and `diff` | [below](#versions) |
| evals and replay | test cases run against the current config; logged requests sent again | [evals](/endpoint-evals/) |
| anomaly alerts | error rate, latency and spend far above the endpoint's usual | [anomalies](/anomalies/) |
| MCP tools | every endpoint is also a tool for agents on the MCP gateway | [MCP endpoints](/mcp-endpoints/) |

Every endpoint request runs through the same pipeline as any other:
keys ([limited to some endpoints](#keys)), [end users](/users/),
[guardrails](/guardrails/), [rate limits](/limits/) and
[budgets](/budgets/) — each also per endpoint — fallback and the log.
Clients call `/gw/<name>`, or an OpenAI or Anthropic SDK uses the model `endpoint:<name>`.

Everything in one config:

```yaml
endpoints:
  summarize-ticket:
    model: openai:gpt-4.1-mini
    params: { temperature: 0.2, max_tokens: 400 }
    client_params: [max_tokens]
    system: You summarise support tickets for {{ product }}.
    template: "Ticket ({{ priority }}): {{ body }}"
    variables:
      product:  { default: PromptGate }
      priority: { type: enum, values: [low, normal, high] }
      body:     { type: text, max_length: 20000 }
    output_schema:
      type: object
      properties: { summary: { type: string }, priority: { enum: [low, normal, high] } }
      required: [summary, priority]
    output_retries: 1
    routes:
      - { name: long-input, when: { input_tokens: { gt: 8000 } }, use: { model: "openai:gpt-4.1" } }
    cache: { ttl: 10m, scope: key }
  tutor:
    model: openai:gpt-4.1-mini
    system: You teach {{ topic }}.
    template: "{{ question }}"
    variables: { topic: {}, question: { type: text } }
    sessions: { ttl: 1h, max_messages: 40 }

limits:     { endpoints: { summarize-ticket: 120/m } }
budgets:    { endpoints: { "*": { monthly_usd: 50 } } }   # each endpoint on its own counter
guardrails: { endpoints: { summarize-ticket: { pii: { action: redact } } } }
```

## Defining endpoints

Endpoints live under `endpoints:` in the config, or one per file in the
endpoints directory — `endpoints/<name>.yaml` next to the config by
default, `endpoints_dir` to move it. A file holds one endpoint; its name
is the file name. A name defined in both places is an error. A running
gateway reloads both within seconds.

```yaml
# endpoints/summarize-ticket.yaml
description: Summarise a support ticket for the agent on duty
model: claude                  # an alias, provider:model, or a model of the default provider
params: { temperature: 0.2, max_tokens: 400 }
client_params: [max_tokens]    # params a client may set itself; default none
system: |
  You summarise support tickets for {{ product }}.
template: |
  Ticket ({{ priority }}):
  {{ body }}
variables:
  product:  { default: PromptGate }
  priority: { type: enum, values: [low, normal, high] }
  body:     { type: text, max_length: 20000 }
```

| key | default | description |
|---|---|---|
| `description` | — | shown by `promptgate endpoints` |
| `model` | required | what answers: a [model alias](/routing/#model-aliases), `provider:model`, or a model of the default provider |
| `params` | — | request fields such as `temperature`, `max_tokens`; `model`, `messages`, `stream`, `input` and `system` are set by the endpoint itself |
| `client_params` | — | which `params` a client may override; all others are the endpoint's |
| `system` | — | system prompt; may use variables |
| `template` | — | the user message; see below |
| `variables` | — | typed inputs, see below |
| `input_schema` | — | a JSON Schema for the variables object instead of `variables`, see [schemas](#schemas) |
| `output_schema` | — | a JSON Schema the answer must match, see [schemas](#schemas) |
| `output_retries` | `0` | ask again after an answer that doesn't match (0–3) |
| `stream` | `true` (`false` with `output_schema`) | whether clients may stream the answer |
| `disabled` | `false` | answer 404 without deleting the endpoint |
| `mcp` | `true` | `false` keeps the endpoint off the [MCP gateway's tools](/mcp-endpoints/) |

Names are lowercase letters, digits, `-` and `_` (at most 64): they become
part of URLs. Files are read like the config, strictly and with
`${ENV}` references expanded (`$$` for a literal `$`).

## Calling an endpoint

Two ways, both answered like OpenAI Chat Completions (or Anthropic
Messages on `/v1/messages`), streamed when the client asks:

```bash
curl http://127.0.0.1:7878/gw/summarize-ticket \
  -H "Authorization: Bearer $PROMPTGATE_KEY" \
  -d '{"variables": {"priority": "high", "body": "Login fails since 9:00"}}'
```

Any OpenAI or Anthropic SDK can call an endpoint as a model named
`endpoint:<name>`; variables travel as an extra body field:

```python
client = OpenAI(base_url="http://127.0.0.1:7878/v1", api_key=PROMPTGATE_KEY)
client.chat.completions.create(
    model="endpoint:summarize-ticket", messages=[],
    extra_body={"variables": {"priority": "high", "body": ticket}},
)
```

- The endpoint's model, parameters and prompts replace the client's. A
  client value survives only for parameters in `client_params`; fields
  the endpoint doesn't set (`tools`, `response_format`, `user`, …) pass
  through.
- Endpoints with variables take `variables`, not `messages` (an empty
  `messages: []` is fine, SDKs require it). Endpoints without variables
  take `messages`, not `variables`.
- `stream: true` on an endpoint with `stream: false` is refused (400)
  instead of silently answered unstreamed.
- The response header `X-PromptGate-Endpoint-Version` names the version
  that answered.
- `/gw` is the default mount; `surfaces.ai_gateway.mount` moves it
  (restart to apply).

| status | when |
|---|---|
| 400 | invalid variables or a variables object that breaks `input_schema` (all problems listed), variables vs. messages mixed up, streaming not allowed, `endpoint:` on a non-chat route |
| 403 | the key's `endpoints:` doesn't include it |
| 404 | no such endpoint, or `disabled: true` |
| 502 | the answer doesn't match `output_schema` (after `output_retries`) |
| 402, 422, 429 | budget, guardrail, rate limit — as for every request |

## Limits, budgets and guardrails per endpoint

`limits.endpoints`, `budgets.endpoints` and `guardrails.endpoints` take
an endpoint name, as in the [example above](#what-endpoints-can-do).
Endpoint guardrails override the alias's and are overridden by the
key's. `promptgate logs --endpoint <name>`, `promptgate stats --by
endpoint` and `promptgate budgets` show endpoints; the console line ends
in `endpoint=<name>`.

## Templates

`{{ name }}` inserts a variable; spaces inside the braces are optional.
Templates are compiled when the config loads, so a request only joins
text: a value is inserted as it is and never read as a template, even if
it contains `{{ … }}`.

- A placeholder naming no declared variable is an error at load.
- A declared variable that neither `system` nor `template` uses is an
  error too — usually a typo.
- `\{{` writes a literal `{{`. Any other `{{` that isn't a placeholder
  (`{{#each}}`, JSON such as `{{"a":1}}`) stays as it is.

**Without variables** clients send ordinary `messages`. The endpoint adds
its system prompt, and a `template` must contain `{{ input }}`, which
wraps each user message — `"Answer in German: {{ input }}"`. Without a
template the messages pass unchanged.

## Variables

Clients send `{"variables": {"priority": "high", "body": "…"}}`.

| type | accepts | inserted as |
|---|---|---|
| `string` (default) | a string on one line | as sent |
| `text` | a string, line breaks allowed | as sent |
| `int` | a whole number, also as a string (`"3"`) | `3` |
| `float` | a number, also as a string | shortest form (`0.25`) |
| `bool` | `true`/`false`, also `"yes"`, `"no"`, `"on"`, `"off"`, `1`, `0` | `true` / `false` |
| `date` | `2026-10-20` or an RFC 3339 time | as sent |
| `enum` | one of `values` | as sent |

| option | description |
|---|---|
| `required` | default `true`, or `false` when a `default` is set; an empty string counts as missing |
| `default` | used when the variable is absent or `null` |
| `max_length` | longest `string` / `text`, in characters |
| `min`, `max` | bounds for `int` and `float` |
| `pattern` | regular expression (RE2 syntax) a string must match, e.g. `^T-[0-9]+$` |
| `values` | the allowed values of an `enum` |
| `description` | shown by `promptgate endpoints show` |

Variables not declared by the endpoint are rejected, and every problem of
a request is reported at once (`priority must be one of low, normal,
high; body is required`). Checking the variables of a request takes about
0.6 µs, rendering a 2 KB prompt about 1 µs.

## Schemas

`output_schema` makes the answer machine-readable and checked:

```yaml
output_schema: schemas/summary.json   # a file next to the config, or inline YAML
output_retries: 1
```

- On OpenAI-format requests PromptGate asks for it with
  `response_format: {type: json_schema, …}` (unless `params` or the
  client set a `response_format`). Anthropic-format requests and
  providers without structured output are checked all the same.
- Every answer is checked before the client sees it: the text of
  `choices[0].message.content` (Anthropic: the text blocks), with a
  Markdown code fence around it removed. A mismatch is asked again up
  to `output_retries` times and is otherwise a **502** naming every
  problem (`/priority: must be one of ["low","normal","high"]`). Each
  attempt is a row in the request log with its cost.
- An answer checked as a whole can't be streamed: such endpoints refuse
  `stream: true`. Provider errors pass through unchecked.

`input_schema` replaces `variables` when the input is more than flat
values: nested objects, arrays, `oneOf`. The client's `variables` object
is checked against it (400 listing every problem), and each top-level
property can be used as a placeholder — strings as they are, anything
else as compact JSON.

Schema files are read when the config loads; after editing one, reload
(save the config or send SIGHUP).

The supported keywords are listed in [JSON Schema](/json-schema/).

## Cache

```yaml
endpoints:
  faq:
    cache: { ttl: 10m, scope: key }   # scope: key (default), user, endpoint
cache:
  max_bytes: 67108864                 # 64 MiB for all endpoints, least recently used out first
```

A request identical to an earlier one — same endpoint version, same
model, same request after guardrails — is answered from memory: no
provider call, no tokens, no cost, and nothing charged to budgets (v1
charged cache hits). Responses say `X-PromptGate-Cache: hit` or `miss`;
the log marks hits (`cache=hit`).

- **Scope** is who shares answers: `key` — callers with the same `pg_`
  key; `user` — the same key and [end user](/users/); `endpoint` —
  everyone. Callers with their own provider key never share answers
  across keys.
- Answers are kept **as the provider sent them**. With [reversible
  redaction](/guardrails/#reversible-redaction), two callers whose
  masked requests are identical share the answer, and each gets *their
  own* values restored — never another caller's.
- Streams are cached too and replayed as streams. Errors, answers that
  fail the [output schema](#schemas), and answers over 4 MB are not
  cached. Endpoints with sessions can't use the cache (every turn is
  new).
- The cache lives in memory: it survives config reloads, not restarts.
  A new endpoint version starts with an empty cache.

## Versions

Every endpoint has a version: the first 12 hex digits of a SHA-256 over
its whole definition. Any change — prompt, model, a parameter, a
variable — gives a new version; reformatting the YAML does not. Each
request logs the version that answered, and the gateway records every
version it loads in the request log, so `promptgate endpoints history`
and `diff` show what changed and when. Restoring an old version is a
change to the YAML (or `git revert`). To check a change before it goes
live, run the endpoint's [evals](/endpoint-evals/).

## Keys

`keys.<n>.endpoints` (or `promptgate keys create app --endpoint
summarize-ticket`) restricts a `pg_` key to these endpoints; without it a
key may call every endpoint.

## Command line

```
promptgate endpoints list [--json]     # name, model, variables, version, status, source file
promptgate endpoints show <name>       # prompts, variables, parameters
promptgate endpoints history <name>    # versions with first sighting and requests served
promptgate endpoints diff <name> [from] [to]   # what changed, default: the last change
promptgate eval <name>                 # run evals/<name>.yaml, see endpoint-evals.md
promptgate replay <request-id>         # send a logged request again (logging.bodies)
promptgate validate                    # also compiles every template
```
