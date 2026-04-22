---
title: Marketplace
description: Plugin ecosystem
---

:::note
The plugin marketplace is under active development and not yet available. This page describes the planned functionality.
:::

The PromptGate Marketplace is a curated catalog of signed plugins that extend the platform with additional providers, guardrails, alerting, and integrations.

## Concept

PromptGate's core handles credential management, routing, and access control. Plugins add everything else — new AI providers, content filters, notification channels, and custom processing steps. The marketplace at **marketplace.promptgate.dev** is the central hub for discovering and installing plugins.

## Planned plugin categories

### Provider plugins

Add support for additional AI providers beyond the built-in set:

- Regional or specialized AI providers
- Self-hosted model servers (Ollama, vLLM, TGI)
- Custom API adapters for non-standard provider interfaces

### Guardrail plugins

Apply safety and quality controls to requests and responses:

- Content moderation and toxicity filtering
- PII detection and redaction
- Output format validation
- Custom business rule enforcement

### Alert plugins

Send notifications when specific events occur:

- Budget threshold alerts (email, Slack, webhook)
- Error rate monitoring
- Unusual usage pattern detection
- Uptime monitoring for upstream providers

### Integration plugins

Connect PromptGate with external systems:

- Logging to external platforms (Datadog, Sentry, etc.)
- Metrics export (Prometheus, StatsD)
- SSO / identity provider integration
- Webhook triggers for pipeline automation

## Plugin security

All plugins distributed through the marketplace are **cryptographically signed** by Akyros Labs. PromptGate verifies the signature before installation, ensuring that:

- The plugin has not been tampered with
- The plugin was reviewed and approved for the marketplace
- The installed version matches the published version

Unsigned or modified plugins are rejected by default.

## Installation

Plugin installation will be available through the dashboard:

1. Navigate to **Marketplace** in the sidebar
2. Browse or search for plugins
3. Click **Install** on the desired plugin
4. Configure plugin-specific settings
5. Activate the plugin

Plugins can also be installed via the CLI:

```bash
php artisan promptgate:plugin:install vendor/plugin-name
```
