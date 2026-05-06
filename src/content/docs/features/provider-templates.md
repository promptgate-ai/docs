---
title: Provider Templates
description: Reusable provider + model + credential + default-settings bundles. Attach to endpoints instead of configuring from scratch.
---

A **Provider Template** is a named bundle of `(provider, model, credential, default settings)` that endpoints can reference. Without templates, each endpoint repeats the same provider config; with templates, you change one row and every endpoint inherits.

## When to use templates

✅ You have many endpoints all hitting `gpt-4o-mini` with `temperature=0.7` and the same OpenAI credential — make a template, attach all endpoints to it.
✅ You want to swap a model gateway-wide (`gpt-4o-mini` → `gpt-4o`) — edit the template, every endpoint follows.
✅ You want a single audit point for "what's our default chat model" — the template name is it.

❌ You have one experimental endpoint with unique settings — manual mode is fine.
❌ Each endpoint genuinely uses a different provider+model — templates would just add indirection.

## Anatomy

| Field | Notes |
|---|---|
| `name` | Human-readable. Shown in endpoint pickers. |
| `slug` | Auto-generated URL-safe identifier. |
| `description` | Free text. Where you explain *why* this template exists. |
| `tags` | Free-form labels for filtering. |
| `provider_key` | Which adapter (`openai`, `anthropic`, …). |
| `provider_model` | Provider-specific model identifier. |
| `credential_id` | Which encrypted API key to use. |
| `temperature` | Default `0.0`–`2.0`. |
| `top_p` | Default `0.0`–`1.0`. |
| `max_output_tokens` | Default response cap. |
| `is_active` | Inactive templates are hidden from endpoint pickers. |

## Creating a template

Top-right user menu → **Provider Templates** → **+ New template**.

The wizard has 4 tabs:

![Provider template wizard — placeholder](#)

### Tab 1 — Identity

- **Name**: e.g. `GPT-4o-mini Standard`
- **Description**: free text
- **Tags**: comma-separated — appear as chips in the list

### Tab 2 — Provider

- **Provider**: dropdown of the 8 registered providers
- **Model**: provider-specific identifier (e.g. `gpt-4o-mini`)
- **Credential**: filtered by provider — only credentials that match show up

### Tab 3 — Settings

- **Temperature** (default `1.0`)
- **Top P** (default `1.0`)
- **Max output tokens** (default `1000`)

### Tab 4 — Activation

Single toggle: **Active**. Inactive templates can't be attached to new endpoints (but existing endpoints keep working).

Save.

## Using a template on an endpoint

In the endpoint wizard's **Tab 2 — Provider**:

- Pick **Provider Template** mode.
- Choose your template from the dropdown.

The endpoint's provider/model/credential are now read from the template at request time. The endpoint can still **override** runtime settings:

- `temperature` (endpoint > template)
- `top_p` (endpoint > template)
- `max_output_tokens` (endpoint > template)

If the endpoint leaves these fields at defaults, the template's values win. This pattern lets you keep "company-wide standards" in the template and "endpoint-specific tuning" on the endpoint.

## What changes when I edit a template?

Editing a template **immediately** affects every endpoint that references it. The next request through any of those endpoints will use the new values. There's no caching or per-endpoint snapshot.

So if you change the model from `gpt-4o-mini` to `gpt-4o`:

- All endpoints with this template start hitting `gpt-4o` on the next request.
- Their `gateway_logs` rows record `provider_model = gpt-4o` from that point on.
- No restart, no migration, no downtime.

This is powerful — and dangerous. Always think "is this safe to change live?" before editing a widely-used template. Use **deactivate** to test the impact: deactivate a template, verify which endpoints fail-open or fail-closed, then iterate.

## Deactivate vs delete

| Action | Effect |
|---|---|
| **Deactivate** | Template is hidden from new-endpoint pickers. Existing endpoints with this template start failing requests. Reversible. |
| **Delete** | Removes the row. Endpoints with `provider_template_id` pointing to it have it nulled out (foreign key `nullOnDelete`). Those endpoints lose their provider config and break unless they had manual config too. |

## Examples

### Cheap default

```
Name:       OpenAI Mini Standard
Provider:   OpenAI
Model:      gpt-4o-mini
Credential: OpenAI Production
Temperature: 0.7
Top P:       1.0
Max tokens:  1000
```

Use this for every endpoint that doesn't need `gpt-4o`. When OpenAI releases the next mini model, edit one template.

### Quality endpoint

```
Name:       Anthropic Sonnet Premium
Provider:   Anthropic
Model:      claude-sonnet-4-6-20251001
Credential: Anthropic Production
Temperature: 0.5
Top P:       1.0
Max tokens:  4000
```

Attach to endpoints where output quality matters more than cost.

### Local fallback

```
Name:       Ollama Llama Local
Provider:   Ollama
Model:      llama3
Credential: Ollama Localhost (placeholder)
Temperature: 0.6
```

Use this in failover chains as a free local backup when paid providers are unreachable.

## Detail page

Each template's detail page shows:

- Identity + provider config + settings
- **Endpoints using this template** — list with link to each
- Activate / deactivate / delete actions

Useful sanity check before editing: "what am I about to change?"

---

Next: **[Provider Settings](/providers/settings/)** — gateway-wide enable/disable.

---

> © Akyros Labs LLC. All rights reserved.
