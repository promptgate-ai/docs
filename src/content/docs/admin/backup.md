---
title: Backup / Export
description: One-click ZIP snapshot of every table — manifest + JSON dumps. Encrypted columns stay encrypted.
---

The **Backup / Export** page in the admin area produces a **portable ZIP** of every table the gateway owns. Use it for routine backups, before risky upgrades, or to migrate state to another instance.

## Where it lives

Top-right user menu → **Backup / Export** (admin sidebar → SYSTEM section).

![Backup page — placeholder](#)

## What's in the ZIP

```
promptgate-backup-2026-05-06-101422.zip
├── manifest.json
└── tables/
    ├── users.json
    ├── projects.json
    ├── endpoints.json
    ├── api_gateway_endpoints.json
    ├── mcp_servers.json
    ├── oauth_service_connections.json
    ├── credentials.json
    ├── provider_templates.json
    ├── provider_settings.json
    ├── guardrail_configs.json
    ├── api_tokens.json
    ├── webhooks.json
    ├── wrapper_provider_settings.json
    ├── wrapper_aliases.json
    └── (optional) gateway_logs.json
    └── (optional) audit_logs.json
```

### `manifest.json`

```json
{
  "format_version": 1,
  "app_name": "PromptGate",
  "app_url": "https://gateway.your-domain.com",
  "created_at": "2026-05-06T10:14:22Z",
  "tables": {
    "users": 1,
    "projects": 4,
    "endpoints": 12,
    "credentials": 3,
    ...
  },
  "options": {
    "include_gateway_logs": false,
    "include_audit": false
  },
  "note": "Encrypted columns are stored in their on-disk ciphertext form; restore requires the same APP_KEY."
}
```

The manifest is the single source of truth for "what's in this archive". Future restore tooling will use `format_version` for compatibility decisions.

### `tables/<name>.json`

Each file is a JSON array of rows from that table. Encrypted columns are exported in their **on-disk ciphertext form** (the same blob that's in the database). They're not decrypted in transit.

## Optional flags

The form has two checkboxes:

- **Include gateway logs** — adds `gateway_logs.json`. Can be huge (1 row per request).
- **Include audit log** — adds `audit_logs.json`. Smaller but still grows over time.

Default: both off. Routine backups are small, fast, and sufficient for restoring configuration. Logs are a bonus for forensic investigations.

## Why encryption stays encrypted

Two reasons:

1. **Security contract** — credentials / OAuth tokens / MCP bearers are encrypted at rest. Decrypting them into the backup widens the leak radius (anyone with backup access has plaintext).
2. **APP_KEY portability** — restoring requires the same APP_KEY. That's a feature: it ties the backup to the deployment that produced it.

If you migrate to a new APP_KEY (intentional rotation), use `php artisan key:rotate` to re-encrypt everything **in place** before the backup, then back up.

## Why API tokens aren't fully restorable

API tokens are stored as SHA-256 **hashes** — the plaintext only existed at create time and was shown to the user once. So:

- The backup contains the hashes (you can't recover plaintexts).
- Restoring a backup gives you back the same rows, but **clients who had the old plaintext lost it during the restore window**. They'd have to be reissued tokens.

Best practice: rotate tokens after a restore. Or treat backups as configuration-only.

## Audit

Each export writes:

```
event:    backup.exported
target:   promptgate-backup-2026-05-06-101422.zip
metadata: { size_bytes: 384721, options: { include_gateway_logs: false, include_audit: false } }
actor:    <admin email>
```

So you have a record of who downloaded what, when.

## Streaming

The download is built into a temp file and streamed via `BinaryFileResponse::deleteFileAfterSend(true)`. The temp file is removed once the client has fully received it. For very large exports, this means the gateway holds the temp file while the download is in progress — make sure your `/tmp` (or wherever PHP's `sys_get_temp_dir()` resolves) has enough space.

## Restore (status)

**A first-class restore command is on the roadmap.** Until then, restore is manual:

1. Boot a fresh PromptGate with the **same APP_KEY**.
2. Run `php artisan migrate --force` to create the schema.
3. Use `php artisan tinker` to insert rows from each `tables/*.json`:

```php
$rows = json_decode(file_get_contents('credentials.json'), true);
foreach ($rows as $row) {
    \App\Models\Credential::query()->insert($row);
}
```

(Skip `id` collisions if you're restoring onto an existing instance — copy the rows you need rather than truncate first.)

This is fine for occasional disaster recovery. For routine cross-instance moves, wait for the proper restore command.

## Best practices

- **Daily** — schedule a `wget`-via-session-cookie or a small artisan command to call the export and ship the ZIP off-host.
- **Encrypt at rest** — the ZIP itself isn't encrypted; the columns inside are. If the ZIP file may end up somewhere untrusted, wrap it (`gpg --encrypt`).
- **Off-site** — keep a copy in a different region / cloud provider.
- **Test restore** — once a quarter, restore into a scratch instance and verify a request still works.

---

Next: **[API Reference Overview](/api/overview/)**.

---

> © Akyros Labs LLC. All rights reserved.
