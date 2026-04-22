---
title: API Tokens
description: API authentication tokens for PromptGate endpoints
---

API tokens are Bearer tokens that external applications use to authenticate with PromptGate endpoints. They replace the need to share provider API keys with callers.

## Token format

PromptGate API tokens use a prefixed format that makes them easy to identify and scan for in logs or code:

| Prefix | Environment | Example |
|---|---|---|
| `pg_live_` | Production | `pg_live_a1b2c3d4e5f6...` |
| `pg_test_` | Testing / Staging | `pg_test_x9y8z7w6v5u4...` |

The prefix tells you at a glance whether a token is for production or testing, which helps prevent accidental misuse.

## Creating a token

1. Navigate to **Security → API Tokens** in the sidebar (within your active project)
2. Enter a descriptive **Name** (e.g., `Mobile App Production`)
3. Select **Environment** — Live (`pg_live_`) or Test (`pg_test_`)
4. Click **Generate**
5. **Copy the token immediately** — it will not be shown again

The dashboard shows a yellow banner with the token and a copy button right after creation. Once you navigate away, the plaintext token is gone forever.

## Security

### Hashing

API tokens are **SHA-256 hashed** before storage. PromptGate stores only the hash — the plaintext token is shown once at creation and cannot be retrieved afterward.

This means:

- A database breach does not expose usable tokens
- Tokens cannot be exported or viewed after creation
- Lost tokens must be revoked and replaced

### Project scoping

Each API token is scoped to a single project. A token for Project A cannot access endpoints in Project B. This is enforced at the middleware level — the token resolves to a project before any endpoint lookup.

## Revoking a token

Click **Revoke** next to any active token in the dashboard. Revoked tokens are immediately rejected on all subsequent requests. Revocation is instant and cannot be undone — create a new token if needed.

## Usage

Include the token in the `Authorization` header:

```bash
curl -X POST https://gateway.example.com/api/v1/endpoints/summarize \
  -H "Authorization: Bearer pg_live_a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -d '{"message": "Summarize this text..."}'
```

The gateway validates the token, resolves the project, finds the endpoint by slug, and routes to the configured AI provider.

## Token tracking

Each token tracks its `last_used_at` timestamp, visible in the dashboard. This helps identify unused tokens for cleanup.
