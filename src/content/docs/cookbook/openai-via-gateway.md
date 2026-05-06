---
title: Recipe — Use OpenAI through the Gateway
description: From zero to a token-gated, audited, rate-limited proxy for OpenAI Chat Completions in 5 minutes.
---

This recipe walks through standing up an **AI Wrapper** project so existing OpenAI-using apps can route through PromptGate without code changes.

End state: your apps call `<your-gateway>/api/<uuid>/v1/chat/completions` with the **OpenAI SDK unchanged**, and you get token-gated access, observability, rate limits, budgets, and the option to swap to a different provider later.

## Prerequisites

- PromptGate installed and running ([Installation](/getting-started/installation/))
- An OpenAI API key (`sk-…`)
- Logged into the admin UI

## Step 1 — Add the OpenAI credential

Top-right user menu → **Credentials** → **+ New credential**:

- Name: `OpenAI Production`
- Provider: `OpenAI`
- Secret: paste your `sk-…`

Save. The key is encrypted with `APP_KEY` at rest.

## Step 2 — Create an AI Wrapper project

Sidebar → **Projects** → **+ New project**:

- Name: `OpenAI Proxy`
- Type: `AI Wrapper`
- Environment: `prod`

Click your new project to enter it.

## Step 3 — Bind OpenAI to the wrapper

Project sidebar → **Providers**:

- Tick **Enabled** on the OpenAI row.
- Pick **Credential** → `OpenAI Production`.

Save.

(You can do this for as many providers as you want — each one bound to its credential. The wrapper will route requests by `provider:model` accordingly.)

## Step 4 — (Optional) Add a friendly alias

Project sidebar → **Aliases** → **+ New alias**:

- Alias: `fast`
- Provider: `openai`
- Model: `gpt-4o-mini`

Now clients can use `model: "fast"` instead of `model: "openai:gpt-4o-mini"`. Swap the alias's underlying model later without changing client code.

## Step 5 — Issue a token

Project sidebar → **API Tokens** → **+ New token**:

- Name: `Production app`
- Environment: `live`
- Scopes: `chat`

Save. **Copy the plaintext** (`pg_live_…`) — it's only shown once.

## Step 6 — Point the OpenAI SDK at PromptGate

The wrapper's URL is your gateway URL + `/api/<UUID>/v1`:

```
PG_BASE=https://gateway.your-domain.com/api/8e3f-…/v1
```

### Python

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=os.environ['PG_BASE'],          # PromptGate's wrapper URL
    api_key=os.environ['PG_TOKEN'],          # The pg_live_... token
)

resp = client.chat.completions.create(
    model="promptgate:fast",                  # Or "openai:gpt-4o-mini" / "openai:gpt-4o"
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)
```

### Node.js

```js
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: process.env.PG_BASE,
    apiKey: process.env.PG_TOKEN,
});

const resp = await client.chat.completions.create({
    model: 'promptgate:fast',
    messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(resp.choices[0].message.content);
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url=os.environ['PG_BASE'],
    api_key=os.environ['PG_TOKEN'],
    model="promptgate:fast",
)
print(llm.invoke("Hello!").content)
```

### Vercel AI SDK

```js
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const promptgate = createOpenAI({
    baseURL: process.env.PG_BASE,
    apiKey: process.env.PG_TOKEN,
});

const { text } = await generateText({
    model: promptgate('promptgate:fast'),
    prompt: 'Hello!',
});
```

## Step 7 — Verify in the UI

Trigger a request, then watch:

- **Live Logs** — request appears within 2s with status, latency, tokens.
- **Metrics** — KPIs and charts update.
- **Audit Log** — `auth.token.used` events.

## What you've gained

- ✅ Provider key out of every app — replace it once in PromptGate.
- ✅ Token-gated access — issue per-app tokens, revoke independently.
- ✅ Observability — every request logged, rolled up, exportable.
- ✅ Rate limits + budgets available (configure on the alias level via [AI Endpoints](/features/ai-endpoints/) for fine grain, or on the wrapper-wide via roadmap).
- ✅ Provider portability — swap `fast` from `openai:gpt-4o-mini` to `groq:llama-3.1-8b-instant` in 5 seconds. Clients never know.

## What's next

- Add a guardrail (PII filter mask mode) so customer data never leaves your gateway: **[Guardrails](/security/guardrails/)**.
- Add rate limits per minute / per hour: **[Rate Limits](/security/rate-limits/)**.
- Add monthly budget: **[Budgets](/security/budgets/)**.
- Add Anthropic + Mistral as additional aliases for cheap fallback.

---

Next: **[Multi-provider AI Wrapper](/cookbook/ai-wrapper-setup/)**.

---

> © Akyros Labs LLC. All rights reserved.
