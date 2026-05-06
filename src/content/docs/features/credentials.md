---
title: Credentials
description: Encrypted provider API key storage. AES-256-GCM at rest, plaintext shown once.
---

A **credential** stores one provider API key in the database, encrypted at rest. Endpoints and provider templates reference credentials by ID — they never carry the plaintext.

## How encryption works

PromptGate encrypts the `secret` column with **AES-256-GCM** via Laravel's `encrypted` cast. The key is derived from `APP_KEY`.

When you create a credential:

1. The plaintext is encrypted with AES-256-GCM (`encrypt()` from Laravel's encrypter).
2. The ciphertext is stored in `credentials.secret`.
3. A short masked preview (`sk-...123` for OpenAI-style keys) is computed for the UI.
4. The plaintext is discarded.

When PromptGate calls upstream:

1. Eloquent decrypts `credentials.secret` on read.
2. The plaintext is passed to the provider adapter as a function argument.
3. It's used for one HTTP call and never logged, cached, or written back.

## Important: APP_KEY is the master key

```
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This 32-byte AES key decrypts **every credential** AND every other encrypted column (OAuth tokens, MCP server bearers, OAuth client secrets). Lose it and the data is unrecoverable.

**Back it up alongside your database.** If you ever need to restore from a backup ZIP, you need the same `APP_KEY` — see **[Backup / Export](/admin/backup/)**.

## Creating a credential

Top-right user menu → **Credentials** → **+ New credential**.

![Credential create — placeholder](#)

| Field | Notes |
|---|---|
| **Name** | Human-readable label. Show up everywhere. |
| **Provider** | Picks the adapter and constrains where the credential is usable. |
| **Secret** | The plaintext API key. **Encrypted immediately on save.** |

Click save. From now on, only a short masked preview is shown. The full key is gone from the UI.

:::caution[One-time display of the plaintext]
PromptGate doesn't store the plaintext anywhere — only the encrypted form. **You can't reveal it later.** If you need the key again (for some other tool), copy it before saving the credential, or treat your provider's dashboard as the source of truth.
:::

## Listing credentials

The Credentials list (admin → Credentials) shows:

- **Name**, masked preview, provider badge.
- **Active / inactive** chip — inactive credentials are skipped by every consumer.
- **Used by** counts — provider templates and endpoints referencing this credential.
- KPI strip at the top: total / active / providers covered.

## Editing a credential

You can edit:

- The **name**.
- Whether it's **active**.
- The **provider** is locked after create (it's part of the credential's identity).

To rotate the secret:

1. Create a **new** credential with the same name suffix (`OpenAI Prod (rotated 2026-05)`).
2. Reassign endpoints / templates / OAuth-PII config to the new one.
3. Deactivate or delete the old one.

There's no "rotate in place" because that would require re-entering the plaintext and we'd rather not have a UI that prompts users to paste their secret a second time.

## Deactivate vs delete

| Action | Effect |
|---|---|
| **Deactivate** | Sets `is_active=false`. Endpoints / templates referencing it can't use it; calls fail with `Provider call failed: …`. The row is preserved. Reversible. |
| **Delete** | Removes the row entirely. Endpoints / templates with `credential_id` pointing to it have it nulled out (foreign key `nullOnDelete`). Irreversible. |

Use **deactivate** when troubleshooting — easy to revert. Use **delete** when retiring a credential permanently.

## Where credentials are used

Credentials appear in three places:

1. **AI Endpoints** — `endpoint.credential_id` directly (manual mode) or via `endpoint.provider_template_id → template.credential_id`.
2. **Wrapper Provider Settings** — `wrapper_provider_settings.credential_id` per project per provider.
3. **PII Contextual Config** — `PII_CONTEXTUAL_CREDENTIAL_ID` env var picks one for the LLM-backed PII detection.

So one credential can be reused across many projects and endpoints.

## Security boundaries

- **Encrypted at rest**. A DB-only leak does not expose plaintext.
- **Decrypted on demand**, used immediately, discarded.
- **No log redaction needed** — the secret never enters logs because the adapter only sees it as a function argument and doesn't include it in the request body.
- **APP_KEY rotation** — Laravel supports `php artisan key:rotate` to re-encrypt with a new APP_KEY. Plan downtime; rotating the key without re-encrypting will brick all credentials.
- **Audit** — `credential.created` / `credential.updated` / `credential.deactivated` / `credential.deleted` are all logged.

## Audit

Every credential CRUD action writes to `audit_logs`. Filter by `event LIKE 'credential.%'` on the audit page.

## Common patterns

- **Per-environment** — `OpenAI Production`, `OpenAI Staging`, `OpenAI Dev`. Each pinned to its own provider key. Deactivate a stage during an incident without touching others.
- **Per-purpose** — `OpenAI Cheap (gpt-4o-mini billing)`, `OpenAI Premium (gpt-4o billing)`. Useful when you want different cost ownership.
- **Provider-failover** — keep `OpenAI Primary` and `OpenAI Backup` as separate credentials. The endpoint's failover chain can swap between them on rate limits.

---

Next: **[Provider Templates](/features/provider-templates/)**.

---

> © Akyros Labs LLC. All rights reserved.
