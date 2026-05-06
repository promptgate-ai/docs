---
title: Quick Start
description: Zero to a working AI endpoint, served through PromptGate, in about 5 minutes.
---

This walkthrough takes you from a fresh install to a real `POST /api/{uuid}/chat` call hitting OpenAI through PromptGate. You will:

1. Log in.
2. Add an OpenAI credential.
3. Create a project and an AI endpoint.
4. Issue a token.
5. Call the endpoint with `curl` / Python / Node.

If you haven't installed PromptGate yet, do that first: **[Installation](/getting-started/installation/)**.

## 1. Log in and change the default password

Open `http://localhost:8000`. Log in with:

```
Email:    admin@promptgate.dev
Password: admin
```

Click your name in the top-right corner → **Profile** → change the password. (You only need to do this once.)

![Login screen — placeholder](#)

## 2. Add a provider credential

Top-right user menu → **Credentials**. Click **New credential**.

- **Name**: `OpenAI Production`
- **Provider**: `OpenAI`
- **Secret**: paste your `sk-…` key

Save. The secret is encrypted with AES-256-GCM at rest. You can see the prefix only after this point.

![Credential create — placeholder](#)

:::tip[Don't have an OpenAI key?]
You can use any of the 8 built-in providers — Anthropic, Google Gemini, Mistral, Groq, Together AI, Cohere, or local Ollama. The provider in step 2 picks the adapter; the rest of the flow is identical. See **[Providers Overview](/providers/overview/)**.
:::

## 3. Create a project

Sidebar → **Projects** → **+ New project**.

- **Name**: `Quickstart`
- **Type**: `AI Gateway`
- **Environment**: `prod`

You'll land on the project switcher; click your new project to enter it. The sidebar now shows project-scoped items: **AI Endpoints**, **Playground**, **Live Logs**, **Metrics**, **Guardrails**, **API Tokens**, **Webhooks**.

## 4. Create an AI endpoint

Project sidebar → **AI Endpoints** → **+ New endpoint**.

The endpoint wizard has 7 tabs, but you only need to fill out two for this walkthrough:

**Tab 1 — Core:**
- **Name**: `Hello World`
- (Slug auto-fills as `hello-world`)

**Tab 2 — Provider:**
- **Mode**: `Manual`
- **Provider**: `OpenAI`
- **Model**: `gpt-4o-mini`
- **Credential**: pick the one you just added

Skip Limits, Streaming, Sessions, Prompt, Schema for now — defaults are fine. Hit **Create**.

You'll land on the endpoint detail page. Click the eye icon next to the slug to see the endpoint URL — something like:

```
POST http://localhost:8000/api/8e3f...c2/hello-world
```

![Endpoint detail — placeholder](#)

## 5. Issue an API token

Project sidebar → **API Tokens** → **+ New token**.

- **Name**: `quickstart`
- **Environment**: `live`
- **Scopes**: tick `chat`

Save. The plaintext token (`pg_live_…`) is shown **once**. Copy it now.

:::caution[One-time display]
PromptGate stores SHA-256 hashes only — you can't recover the plaintext later. If you lose it, rotate the token to mint a new one.
:::

## 6. Call the endpoint

Replace `<UUID>` with your project's UUID (visible in the endpoint detail URL) and `<TOKEN>` with the plaintext you just copied.

### curl

```bash
curl -X POST http://localhost:8000/api/<UUID>/hello-world \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Say hi in one sentence."}'
```

### Python

```python
import os, requests

resp = requests.post(
    f"http://localhost:8000/api/{os.environ['PG_UUID']}/hello-world",
    headers={"Authorization": f"Bearer {os.environ['PG_TOKEN']}"},
    json={"message": "Say hi in one sentence."},
)
resp.raise_for_status()
print(resp.json())
```

### Node.js

```js
const uuid = process.env.PG_UUID;
const token = process.env.PG_TOKEN;

const r = await fetch(`http://localhost:8000/api/${uuid}/hello-world`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Say hi in one sentence.' }),
});
console.log(await r.json());
```

You should see something like:

```json
{
  "ok": true,
  "id": "chatcmpl-...",
  "model": "gpt-4o-mini",
  "content": "Hi there! How can I help today?",
  "finish_reason": "stop",
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 9,
    "total_tokens": 23
  }
}
```

## 7. Watch it in the UI

While that request is firing, navigate to **Live Logs** in the project sidebar — you'll see the request appear in real time, with status, latency, and token counts. **Metrics** rolls these up into 24h / 7d charts, and **Audit Log** records the create/use of the endpoint and token.

## What you just did

- ✅ Encrypted a provider credential at rest
- ✅ Created a project-scoped AI endpoint with a fixed provider + model
- ✅ Issued a scoped, hashed API token
- ✅ Routed a chat completion through the gateway

## Next steps

- **[AI Endpoints](/features/ai-endpoints/)** — system prompts, schemas, sessions, streaming, failover.
- **[Guardrails](/security/guardrails/)** — turn on PII redaction, prompt-injection blocking, keyword blocklists.
- **[Rate Limits](/security/rate-limits/)** & **[Budgets](/security/budgets/)** — caps per-minute, per-hour, per-month.
- **[AI Wrapper](/features/ai-wrapper/)** — point any OpenAI SDK at the gateway directly.
- **[Cookbook](/cookbook/openai-via-gateway/)** — task-oriented walkthroughs.

---

> © Akyros Labs LLC. All rights reserved.
