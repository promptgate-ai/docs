---
title: Provider Templates
description: Reusable provider + model + settings bundles
---

Provider templates are reusable configurations that bundle a provider, model, and default inference settings into a single named resource. Endpoints reference a provider template instead of specifying provider details directly, making it easy to change models or settings across multiple endpoints at once.

## What a template contains

A provider template has four sections, configured through a step-by-step wizard.

### 1. Identity

- **Name** — A descriptive name (e.g., `GPT-4o Production`, `Claude Sonnet Fast`)
- **Slug** — Auto-generated URL-safe identifier, based on the name
- **Tags** — Optional labels for organizing and filtering templates

### 2. Provider and Model

- **Provider** — The AI provider to use (e.g., OpenAI, Anthropic, Google, Mistral)
- **Model** — The specific model from that provider (e.g., `gpt-4o`, `claude-sonnet-4-20250514`, `gemini-2.0-flash`)

The available models update based on the selected provider.

### 3. Default settings

These settings control the inference behavior and apply as defaults to any endpoint using this template. Endpoints can override these values individually.

| Setting | Description | Typical range |
|---|---|---|
| `temperature` | Controls randomness of the output. Lower values produce more deterministic responses. | `0.0` – `2.0` |
| `top_p` | Nucleus sampling threshold. An alternative to temperature for controlling randomness. | `0.0` – `1.0` |
| `max_tokens` | Maximum number of tokens in the response. | `1` – model limit |
| `timeout` | Request timeout in seconds. PromptGate cancels the provider request if it exceeds this duration. | `5` – `300` |

:::tip
Set `temperature` to `0` for deterministic tasks like classification or extraction. Use `0.7`–`1.0` for creative tasks like content generation.
:::

### 4. Visibility

- **Project** — The template is only available within the project where it was created
- **Global** — The template is available across all projects in the PromptGate instance

Global templates are useful for organization-wide defaults. For example, you might create a global `GPT-4o Standard` template that every project can reference.

## Creating a provider template

1. Navigate to **Provider Templates** in the sidebar (within your active project)
2. Click **Create Template**
3. Complete the wizard:
   - **Step 1:** Enter the name and optional tags
   - **Step 2:** Select the provider and model
   - **Step 3:** Configure default settings (temperature, top_p, max_tokens, timeout)
   - **Step 4:** Choose visibility (project or global)
4. Click **Create**

## How endpoints use templates

When an endpoint receives a request, it uses its assigned provider template to determine:

1. **Which provider and model** to call
2. **Which credential** to authenticate with (matched by provider within the project)
3. **What default settings** to apply (temperature, top_p, max_tokens, timeout)

The endpoint can override any default setting from the template. This means you can have a single template shared across endpoints while tuning individual endpoints as needed.

```
Request → Endpoint → Provider Template → Credential → Provider API
                     (model + settings)   (API key)    (OpenAI, etc.)
```

## Managing templates

### Editing a template

You can update any field on an existing template. Changes take effect immediately for all endpoints using that template.

:::caution
Editing a global template affects every endpoint across every project that references it. Verify the impact before making changes.
:::

### Deleting a template

Deleting a template removes it from the system. Any endpoint that was using the template will need to be reassigned to a different one.

## Examples

**High-quality generation:**

| Setting | Value |
|---|---|
| Provider | OpenAI |
| Model | `gpt-4o` |
| Temperature | `0.8` |
| Max tokens | `4096` |
| Timeout | `120` |

**Fast classification:**

| Setting | Value |
|---|---|
| Provider | Anthropic |
| Model | `claude-haiku-4-20250414` |
| Temperature | `0` |
| Max tokens | `100` |
| Timeout | `15` |

**Cost-effective summarization:**

| Setting | Value |
|---|---|
| Provider | Google |
| Model | `gemini-2.0-flash` |
| Temperature | `0.3` |
| Max tokens | `2048` |
| Timeout | `60` |
