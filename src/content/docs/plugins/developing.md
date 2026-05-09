---
title: Developing Plugins
description: Coming soon — manifest format, signing, and distribution for plugin authors.
---

:::caution[Coming soon]
Plugin development workflow is **not yet finalised**. This page sketches the intended shape so prospective authors can plan around it.
:::

PromptGate's runtime is already plugin-ready — every extensible piece implements a contract:

- `App\Services\Providers\ProviderContract` for AI providers
- `App\Services\Guardrails\GuardrailContract` for guardrails
- (planned) `App\Services\Alerts\AlertSinkContract` for alert sinks

What's missing is the **distribution layer** — manifest format, signing, install command, marketplace publishing.

## Planned manifest

Each plugin will ship a `plugin.json`:

```json
{
  "name": "@promptgate/provider-replicate",
  "version": "1.0.0",
  "type": "provider",
  "main": "src/ReplicateProvider.php",
  "class": "PromptGate\\Plugins\\Replicate\\ReplicateProvider",
  "min_promptgate_version": "0.2.0",
  "author": "Akyros Labs LLC",
  "description": "Replicate.com provider adapter for PromptGate.",
  "homepage": "https://github.com/promptgate-ai/provider-replicate",
  "config_schema": {
    "type": "object",
    "properties": {
      "default_timeout": { "type": "integer", "default": 120 }
    }
  }
}
```

PromptGate reads the manifest at install time, registers the plugin's class with the appropriate container, and exposes its config in the admin UI.

## Signing (planned)

```bash
promptgate-cli sign ./my-plugin --key signing-key.pem
```

This will produce a `plugin.sig` next to `plugin.json`. PromptGate verifies the signature at install time against a published root certificate.

## Publishing (planned)

```bash
promptgate-cli publish ./my-plugin
```

Uploads the package to `marketplace.promptgate.dev` (after signature verification). Public listing follows.

## Until then

You can already extend PromptGate by:

1. Dropping a class into `app/Services/Providers/` (or wherever the contract lives).
2. Registering it in the appropriate container constructor (e.g. `ProviderRegistry::__construct`).
3. Restarting the container.

This works fine for **in-tree forks** of the gateway. The marketplace path adds:

- Distribution (no fork needed)
- Signing (trust)
- Versioning (rollback)
- UI registration (admin discovery)

Until the marketplace ships, watch the GitHub repo for updates.

---

> © Akyros Labs LLC. All rights reserved.
