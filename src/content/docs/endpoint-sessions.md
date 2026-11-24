---
title: "Endpoint sessions"
description: "Part of AI Gateway endpoints. A session keeps the conversation between requests, so a client sends only the new message (or new variables) and PromptGate adds…"
---

<!-- Generated from docs/endpoint-sessions.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Part of [AI Gateway endpoints](/endpoints/). A session keeps the
conversation between requests, so a client sends only the new message
(or new variables) and PromptGate adds what came before.

```yaml
endpoints:
  tutor:
    model: claude
    system: You teach {{ topic }}.
    template: "{{ question }}"
    variables: { topic: {}, question: { type: text } }
    sessions:
      ttl: 1h            # unused sessions end after this (default 1h)
      max_messages: 40   # history bound
      max_tokens: 32000  # history bound, estimated as characters / 4
      overflow: trim     # trim (default): drop the oldest turns; reject: 409
sessions:
  max: 10000             # sessions kept in memory, least recently used go first
```

1. The first request starts a session; the response carries its id in
   `X-PromptGate-Session: s_…`.
2. To continue, send the id back in that header or as `"session_id"` in
   the body (it is removed before the request goes on).
3. PromptGate puts the history between the system prompt and the new
   message(s), and after a successful answer adds the new messages and
   the answer — streamed answers too.

- A session belongs to the endpoint, `pg_` key and [end user](/users/)
  that started it, and to the request format (OpenAI or Anthropic). Any
  other caller, an unknown id and an expired one all get **404**, so
  ids can't be probed.
- The history holds the messages **as the provider saw them**: after
  guardrails, so masked or redacted values stay masked (v1 stored the raw
  input). Redaction tokens from earlier turns are not restored again.
- The bounds are checked **before** the provider is called. `trim`
  drops whole turns from the start; `reject` answers **409** and the
  client starts a new session. Nothing is paid for and then thrown away
  (v1 refused after the paid call).
- An answer that fails the [output schema](/endpoints/#schemas) or an
  error doesn't join the session.
- Each request's session id is in the request log: `promptgate logs
  --session s_…`.
- Sessions live in memory: they survive config reloads, not restarts.
  Shared storage for several gateway nodes comes with the multi-node
  work.
