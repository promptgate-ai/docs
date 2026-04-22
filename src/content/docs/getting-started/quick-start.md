---
title: Quick Start
description: Get up and running in 5 minutes
---

This guide walks you through the core workflow: install PromptGate, create a project, store a provider credential, and configure a provider template. By the end, you will have a working gateway configuration ready for endpoints.

## Step 1 — Install and log in

Follow the [Installation guide](/getting-started/installation/) to start PromptGate with Docker:

```bash
docker compose up -d
```

Open `http://localhost:8000` and log in with the default credentials:

```
Email:    admin@promptgate.dev
Password: admin
```

:::tip
Change the default password immediately via your account settings.
:::

## Step 2 — Create a project

Projects are the top-level container for all gateway resources. Each project has a type that determines its capabilities.

1. Click **Projects** in the sidebar
2. Click **Create Project**
3. Fill in the details:
   - **Name:** `My AI Gateway`
   - **Type:** `AI Gateway`
   - **Description:** *(optional)*
4. Click **Create**

You are now inside your new project. The project switcher in the top navigation lets you move between projects at any time.

:::note
The four project types are **AI Gateway** (AI endpoint routing), **AI Wrapper** (OpenAI-compatible API surface), **API Gateway** (HTTP proxy), and **MCP Gateway** (MCP tool server). Choose the type that matches your use case. See [Projects](/features/projects/) for details.
:::

## Step 3 — Add a credential

Credentials store your provider API keys with AES-256-GCM encryption.

1. Navigate to **Credentials** in the sidebar
2. Click **Create Credential**
3. Select a provider (e.g., **OpenAI**)
4. Paste your API key
5. Click **Create**

The key is encrypted and stored. You will see the masked version (e.g., `sk-...abc123`) — the full key is never displayed again after creation.

:::caution
Copy and save your API key before creating the credential if you need it elsewhere. PromptGate encrypts it immediately and will only show a masked version from this point on.
:::

## Step 4 — Create a provider template

Provider templates bundle a provider, model, and default settings into a reusable configuration.

1. Navigate to **Provider Templates** in the sidebar
2. Click **Create Template**
3. Walk through the wizard:
   - **Identity:** Name it `GPT-4o Default`, add optional tags
   - **Provider & Model:** Select **OpenAI** and **gpt-4o**
   - **Settings:** Set temperature to `0.7`, max tokens to `4096`
   - **Visibility:** Choose **Project** (available only in the current project) or **Global** (available in all projects)
4. Click **Create**

The template is now ready to be attached to endpoints.

## Step 5 — Create an endpoint (coming soon)

Endpoints are the execution points that your applications call. Each endpoint binds a fixed system prompt, a provider template, and access controls into a single URL.

This feature is under active development. Once available, the workflow will be:

1. Navigate to **Endpoints** in the sidebar
2. Click **Create Endpoint**
3. Assign a provider template, write your system prompt, configure budget limits
4. Use the generated endpoint URL in your application

## What's next

- Learn more about [Projects](/features/projects/) and the four gateway types
- Understand [Credential](/features/credentials/) security and encryption
- Explore [Provider Templates](/features/provider-templates/) and their settings
- Read about [Configuration](/getting-started/configuration/) to customize your deployment
