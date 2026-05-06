---
title: Playground
description: Side-by-side endpoint comparison, system-prompt overrides, cost estimation — without a curl loop.
---

Project sidebar → **Playground** is an in-UI tester for AI Gateway and AI Wrapper projects. Pick an endpoint (or two!), type a message, hit run, see the response, latency, tokens, and cost.

## What it does

![Playground — placeholder](#)

- **Endpoint picker** — choose any active endpoint in the project.
- **Side-by-side mode** — pick a second endpoint and run both with the same input. Compare outputs.
- **System prompt override** — append or replace the endpoint's system prompt for this run. Doesn't persist.
- **Live cost** — multiplies tokens × `estimated_cost_per_1k_tokens_usd` for instant estimate per run.
- **Cmd/Ctrl+Enter** — keyboard shortcut to fire the request from the textarea.
- **Streaming toggle** — if the endpoint supports it, see the response stream.

## Why use it

- **Iterating on a system prompt** — change the prompt, run, compare to baseline. No code changes.
- **Comparing models** — same input, different endpoints. Quick A/B.
- **Smoke-testing a new endpoint** — confirm it's wired right before pointing real clients at it.
- **Reproducing a bad request** — paste the input from a Live Log row and re-run.

## How it routes

The Playground uses the **same internal pipeline** as production traffic — guardrails, schemas, rate limits, budgets, the works. Caveats:

- **Rate limits do apply** — you can hit them with the playground.
- **Budgets do apply** — playground tokens count against the monthly budget.
- **Sessions don't persist** — each playground run is one-shot. (You can pass a session_id manually if you want.)

## Caveat for AI Wrapper projects

The Playground is wired primarily to AI Gateway endpoints. For AI Wrapper, use any external OpenAI-compatible client (curl, the OpenAI SDK, the OpenAI Playground in your browser pointing at PromptGate's URL).

## What it doesn't do

- ❌ Save runs as fixtures.
- ❌ Run against fixtures (replay).
- ❌ Diff outputs between runs.

For more sophisticated prompt-engineering workflows, hook PromptGate into a tool like Promptfoo or Langfuse via the AI Wrapper API — they'll see PromptGate as a normal OpenAI-compatible backend.

---

Next: **[Admin Area](/admin/overview/)** in the Administration section.

---

> © Akyros Labs LLC. All rights reserved.
