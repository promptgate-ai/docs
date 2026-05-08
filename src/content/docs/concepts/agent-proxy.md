---
title: Agent Proxy
description: A new project type that turns PromptGate into the corporate egress gateway for coding agents (Claude Code, Codex CLI, Cursor, Aider, Continue, Cline). One choke point, four API shapes, default-secure guardrails.
---

The **Agent Proxy** project type is PromptGate framed for one job: every AI request leaving your laptop / your team / your company flows through a single point. From there you get cost dashboards, audit logs, secret scanners, reversible PII redaction, and per-user tokens — without changing a line of code in the agents themselves.

## When you want this

- Your team uses **Claude Code** + **Cursor** + **Aider** + an internal Python script using **OpenAI's SDK**, and you want one cost dashboard for all of them.
- Compliance / legal asks "**what data has left our network for an LLM provider in the last 30 days?**" and "we don't know" is no longer an acceptable answer.
- You want each developer to have their **own API token with their own budget** so a runaway script doesn't burn the team budget.
- You want **secrets** (AWS keys, GitHub PATs, JWTs) to be caught before a copy-paste accident ships them to OpenAI.
- You want **PII tokenization** so the LLM never sees your customer emails, but your developers do.

## The four API shapes

The Agent Proxy speaks every shape today's coding agents speak. Pick the shape your tool uses and point it at PromptGate via that tool's environment variable:

| Shape | Endpoint | Used by |
|---|---|---|
| OpenAI Chat Completions | `POST /api/{uuid}/v1/chat/completions` | Cursor, Aider, Continue, Cline, OpenAI SDK |
| OpenAI Responses | `POST /api/{uuid}/v1/responses` | Codex CLI, agentic OpenAI clients |
| OpenAI Embeddings | `POST /api/{uuid}/v1/embeddings` | RAG pipelines (LangChain, LlamaIndex, etc.) |
| Anthropic Messages | `POST /api/{uuid}/v1/messages` | Claude Code, Anthropic SDK, claudette |

Internally everything maps to PromptGate's canonical OpenAI-Chat shape; the controllers translate to and from each public shape, so the wrapper resolver, providers, guardrails, response cache, and gateway logs stay unified.

## Cross-provider routing

The `model` field in any request is resolved through the same wrapper resolver used by `ai_wrapper` projects. That means you can:

- Send an Anthropic-shaped `POST /v1/messages` with `model: "openai:gpt-4o-mini"` → request gets translated to OpenAI shape, response gets translated back to Anthropic shape, Claude Code never knows.
- Define a wrapper alias `cheap-fast` that points at `openai:gpt-4o-mini` today and `mistral:mistral-small` tomorrow. The agents keep calling `cheap-fast`; you swap the backing model without redeploying anything.

## Default-secure guardrails

Two guardrails are intended for Agent Proxy projects in particular:

- **[Reversible Redaction](/security/reversible-redaction/)** — emails / phones / IBANs / SSNs / IPs / custom-regex matches are tokenized before the LLM call (the LLM sees `[[EMAIL_001]]`, never `john@acme.com`) and the substitution is reversed in the response so the user gets their real data back.
- **[Secret Scanner](/security/secret-scanner/)** — AWS keys, GitHub PATs, Slack tokens, OpenAI keys, JWTs, private keys, npm/PyPI tokens. Block mode rejects with 422; redact mode tokenizes via Reversible Redaction.

Both layer on top of the existing PII Filter / Prompt Injection / Keyword Blocklist / Content Length guardrails — they're additive, not replacements.

## Setup

1. Create a project with type **Agent Proxy** under `/projects`.
2. Click **Setup** in the sidebar — that page lists every supported tool with the exact env var to set.
3. Issue an API token with the `chat` scope under **API Tokens**.
4. Drop the env var on each developer's machine; their next request flows through PromptGate.

The Setup page also shows a "Connected Agents · last 7 days" panel inferred from `gateway_logs` — once traffic is flowing you'll see "12 Cursor / 8 Claude Code / 4 Aider" without manual instrumentation.

---

> © Akyros Labs LLC. All rights reserved.
