---
title: Developing Plugins
description: Build plugins for PromptGate
---

:::note
The plugin development SDK is under active development and not yet available. This page describes the planned approach.
:::

PromptGate plugins are PHP packages that extend the platform through a defined set of hooks and interfaces. This page outlines the planned plugin architecture for developers who want to build and publish plugins.

## Plugin structure

A PromptGate plugin is a Composer package with a specific directory layout:

```
vendor/plugin-name/
  promptgate.json          # Plugin manifest
  src/
    PluginServiceProvider.php  # Laravel service provider
    ...
  config/
    plugin-name.php        # Plugin configuration
  resources/
    views/                 # Optional Blade views
  tests/
```

### Manifest file

The `promptgate.json` file describes the plugin:

```json
{
  "name": "vendor/plugin-name",
  "version": "1.0.0",
  "type": "provider",
  "description": "Short description of what the plugin does",
  "author": "Your Name",
  "license": "MIT",
  "promptgate": {
    "min_version": "1.0.0",
    "hooks": ["provider.resolve", "request.before"]
  }
}
```

## Plugin types

### Provider plugins

Implement the provider interface to add support for new AI services:

- Register available models
- Handle request formatting for the provider's API
- Parse responses into PromptGate's standard format
- Support streaming where the provider offers it

### Guardrail plugins

Hook into the request/response pipeline to inspect and modify content:

- `request.before` — Inspect or modify the request before it reaches the provider
- `response.after` — Inspect or modify the response before it reaches the caller
- Return rejection responses to block requests that violate rules

### Alert plugins

Subscribe to system events and send notifications:

- Budget threshold events
- Error events
- Custom event types defined by other plugins

## Hooks

Plugins register for specific hooks in their service provider. When the hook fires, PromptGate calls the plugin's handler:

| Hook | Fires when |
|---|---|
| `provider.resolve` | A provider template resolves to a provider implementation |
| `request.before` | A request is about to be sent to a provider |
| `response.after` | A response has been received from a provider |
| `budget.threshold` | A budget limit reaches a configured threshold |
| `auth.event` | An authentication event occurs |

## Publishing to the marketplace

To publish a plugin to **marketplace.promptgate.dev**:

1. Develop and test your plugin locally
2. Submit the plugin for review through the developer portal
3. Akyros Labs reviews the plugin for security and quality
4. Approved plugins are signed and published to the marketplace
5. Users can install the plugin from the dashboard or CLI

## Development tools

The following Artisan commands will be available for plugin development:

```bash
# Scaffold a new plugin
php artisan promptgate:plugin:make vendor/plugin-name

# Run plugin tests in isolation
php artisan promptgate:plugin:test vendor/plugin-name

# Package a plugin for submission
php artisan promptgate:plugin:package vendor/plugin-name
```

Detailed SDK documentation, including full interface definitions and example plugins, will be published when the plugin system is available.
