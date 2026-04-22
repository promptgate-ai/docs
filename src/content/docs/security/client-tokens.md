---
title: Client Tokens
description: API authentication tokens
---

:::note
Client tokens are under active development and not yet available. This page describes the planned functionality.
:::

Client tokens are API keys that external applications use to authenticate with PromptGate endpoints. They replace the need to share provider API keys with callers.

## Token format

PromptGate client tokens use a prefixed format that makes them easy to identify and scan for in logs or code:

| Prefix | Environment | Example |
|---|---|---|
| `pg_live_` | Production | `pg_live_a1b2c3d4e5f6...` |
| `pg_test_` | Testing / Staging | `pg_test_x9y8z7w6v5u4...` |

The prefix tells you at a glance whether a token is for production or testing, which helps prevent accidental misuse.

## Security

### Hashing

Client tokens are **SHA-256 hashed** before storage. PromptGate stores only the hash — the plaintext token is shown once at creation and cannot be retrieved afterward.

This means:

- A database breach does not expose usable tokens
- Tokens cannot be exported or viewed after creation
- Lost tokens must be revoked and replaced

### Scoping

Each client token can be scoped to control what it can access:

- **Project scope** — Limit the token to a specific project
- **Endpoint scope** — Limit the token to specific endpoints within a project
- **Permission scope** — Read-only, execute-only, or full access

### Expiration

Tokens can be configured with an expiration date. Expired tokens are automatically rejected. For long-lived integrations, use non-expiring tokens with regular manual rotation.

## Planned workflow

### Creating a token

1. Navigate to **Client Tokens** in the sidebar (within your active project)
2. Click **Create Token**
3. Configure:
   - **Name** — Descriptive label (e.g., `Mobile App Production`)
   - **Environment** — Production (`pg_live_`) or Testing (`pg_test_`)
   - **Scopes** — Which endpoints or resources the token can access
   - **Expiration** — Optional expiration date
4. Click **Create**
5. **Copy the token immediately** — it will not be shown again

### Revoking a token

Revoked tokens are immediately rejected on all subsequent requests. Revocation is instant and cannot be undone — create a new token if needed.

### Usage

Include the token in the `Authorization` header:

```bash
curl -X POST https://gateway.example.com/api/v1/endpoints/summarize \
  -H "Authorization: Bearer pg_live_a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -d '{"input": "Summarize this text..."}'
```
