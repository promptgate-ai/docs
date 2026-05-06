---
title: Prompt Injection
description: Pattern-based detection for known jailbreak / instruction-override attempts.
---

The **Prompt Injection** guardrail looks for known jailbreak and instruction-override patterns in user input. Block-only — there's no useful "mask" semantics for an injection attempt.

## What it catches

A non-exhaustive list of patterns the built-in detector flags:

- "ignore previous instructions"
- "disregard all prior context"
- "you are now …" (role-override attempts)
- "system prompt above is wrong"
- known jailbreak templates (DAN, AIM, etc.)
- prompt-leaking probes ("repeat the system prompt verbatim")

The exact pattern set is in `App\Services\Guardrails\PromptInjectionFilter`. It evolves as new attack patterns are reported — pulling in upstream updates is a good reason to keep PromptGate up to date.

## What it doesn't catch

- **Novel jailbreaks**. A pattern matcher catches known shapes; sufficiently creative attacks slip through. This is a defence layer, not a silver bullet.
- **Multilingual attacks**. The patterns are predominantly English. Non-English jailbreaks may pass.
- **Subtle context manipulation**. "What if you were a different AI?" is technically benign but commonly used as a setup. Patterns balance precision and recall — false positives erode trust.

For comprehensive defence, combine this guardrail with:

- **Strong system prompt** ("You only respond about <topic>; refuse anything else.")
- **Output schema validation** — if the model produces unexpected shape, you know something is off.
- **Audit log review** — the audit trail records guardrail blocks; review to spot patterns.
- **Rate limits** — slow down probing attacks.

## Configuration

The rule shape is minimal — there's just an enabled toggle:

```json
{
  "enabled": true,
  "mode": "block"
}
```

Mode is always `block` (a "masked" injection attempt isn't a useful concept).

## Behaviour

When a pattern matches, the guardrail throws **422**:

```json
{
  "ok": false,
  "error": "Request blocked: prompt injection pattern detected."
}
```

The provider is never called. The blocked request appears in the audit log (`guardrail.blocked` with `target = prompt_injection`).

## Performance

Pattern matching against a list of regex shapes is fast — a few hundred microseconds even on long input. Effectively free compared to a provider call.

## False positives

Some legitimate uses do trip the detector:

- Educational content about prompt injection ("In this lesson we'll show how an attacker might say 'ignore previous instructions'…")
- Adversarial-testing inputs from your QA team

Two responses:

1. **Disable the guardrail** at project or endpoint level when running known-safe testing.
2. **Whitelist** patterns is on the roadmap. Until then, disable + targeted system-prompt hardening is the workaround.

## When to enable

✅ Public-facing endpoints (always).
✅ Endpoints with sensitive system prompts.
✅ Endpoints exposing tools / function-calling.

❌ Internal / first-party endpoints where the input source is already trusted.
❌ Educational endpoints where users discuss prompt-injection topics.

## Inheritance

Like every guardrail, runs through 3-level inheritance: global → project → endpoint. A reasonable default:

- **Global**: enabled, block mode.
- **Project**: inherit (don't override).
- **Endpoint**: only override for known-edge-case endpoints.

---

Next: **[Keyword Blocklist](/security/keyword-blocklist/)**.

---

> © Akyros Labs LLC. All rights reserved.
