---
title: API Gateway
description: HTTP proxy for upstream APIs
---

:::note
API Gateway is under active development and not yet available. This page describes the planned functionality.
:::

API Gateway projects provide HTTP proxying for non-AI upstream APIs. They bring the same authentication, logging, and rate limiting capabilities of PromptGate to traditional REST and GraphQL services.

## Concept

Organizations often manage dozens of third-party API integrations, each with its own credentials and access patterns. API Gateway projects let you centralize these behind PromptGate:

- **Single authentication layer** — Callers authenticate with PromptGate client tokens instead of managing individual API keys
- **Credential rotation** — Update upstream API keys in PromptGate without touching client applications
- **Request logging** — Every proxied request is logged with timing, status codes, and metadata
- **Rate limiting** — Control how many requests each client can make to upstream APIs

## Planned features

### Upstream configuration

Define upstream API targets with base URLs, authentication headers, and timeout settings. PromptGate injects stored credentials into outbound requests.

### Path mapping

Map PromptGate endpoint paths to upstream API paths. Callers hit PromptGate URLs, and requests are forwarded to the correct upstream with credentials attached.

### Request and response transforms

Modify headers, query parameters, or body content on the way in or out. Useful for adapting between different API formats or injecting required headers.

### Health checks

PromptGate can periodically check upstream API health and report status through the dashboard.
