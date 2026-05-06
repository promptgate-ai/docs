---
title: Configuration
description: Every environment variable that matters, grouped by what it controls.
---

PromptGate is configured via the `backend/.env` file (or via `environment:` in Docker Compose). This page is the **complete reference** — every var that ships in `.env.example` plus the feature-specific ones added by guardrails, OAuth, SSRF, and the contextual PII detector.

> Anything not listed here is either a Laravel internal you can ignore, or a sensible Laravel default.

## Core

| Variable | Default | Notes |
|---|---|---|
| `APP_NAME` | `"PromptGate v2"` | Shown in browser title and emails. |
| `APP_ENV` | `local` | `local` / `staging` / `production`. Set to `production` in prod. |
| `APP_KEY` | _(generate it)_ | 32-byte AES key in `base64:…` format. **Encrypts every credential, OAuth token, and MCP server bearer.** Losing it = unrecoverable secrets. |
| `APP_DEBUG` | `true` | **Set to `false` in production.** |
| `APP_URL` | `http://localhost:8000` | Public URL. Used in OAuth callback, MCP bridge URL, curl examples shown in the UI. |
| `APP_LOCALE` | `en` | Default UI language. (Currently English only.) |
| `APP_TIMEZONE` | `UTC` | Used for log timestamps and audit entries. |
| `BCRYPT_ROUNDS` | `12` | Password hash cost. `4` in tests, `12` in prod. |

:::caution[APP_KEY is the master key]
The `APP_KEY` decrypts **every credential and OAuth token** in your database. Back it up alongside your database. **Don't reuse the example key from `.env.example`** — it's published in this repo.
:::

To generate a fresh one:

```bash
docker compose exec app php artisan key:generate
```

## Database

PromptGate supports SQLite (default), MySQL 8+, and PostgreSQL 14+. See **[Database Setup](/getting-started/database/)** for the swap procedure.

| Variable | Default | Notes |
|---|---|---|
| `DB_CONNECTION` | `sqlite` | `sqlite` / `mysql` / `pgsql`. |
| `DB_DATABASE` | `database/database.sqlite` | SQLite file path **or** database name for MySQL/Postgres. |
| `DB_HOST` | `127.0.0.1` | Ignored for SQLite. |
| `DB_PORT` | `3306` (mysql) / `5432` (pgsql) | |
| `DB_USERNAME` | `root` | |
| `DB_PASSWORD` | _(empty)_ | |

## Sessions, Cache, Queue

| Variable | Default | Notes |
|---|---|---|
| `SESSION_DRIVER` | `database` | `database` / `redis` / `array` (test only) / `file`. |
| `SESSION_LIFETIME` | `120` | Minutes of session idle before logout. |
| `SESSION_ENCRYPT` | `false` | Encrypt session payloads (small CPU cost). |
| `CACHE_STORE` | `database` | `database` / `redis` / `file` / `array` (tests). Used by **[rate limits](/security/rate-limits/)** for the per-minute / per-hour bucket counters. |
| `QUEUE_CONNECTION` | `database` | `database` / `redis` / `sync`. Webhooks dispatch through this. |
| `BROADCAST_CONNECTION` | `log` | Not currently wired to live UI. |

For production, **Redis** for cache + sessions + queue is recommended:

```env
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Logging

| Variable | Default | Notes |
|---|---|---|
| `LOG_CHANNEL` | `stack` | `stack` / `single` / `daily` / `stderr`. Set to `stderr` in Docker so logs land in `docker logs`. |
| `LOG_STACK` | `single` | Channels combined when `LOG_CHANNEL=stack`. |
| `LOG_LEVEL` | `debug` | `debug` / `info` / `warning` / `error`. Set to `warning` in prod. |
| `LOG_DEPRECATIONS_CHANNEL` | `null` | Where deprecations go. |

## Mail

Used by webhooks (in the future) and password-reset emails. Defaults are off-line / safe.

| Variable | Default | Notes |
|---|---|---|
| `MAIL_MAILER` | `log` | `log` writes mails to the log file (great for dev). `smtp` / `ses` / `mailgun` / `postmark` for prod. |
| `MAIL_HOST` | `127.0.0.1` | |
| `MAIL_PORT` | `2525` | |
| `MAIL_USERNAME` | `null` | |
| `MAIL_PASSWORD` | `null` | |
| `MAIL_FROM_ADDRESS` | `hello@example.com` | Set this. |
| `MAIL_FROM_NAME` | `${APP_NAME}` | |

## Filesystem

| Variable | Default | Notes |
|---|---|---|
| `FILESYSTEM_DISK` | `local` | Where backups land if you ever store them in-place (default behaviour streams the ZIP directly). |

## AWS / S3 (optional)

| Variable | Default | Notes |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | _(empty)_ | |
| `AWS_SECRET_ACCESS_KEY` | _(empty)_ | |
| `AWS_DEFAULT_REGION` | `us-east-1` | |
| `AWS_BUCKET` | _(empty)_ | |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `false` | |

Used only if you point `FILESYSTEM_DISK=s3`.

## PromptGate-specific configuration

These are the env variables that control PromptGate features beyond what Laravel provides out of the box.

### Contextual PII detection (LLM-backed)

Used by **[PII Filter](/security/pii-filter/)** when `person_name` or `address` types are enabled.

| Variable | Default | Notes |
|---|---|---|
| `PII_CONTEXTUAL_ENABLED` | `true` | Master switch. Set to `false` to disable contextual detection even if a credential is configured. |
| `PII_CONTEXTUAL_CREDENTIAL_ID` | _(unset)_ | DB id of the `App\Models\Credential` row to use for the LLM call. The credential's `provider_key` picks the adapter. |
| `PII_CONTEXTUAL_MODEL` | `gpt-4o-mini` | Model identifier passed to the provider. Should be cheap + fast. |
| `PII_CONTEXTUAL_MAX_CHARS` | `8000` | Inputs longer than this skip contextual detection (regex still runs). |

```env
PII_CONTEXTUAL_ENABLED=true
PII_CONTEXTUAL_CREDENTIAL_ID=3
PII_CONTEXTUAL_MODEL=gpt-4o-mini
```

### Ollama provider base URL

Used by the local **[Ollama adapter](/providers/overview/)**.

| Variable | Default |
|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` |

Set to your Ollama instance's URL if it isn't on the same host.

### SSRF allowlist

Used by **[SSRF Protection](/security/ssrf/)** to permit specific internal hosts.

| Variable | Default | Notes |
|---|---|---|
| `SSRF_ALLOWED_HOSTS` | _(empty)_ | Comma-separated host list. `*` disables the SSRF guard entirely (only used by the test suite). |

```env
# Allow an internal API on a docker bridge network
SSRF_ALLOWED_HOSTS=internal-api.svc.local,10.0.0.42
```

### Pulse / Telescope / Nightwatch

| Variable | Default | Notes |
|---|---|---|
| `PULSE_ENABLED` | `false` | Laravel Pulse (not currently used). |
| `TELESCOPE_ENABLED` | `false` | Laravel Telescope (not currently used). |
| `NIGHTWATCH_ENABLED` | `false` | Laravel Nightwatch (not currently used). |

Leave these `false` unless you know you need them.

## A clean production `.env`

Drop-in template for a real deployment:

```env
APP_NAME="PromptGate"
APP_ENV=production
APP_KEY=base64:...                # generate with `php artisan key:generate`
APP_DEBUG=false
APP_URL=https://gateway.your-domain.com
APP_TIMEZONE=Europe/Berlin

DB_CONNECTION=pgsql
DB_HOST=db.internal
DB_PORT=5432
DB_DATABASE=promptgate
DB_USERNAME=promptgate
DB_PASSWORD=...

CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_HOST=redis
REDIS_PORT=6379

LOG_CHANNEL=stderr
LOG_LEVEL=warning

MAIL_MAILER=smtp
MAIL_HOST=smtp.your-provider.com
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_FROM_NAME="PromptGate"

# Optional features
PII_CONTEXTUAL_CREDENTIAL_ID=3
PII_CONTEXTUAL_MODEL=gpt-4o-mini
SSRF_ALLOWED_HOSTS=
```

## Reload after changing

When you change `.env`, the changes take effect on the next request — but if you have config caching enabled (`php artisan config:cache`), you need to clear it:

```bash
docker compose exec app php artisan config:clear
docker compose restart app
```

---

Next: **[Database Setup](/getting-started/database/)** — switching from SQLite to MySQL or PostgreSQL.

---

> © Akyros Labs LLC. All rights reserved.
