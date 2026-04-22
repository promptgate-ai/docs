---
title: Credentials
description: Encrypted provider API key storage
---

Credentials store your AI provider API keys securely within PromptGate. Instead of distributing API keys across applications and team members, you store them once in PromptGate and reference them through provider templates and endpoints.

## How encryption works

PromptGate encrypts every API key using **AES-256-GCM** via Laravel's built-in encryption. The encryption key is derived from your `APP_KEY` environment variable.

When a credential is stored:

1. The plaintext API key is encrypted with AES-256-GCM
2. The encrypted value is stored in the database
3. A masked version (e.g., `sk-...abc123`) is generated for display
4. The plaintext key is discarded from memory

When a request is routed through an endpoint, PromptGate decrypts the credential at runtime to authenticate with the upstream provider. The decrypted value is never logged, cached, or exposed through the API.

:::caution
The full API key is shown **once** — at the moment you create the credential. After that, only the masked version is displayed. If you need the original key for another purpose, copy it before creating the credential.
:::

## Creating a credential

1. Navigate to **Credentials** in the sidebar under **ADMIN**
2. Click **Create Credential**
3. Fill in the details:
   - **Provider** — Select the AI provider (e.g., OpenAI, Anthropic, Google, Mistral)
   - **API Key** — Paste your provider's API key
   - **Label** — Optional name to distinguish credentials for the same provider
4. Click **Create**

The credential is stored and appears in the list with its masked key.

## Managing credentials

### Viewing credentials

The credentials list shows:

- **Provider** — Which AI provider the key belongs to
- **Label** — Your optional name for the credential
- **Masked key** — The first and last few characters of the key (e.g., `sk-...abc123`)
- **Status** — Active or deactivated
- **Created at** — When the credential was added

### Deactivating a credential

You can deactivate a credential to immediately stop it from being used by any endpoint or template that references it. Deactivation does not delete the credential — it remains in the system and can be identified, but PromptGate will refuse to use it for provider requests.

1. Click the credential in the list
2. Click **Deactivate**
3. Confirm the action

:::note
Deactivating a credential affects all endpoints that use provider templates referencing it. Those endpoints will return errors until a different active credential is configured.
:::

### Deleting a credential

Deleting a credential permanently removes it from the database. The encrypted key is erased and cannot be recovered.

## Security considerations

- **Encryption at rest** — All keys are AES-256-GCM encrypted in the database. A database breach alone does not expose plaintext keys.
- **APP_KEY dependency** — Decryption requires the `APP_KEY`. Protect this value and back it up securely. If the `APP_KEY` is lost, all encrypted credentials become unrecoverable.
- **No key export** — There is no feature to export or reveal a stored key. This is by design.
- **Global scope** — Credentials are global and available to all projects. Any endpoint can reference any active credential.
- **Audit trail** — Credential creation and deactivation events are recorded in the audit log. *(Coming soon)*

## Best practices

- Create separate credentials per environment (production, staging, development)
- Use descriptive labels like `OpenAI Production` or `Anthropic Staging`
- Rotate keys regularly by creating a new credential and deactivating the old one
- Deactivate rather than delete credentials when troubleshooting, so you can re-enable them if needed
