---
title: Claude Code through PromptGate
description: Set ANTHROPIC_BASE_URL, get cost dashboards + audit + secret scanning on every Claude Code session, no code change in Claude Code itself.
---

This recipe routes Claude Code's traffic through your PromptGate instance. The result: Claude Code keeps doing exactly what it does, but every prompt + response is recorded, every cost is in your dashboard, every secret leak is caught.

## Prerequisites

- A PromptGate instance reachable from your laptop (e.g. `http://localhost:8080` for self-host or your deployed URL).
- An Anthropic credential configured under **Credentials**.

## Steps

### 1. Create an Agent Proxy project

Projects → **Create project** → name it (e.g. `Engineering Egress`), pick **Agent Proxy** as the type. Default-secure guardrails (Reversible Redaction, Secret Scanner) become available under the Guardrails tab.

### 2. Enable the Anthropic provider in the wrapper

Under the project's **Providers** sidebar entry, toggle Anthropic on and pick the credential you set up.

### 3. Issue an API token

**API Tokens → New token** with the `chat` scope. Copy the plaintext (`pg_live_…`) — it's only shown once.

### 4. Point Claude Code at PromptGate

In whatever shell you launch Claude Code from:

```bash
export ANTHROPIC_BASE_URL="https://your-promptgate-host/api/<project-uuid>"
export ANTHROPIC_AUTH_TOKEN="pg_live_..."
```

Restart Claude Code. From its perspective nothing changed — it's still calling the Anthropic Messages API at `/v1/messages`.

### 5. Verify

Run any Claude Code session, then open **Live Logs** in PromptGate. Each request appears immediately with prompt + response + token count.

## Cost optimisation

The killer follow-up: **route small prompts to a cheaper model**. Define a wrapper alias `claude-fast` that points at `anthropic:claude-haiku-…` and have Claude Code use the fast model for trivial tasks:

```bash
# In the same project, add a routing rule on the alias:
#   when input_tokens < 4000  → claude-haiku
#   else                       → claude-3-5-sonnet
```

Per-team experience varies, but typical savings on coding-agent traffic are **70-85%** because the bulk of requests are small "what does this function do?" prompts that Haiku handles fine.

## Security follow-up

- **Enable Reversible Redaction** with `email`, `phone`, and a few `custom_patterns` for your customer-id format. Your developers paste real customer data into Claude Code; the LLM only ever sees `[[CUSTOMER_001]]`.
- **Enable Secret Scanner** in `block` mode. The first time someone copy-pastes a `.env` file with an AWS key into Claude Code, PromptGate intercepts loudly.
- **Subscribe to webhooks** for `endpoint.anomaly` so a sudden spend spike pages whoever is on call.

## Troubleshooting

- **401 from Claude Code:** the `ANTHROPIC_AUTH_TOKEN` env doesn't carry a valid `pg_live_…` token, or the token's scopes don't include `chat`.
- **400 "This project is not an AI Wrapper or Agent Proxy":** the token was issued under an `ai_gateway` project. Tokens are project-scoped — issue a new one under the Agent Proxy project.
- **All requests blocked:** check Guardrails → Secret Scanner. Block mode is loud by design; switch to `redact` if you want to keep working with secret-bearing prompts.

---

> © Akyros Labs LLC. All rights reserved.
