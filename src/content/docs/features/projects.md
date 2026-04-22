---
title: Projects
description: Organize your gateway resources into projects
---

Projects are the top-level organizational unit in PromptGate. Every credential, provider template, endpoint, and client token belongs to a project. Projects provide isolation between different applications, teams, or environments.

## Project types

Each project has a type that determines what kind of gateway resources it can contain. Choose the type that matches your use case when creating a project.

### AI Gateway

The primary project type. AI Gateway projects route requests to AI providers through fixed-prompt endpoints. Each endpoint binds a system prompt, a provider template, and access controls into a single callable URL.

Use this when you want to expose purpose-built AI endpoints with locked-down prompts and provider configurations — for example, a summarization endpoint or a classification endpoint.

### AI Wrapper

AI Wrapper projects expose an OpenAI-compatible API surface (e.g., `/v1/chat/completions`) that routes to any configured provider behind the scenes. Applications that already use the OpenAI SDK can point to PromptGate instead and gain centralized credential management, logging, and budget controls without changing their code.

Use this when you want a drop-in replacement for the OpenAI API that can route to multiple providers.

### API Gateway

API Gateway projects act as an HTTP proxy for non-AI upstream APIs. They provide the same authentication, rate limiting, and logging capabilities but for traditional REST or GraphQL APIs.

Use this when you want to centralize access control for third-party APIs alongside your AI providers.

### MCP Gateway

MCP Gateway projects expose endpoints as MCP (Model Context Protocol) tools. MCP-compatible clients like Claude Desktop can discover and invoke these tools directly.

Use this when you want AI assistants to have structured access to your endpoints as callable tools.

## Creating a project

1. Navigate to **Projects** in the sidebar
2. Click **Create Project**
3. Fill in the details:
   - **Name** — A descriptive name (e.g., `Production AI`, `Staging API`)
   - **Type** — Select one of the four project types
   - **Description** — Optional notes about the project's purpose
4. Click **Create**

The project is created and you are taken to its dashboard.

## Project switcher

The project switcher in the top navigation bar shows your currently active project and lets you switch between projects. All resources displayed in the sidebar (credentials, templates, endpoints) are scoped to the active project.

Click the project name in the navigation bar to open the switcher, then select a different project. The page refreshes to show resources for the selected project.

## Project settings

Inside a project, you can:

- **Edit** the project name and description
- **View** the project type (cannot be changed after creation)
- **Delete** the project and all its resources

:::caution
Deleting a project permanently removes all credentials, provider templates, endpoints, and client tokens associated with it. This action cannot be undone.
:::

## Resource scoping

Resources belong to a project and are isolated from other projects by default:

| Resource | Scoping |
|---|---|
| Credentials | Always project-scoped |
| Provider Templates | Project-scoped or global (configurable) |
| Endpoints | Always project-scoped |
| Client Tokens | Always project-scoped |

Provider templates can optionally be marked as **global**, making them available across all projects. This is useful for organization-wide default configurations. See [Provider Templates](/features/provider-templates/) for details.
