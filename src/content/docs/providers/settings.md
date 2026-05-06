---
title: Provider Settings
description: Gateway-wide enable / disable per provider.
---

The **Providers** admin page lists all 8 registered providers with KPIs and a per-provider toggle. Disabling a provider here makes it reject every request gateway-wide, regardless of which project / endpoint / wrapper made the call.

Use this when you want to **stop using a provider in seconds** without touching credentials or endpoints — during incidents, billing pauses, compliance holds.

## What you see

Top-right user menu → **AI Providers**.

![Providers index — placeholder](#)

| Element | Meaning |
|---|---|
| **KPI strip** | Total / Enabled / Disabled / Requests last 24h |
| **Card per provider** | Identity, status dot, ON/OFF chip, Configure / Disable buttons |
| **Disabled cards** | Render at 55% opacity — easy to spot at a glance |

Each card also shows:

- **MODELS** — distinct model identifiers in active endpoints + templates for this provider
- **p95** — latency over the last 24h (only `ok` requests counted)
- **SHARE** — % of total gateway traffic that hit this provider

## Enabling / disabling

Click **Disable** on an enabled card → the provider is now rejecting requests:

- Existing endpoints / wrapper routes return `503 Provider 'openai' is disabled in this gateway.`
- The card flips to OFF, opacity drops, the action button becomes **Enable**

Click **Enable** on a disabled card → restored.

This is implemented in `provider_settings` (one row per provider key, with `is_enabled` boolean). Default behaviour when no row exists: **enabled**. So a fresh install has no rows and every provider is enabled.

## Why disable?

- **Incident** — provider is having an outage, you want to fail fast and force failover paths instead of timing out per request.
- **Cost** — billing alert, you want to stop spending while you investigate.
- **Compliance** — a region is added to a data-locality requirement; pause the provider until you've migrated.
- **Testing** — verify that endpoint failover chains actually fail over.

## What it doesn't do

- ❌ It doesn't disable individual models (no per-model granularity in v1).
- ❌ It doesn't preserve in-flight requests (any active call completes, but new ones get 503).
- ❌ It doesn't disable **upstream** OAuth connections in the API Gateway — those are independent.
- ❌ It doesn't notify clients pre-emptively. Clients see 503 on the next request.

## Detail page

Clicking the **Configure** button on a card opens the provider detail page with:

- All credentials registered for this provider
- All provider templates referencing it
- All AI endpoints currently routing through it (so you can see the blast radius)

Useful before you flip the switch.

## Audit

Each toggle writes an audit entry: `provider.enabled` or `provider.disabled` with the provider label as `target`. Filter the audit log to see who flipped what when.

## Programmatic toggle

There's no public API for this — it's an admin-only UI action. If you need automation (e.g. an incident runbook), use the **MCP Control Plane** to script it once that's wired (currently the Control Plane has read tools for providers; toggle endpoints via Tinker).

---

Next: **[Adding a Provider](/providers/adding/)** — for plugin / extension authors.

---

> © Akyros Labs LLC. All rights reserved.
