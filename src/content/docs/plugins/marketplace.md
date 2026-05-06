---
title: Marketplace
description: Coming soon — signed-package plugin marketplace at marketplace.promptgate.dev.
---

:::caution[Coming soon]
The plugin marketplace is **planned, not yet implemented**. This page describes the intended shape so you can plan around it. The runtime in PromptGate today is plugin-ready (every adapter and guardrail implements a contract), but the install / sign / publish workflow doesn't exist yet.
:::

## What it'll do

A first-party registry hosted at **`marketplace.promptgate.dev`** distributing signed PromptGate plugins:

- **Provider plugins** — new ProviderContract implementations (think: a future `@promptgate/provider-replicate` for Replicate, etc.)
- **Guardrail plugins** — additional input checks beyond the four built-ins
- **Alert plugins** — notification sinks (Slack, PagerDuty, custom webhooks)
- **OAuth plugins** — pre-baked OAuth client templates (similar to today's Quick-Fill presets but discoverable)

Plugins ship as signed packages (`@promptgate/...`). The signature is verified at install time so you can't accidentally pick up a malicious lookalike.

## Installation flow (planned)

```bash
docker compose exec app php artisan plugin:install @promptgate/provider-replicate
```

This will:

1. Download the package from `marketplace.promptgate.dev`.
2. Verify the signature against PromptGate's signing root.
3. Register the plugin's services with the container.
4. Run any plugin-specific migrations.
5. Surface the plugin in the admin UI.

Uninstall:

```bash
php artisan plugin:uninstall @promptgate/provider-replicate
```

## Why a marketplace?

PromptGate ships with 8 providers and 4 guardrails. There's a long tail of less-common providers, niche guardrails (e.g. industry-specific PII detectors), alert sinks, and OAuth presets that don't justify in-tree inclusion but make sense as community packages.

A marketplace gives:

- **Discoverability** — one place to find what's out there.
- **Signing** — trust by default; reject unsigned packages.
- **Versioning** — pin a specific version per deployment.
- **Updates** — easy upgrade path with rollback.

## Until then

You can still extend PromptGate by dropping classes into `app/Services/...` and registering them in the appropriate container — see **[Adding a Provider](/providers/adding/)** for the pattern. That works for in-tree forks; the marketplace adds the distribution + signing pieces.

## Tracking

- This page will update once the marketplace ships.
- The dev story for plugin authors is at **[Developing Plugins](/plugins/developing/)**.

---

> © Akyros Labs LLC. All rights reserved.
