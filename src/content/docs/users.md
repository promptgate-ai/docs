---
title: "End users"
description: "One key usually serves many people: a SaaS backend with thousands of customers, a team behind one agent. PromptGate can tell them apart. Each request names the…"
---

<!-- Generated from docs/users.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

One key usually serves many people: a SaaS backend with thousands of
customers, a team behind one agent. PromptGate can tell them apart. Each
request names the end user it is for. The console, the request log and
`promptgate stats` show it next to the key.

```text
10:42:13 200 openai gpt-4o-mini  sse ttfb 270µs total 1.20s 4.1KB  120→30 tok  $0.000420  key=shop  user=customer-4711
```

## What end users give you

| feature | does | |
|---|---|---|
| the user id | from an `X-PromptGate-User` header or the fields OpenAI and Anthropic SDKs already send — no code change | [below](#sending-the-user-id) |
| per-key policy | a key may require an id, use it when present, or ignore it | [below](#per-key-policy) |
| limits per user | every user their own rate allowance; one user at the limit slows no one else | [below](#limits-per-user) |
| budgets per user | daily and monthly USD or token caps per user (402) | [below](#budgets-per-user) |
| hashed ids | the log stores a keyed hash instead of the id | [below](#valid-ids) |
| forwarding | the provider's own end-user field set, so OpenAI and Anthropic act on one user, not your whole key | [below](#passing-the-user-on-to-the-provider) |
| reports | requests, tokens and cost per user; logs filtered by user; an optional metrics label | [below](#seeing-who-used-what) |
| AI Gateway routes | another model per user | [routes](/endpoint-routes/) |

Everything in one config:

```yaml
users:
  sources: [header, openai, anthropic]   # order; [] turns attribution off
  header: X-PromptGate-User              # e.g. X-End-User; never forwarded
  max_length: 128
  log: hashed                            # plain (default) | hashed
  hash_key: ${PROMPTGATE_USER_HASH_KEY}  # ≥ 16 characters, needed for hashed
  forward: hashed                        # off (default) | hashed | plain
  passthrough: optional                  # policy for requests with a provider key
limits:
  users:
    "*": 30/m                            # each user of each key
    vip-4711: { requests: 300/m, burst: 50 }
budgets:
  users:
    "*": { daily_usd: 2, monthly_usd: 20 }
metrics: { user_label: true }            # a user label on the counters
```

`hash_key` keeps hashes stable across restarts. If you change it, the same
user gets a new hash. A key's own policy is set with
`promptgate keys create <name> --users required`.

## Sending the user id

The id travels with each request. PromptGate reads it from the first of
these that is present:

| source | where | typical client |
|---|---|---|
| `header` | `X-PromptGate-User: <id>` | any client, set deliberately for PromptGate |
| `openai` | body `safety_identifier`, then `user` (Chat, Responses, Embeddings) | apps that already send it: no code change |
| `anthropic` | body `metadata.user_id` | apps using the Anthropic SDK |

The `X-PromptGate-User` header is never forwarded to a provider. Body fields
belong to the provider's API and are forwarded unchanged.

**Backend serving many customers:** set the id per request.

```python
# OpenAI SDK: the provider's own field...
client.chat.completions.create(model="gpt-4o-mini", messages=msgs, user=customer.id)
# ...or the PromptGate header
client.chat.completions.create(model="gpt-4o-mini", messages=msgs,
                               extra_headers={"X-PromptGate-User": customer.id})

# Anthropic SDK
client.messages.create(model="claude-sonnet-4-5", max_tokens=1024, messages=msgs,
                       metadata={"user_id": customer.id})
```

```js
await client.chat.completions.create({ model: "gpt-4o-mini", messages },
  { headers: { "X-PromptGate-User": customer.id } });
```

```bash
curl http://127.0.0.1:7878/v1/chat/completions \
  -H "Authorization: Bearer $PG_KEY" -H "X-PromptGate-User: customer-4711" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hi"}]}'
```

**Coding agents and developer machines:** set the id once in the client's
configuration.

```bash
# Claude Code
export ANTHROPIC_CUSTOM_HEADERS="X-PromptGate-User: alice"
```

```toml
# Codex (~/.codex/config.toml), in your PromptGate model provider block
[model_providers.promptgate]
http_headers = { "X-PromptGate-User" = "alice" }
```

SDKs accept default headers for every request: `default_headers=` in Python,
`defaultHeaders:` in Node.

There is no gateway setting such as `PROMPTGATE_USER`: one gateway serves
many users, and PromptGate can't see the environment of the client.

Anyone holding a key can send any id. For people inside your company, a
`pg_` key per person is the stronger identity. Use the user id where a
trusted backend holds the key and speaks for its users.

## Valid ids

An id is 1–128 characters (`users.max_length`) of `A–Z a–z 0–9 . _ : @ + - | / =`.
That covers UUIDs, numeric ids, `auth0|abc123` and base64.

- An invalid **header** is answered with 400 in the client's error format.
- An invalid **body** value is ignored and the next source is tried. It still
  goes to the provider unchanged.

Send opaque ids, not e-mail addresses or names. With `users.log: hashed` the
log stores a keyed hash (`u_` + 16 hex characters) instead of the id.

## Per-key policy

Each key decides what to do with user ids:

| `users:` | effect |
|---|---|
| `optional` (default) | use the id when the request names one |
| `required` | requests without an id get 400: `this key requires a user id: send it in the X-PromptGate-User header, …` |
| `ignore` | drop ids: for keys that end users hold themselves and could claim anyone's id |

```bash
promptgate keys create shop-backend --users required
```

```yaml
keys:
  - name: shop-backend
    hash: sha256:…
    users: required
users:
  passthrough: optional     # the same policy for requests with a provider key
```

## Limits per user

```yaml
limits:
  users:
    "*": 30/m                    # each user of each key
    vip-4711: { requests: 300/m, burst: 50 }
```

Every user gets their own allowance, and one user at the limit doesn't slow
down anyone else. Counters are kept per key and user, so two customers'
backends can both have a user `42`. Key limits still cap the key's total.
See [rate limits](/limits/).

## Budgets per user

```yaml
budgets:
  users:
    "*": { daily_usd: 2, monthly_usd: 20 }
    vip-4711: { monthly_usd: 200 }
```

A user whose budget is used up gets 402 until the day or month resets. The
other users and the key carry on. Spend is restored after a restart from
the daily per-user totals. `promptgate budgets` lists the users closest to
their limits. See [budgets](/budgets/).

## Passing the user on to the provider

OpenAI and Anthropic watch for abuse. If they can't tell your users
apart, they act on your whole API key. With `users.forward`, PromptGate
sets each provider's own end-user field, so they can single out one user:

| provider | field |
|---|---|
| OpenAI (Chat, Responses) | `safety_identifier` |
| OpenAI (Embeddings, legacy Completions) | `user` |
| Anthropic (Messages) | `metadata.user_id` |

```yaml
users:
  forward: hashed                        # off (default) | hashed | plain
  hash_key: ${PROMPTGATE_USER_HASH_KEY}
```

`hashed` sends the keyed hash (`u_…`), so the provider never learns your
ids, and it stays the same across requests and restarts. This mode is
recommended. `plain` sends the id itself.

- A value the client set itself is kept: an OpenAI `user` or
  `safety_identifier`, or an Anthropic `metadata` object.
- Translated requests get the target provider's field, e.g. an Anthropic
  client on an OpenAI model gets `safety_identifier`.
- OpenAI-compatible providers (Groq, Mistral, OpenRouter, …) and Gemini or
  Cohere get nothing: their fields differ, and some reject fields they
  don't know.
- The field is added after guardrails have run. With `plain`, an id shaped
  like an e-mail address reaches the provider even if the PII guard masks
  e-mail addresses. Use opaque ids or `hashed`.

## Seeing who used what

```bash
promptgate logs --user customer-4711          # that user's requests
promptgate stats --by user --since 168h       # requests, tokens and cost per user
promptgate stats --by user --key shop --top 10
```

```text
       USER  KEY  REQUESTS  ERRORS  TOKENS IN  TOKENS OUT     COST
     ana-17  shop       412       3      98214       21007  $1.8420
customer-42  shop       118       0      30551        6120  $0.5530
```

`stats --by user` reads daily totals kept per key and user, so it stays
fast with many users. It counts whole days in `budgets.timezone` and keeps
them for `logging.stats_retention`. `logs --user` takes the id clients
send, even when the log stores hashes. The log writer keeps up with
about 65,000 requests per second spread over 10,000 users (155,000 without
users), well above what one gateway serves.

For Prometheus, `metrics.user_label: true` adds a `user` label to the
request, token and cost counters. That label is off by default because
every user becomes a new series ([metrics](/metrics/#cardinality)).

## Quality

Every build checks this behaviour with pgfuzz: per-user limits isolate
users, `required` keys reject requests without an id, and `ignore` keys
never limit ids ([quality gate](/quality-gate/)).

Reading the id costs about 30 ns from the header. From the body it costs
nothing extra, because the same pass over the body already reads `model`.
