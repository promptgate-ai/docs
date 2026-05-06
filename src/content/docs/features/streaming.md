---
title: Streaming
description: Server-Sent Events (SSE) on AI Gateway endpoints for token-by-token responses.
---

AI Gateway endpoints can stream responses as **Server-Sent Events** in OpenAI-compatible format. The client opts in per-request via `"stream": true`; the gateway decides whether to honour it based on the endpoint's `streaming_enabled` flag.

## Enabling streaming

Endpoint wizard, **Tab 4 — Streaming**: tick the toggle.

When the toggle is **off**, `stream: true` from the client is ignored — the gateway buffers the full response and returns a normal JSON body.

When the toggle is **on** AND the request body has `"stream": true`, the gateway streams.

:::caution[Streaming + Output Schema are mutually exclusive]
If the endpoint has an `output_schema`, streaming is disabled at the wizard level — the gateway has to wait for the complete response before validating against the schema. The form prevents enabling both.
:::

## On-the-wire format

The gateway speaks OpenAI's SSE shape regardless of which provider serves the request:

```
data: {"choices":[{"delta":{"content":"Hi"},"index":0}]}

data: {"choices":[{"delta":{"content":" there"},"index":0}]}

data: {"choices":[{"delta":{"content":"!"},"index":0}]}

data: [DONE]

```

Each event:

- Starts with `data: ` (note the space).
- Followed by JSON or the literal `[DONE]`.
- Terminated by a blank line (`\n\n`).

This works whether the underlying provider is OpenAI (native SSE), Anthropic (different event type names that the adapter rewrites), or Cohere (different again). Every provider adapter that supports streaming converts upstream chunks to this OpenAI shape, so client code stays portable across providers.

## Calling

### curl

```bash
curl -N -X POST $URL/api/$UUID/$SLUG \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a haiku about Mondays.", "stream": true}'
```

The `-N` flag is critical — it disables curl's output buffering so chunks land as they arrive.

### Python (requests, line by line)

```python
import os, json, requests

with requests.post(
    f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/{os.environ['PG_SLUG']}",
    headers={"Authorization": f"Bearer {os.environ['PG_TOKEN']}"},
    json={"message": "Write a poem.", "stream": True},
    stream=True,
    timeout=120,
) as r:
    r.raise_for_status()
    for raw in r.iter_lines():
        if not raw or not raw.startswith(b"data: "):
            continue
        payload = raw[6:]
        if payload == b"[DONE]":
            break
        chunk = json.loads(payload)
        print(chunk["choices"][0]["delta"].get("content", ""), end="", flush=True)
```

### Node.js (fetch + ReadableStream)

```js
const url = `${process.env.PG_URL}/api/${process.env.PG_UUID}/${process.env.PG_SLUG}`;
const r = await fetch(url, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.PG_TOKEN}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Write a poem.', stream: true }),
});

const reader = r.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;
        const chunk = JSON.parse(data);
        process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
    }
}
```

### Python (openai SDK against AI Wrapper)

If you're using the AI Wrapper project type, you can use the OpenAI SDK's streaming helpers as-is:

```python
from openai import OpenAI

client = OpenAI(base_url=f"{PG_URL}/api/{UUID}/v1", api_key=TOKEN)

stream = client.chat.completions.create(
    model="fast",
    messages=[{"role": "user", "content": "Write a poem."}],
    stream=True,
)

for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)
```

## Connection headers

PromptGate sets these headers on streaming responses:

```
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no       (disables nginx buffering when present)
```

If you're behind nginx, ensure `proxy_buffering off;` for the streaming route — otherwise nginx will buffer the SSE chunks and the client experiences chunked-but-not-streamed responses.

For Caddy, no special config is needed.

## Sessions + streaming

You can combine them — pass `session_id` and `stream: true` together. The streaming response contains the same `[DONE]` marker; the gateway records the assistant's full content into the session **after** the stream closes. The next request with that session ID sees the full transcript.

## Reconnection / retry

PromptGate doesn't implement client-side reconnection (no `id:` markers, no `retry:`). If the connection drops mid-stream, the partial response is what the client got. Re-issue the request to start over.

## Behaviour reference

| Situation | What happens |
|---|---|
| Client sends `stream: true`, endpoint streaming off | Normal JSON response. |
| Client sends `stream: true`, endpoint streaming on | SSE response. |
| Network error mid-stream | Connection closes. Partial output retained client-side. |
| Provider error mid-stream | An `error:` event then `[DONE]` (depending on provider adapter). |
| Output schema set on endpoint | Streaming is disabled at wizard level. |

---

Next: **[Providers Overview](/providers/overview/)**.

---

> © Akyros Labs LLC. All rights reserved.
