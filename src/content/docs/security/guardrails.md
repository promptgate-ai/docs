---
title: Guardrails
description: Pluggable input checks (PII, prompt injection, blocklist, content length) with 3-level inheritance.
---

A **guardrail** is a check that runs against every chat request before the provider is called. PromptGate ships four built-in guardrails and a 3-level inheritance model for configuring them.

## The four built-ins

| Guardrail | What it does | Modes |
|---|---|---|
| **[PII Filter](/security/pii-filter/)** | Detects emails, IBANs, credit cards, SSNs, phone numbers, IPs, custom regexes — plus optional LLM-based contextual detection of person names and addresses | `mask` / `block` |
| **[Prompt Injection](/security/prompt-injection/)** | Scans for known jailbreak / instruction-override patterns | `block` |
| **[Keyword Blocklist](/security/keyword-blocklist/)** | Project-defined word/phrase list | `block` |
| **[Content Length](/security/content-length/)** | Min / max input length cap | `block` (rejects with 422) |

Each one has its own page with the detection rules, configuration, and edge cases.

## 3-level inheritance

Guardrail rules are defined at three scopes. They merge from broadest to narrowest:

```
Global   (admin → Guardrails)
   ↓
Project  (project sidebar → Guardrails)
   ↓
Endpoint (endpoint wizard → Guardrails tab)  [coming]
```

For each guardrail key (e.g. `pii_filter`):

- Global config is the **default**.
- Project config **overrides** global. Setting `pii_filter.enabled = false` at project scope turns it off everywhere in that project, even if global has it on.
- Endpoint config (when wired) overrides project.

The merging is shallow — at each level you replace the entire rule (not deep-merge fields). So if you want to inherit project's PII config but tweak `mode` for one endpoint, copy the whole rule down and edit `mode`.

## Where guardrails run

In the AI Gateway / AI Wrapper request pipeline:

```
1. Auth + scope check
2. Rate limit
3. Budget check
4. >>> Guardrails <<<     ← here
5. Input schema validation
6. Prompt apply
7. Provider call
8. Output schema validation
9. Log
```

Guardrails run on the **concatenated content of every message in the request** (concatenated with `\n`). They do not see the system prompt that PromptGate prepends afterwards.

If a guardrail throws (block mode), the request is rejected with **422** before any provider work happens — no tokens, no cost.

## The UI

### Project Guardrails

Project sidebar → **Guardrails**. Shows a card per guardrail key with:

- The current effective state (enabled / disabled, mode, types, words, etc.)
- Source — `Inherited` (from global) / `Project` (locally configured)
- Configure / Toggle actions

![Project guardrails — placeholder](#)

### Global Guardrails

Top-right user menu → **Guardrails**. Same UI, but configures the gateway-wide defaults that every project inherits unless overridden.

### Live-save

Toggling a guardrail on/off persists immediately via AJAX (`POST /projects/{project}/guardrails/policy`). A toast confirms the save. No "Save" button.

The configure modal also persists on save — you tweak the JSON-ish form, click apply, the rule is written back. No reload.

## Configuration storage

Rules live in `guardrail_configs`:

```
id | scope ('global' | 'project' | 'endpoint')
   | scope_id (project_id or endpoint_id; null for global)
   | rules (json: { "pii_filter": {...}, "prompt_injection": {...}, ... })
```

One row per scope. The `rules` JSON is a map keyed by guardrail key, each value being whatever shape the guardrail expects.

## Behaviour summary

| Configuration | What happens |
|---|---|
| `enabled: false` | Guardrail skipped entirely. |
| `enabled: true, mode: "mask"` (PII only) | Runs, redacts matched substrings with `[<TYPE> REDACTED]`, request continues. |
| `enabled: true, mode: "block"` | Runs, throws 422 on first match — request rejected. |
| Custom config (PII custom_patterns, blocklist words, etc.) | Merged with built-ins. |

The 422 response body:

```json
{
  "ok": false,
  "error": "Request blocked: E-Mail detected in input."
}
```

Code is the HTTP status; the message names which guardrail / which rule fired.

## Per-page reference

- **[PII Filter](/security/pii-filter/)** — full type list, regex patterns, custom-regex tester, contextual LLM mode.
- **[Prompt Injection](/security/prompt-injection/)** — pattern catalogue, false-positive notes.
- **[Keyword Blocklist](/security/keyword-blocklist/)** — case-folding, word vs substring matching.
- **[Content Length](/security/content-length/)** — min/max behaviour, multi-byte handling.

## Adding a custom guardrail

Implement the `GuardrailContract` interface:

```php
namespace App\Services\Guardrails;

interface GuardrailContract
{
    public function key(): string;
    public function label(): string;
    public function description(): string;
    public function process(string $text, array $config): string;
}
```

`process()` receives the concatenated message text and the rule config. Either:

- Return the (possibly modified) text — request continues.
- Throw `RuntimeException(..., 422)` — request blocked.

Register in `GuardrailService::__construct`:

```php
$this->register(new MyCustomGuardrail());
```

A first-class plugin path is on the roadmap (see **[Plugins](/plugins/marketplace/)**).

---

Next: **[PII Filter](/security/pii-filter/)** — the most-used guardrail.

---

> © Akyros Labs LLC. All rights reserved.
