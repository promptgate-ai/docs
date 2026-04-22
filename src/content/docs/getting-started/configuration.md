---
title: Configuration
description: Environment variables and settings
---

PromptGate is configured through environment variables, typically set in the `.env` file at the project root. When running with Docker, these variables are passed to the container via Docker Compose.

## Core settings

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `PromptGate` | Application name, shown in the UI and emails |
| `APP_ENV` | `production` | Environment: `production`, `staging`, or `local` |
| `APP_KEY` | *(generated)* | Encryption key — generated automatically during setup |
| `APP_DEBUG` | `false` | Enable debug mode. **Never enable in production.** |
| `APP_URL` | `http://localhost:8000` | Public URL of your PromptGate instance |
| `APP_TIMEZONE` | `UTC` | Application timezone |

:::caution
The `APP_KEY` is used to encrypt credentials and other sensitive data. If you lose it, all encrypted data becomes unrecoverable. Back it up securely.
:::

## Database

PromptGate supports SQLite, PostgreSQL, and MySQL. SQLite is the default for simplicity.

| Variable | Default | Description |
|---|---|---|
| `DB_CONNECTION` | `sqlite` | Database driver: `sqlite`, `pgsql`, or `mysql` |
| `DB_HOST` | `127.0.0.1` | Database host (not used for SQLite) |
| `DB_PORT` | `5432` | Database port |
| `DB_DATABASE` | `database/database.sqlite` | Database name or file path |
| `DB_USERNAME` | `promptgate` | Database username |
| `DB_PASSWORD` | *(empty)* | Database password |

**SQLite example (default):**

```env
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
```

**PostgreSQL example:**

```env
DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=promptgate
DB_USERNAME=promptgate
DB_PASSWORD=secret
```

## Redis

Redis is optional but recommended for production deployments. It is used for caching, session storage, and queue processing.

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `127.0.0.1` | Redis server host |
| `REDIS_PASSWORD` | `null` | Redis password |
| `REDIS_PORT` | `6379` | Redis port |
| `CACHE_STORE` | `file` | Cache driver: `file`, `redis`, `database` |
| `SESSION_DRIVER` | `file` | Session driver: `file`, `redis`, `database` |
| `QUEUE_CONNECTION` | `sync` | Queue driver: `sync`, `redis`, `database` |

**Redis example:**

```env
REDIS_HOST=redis
REDIS_PORT=6379
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

## Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_CHANNEL` | `stack` | Log channel: `stack`, `single`, `daily`, `stderr` |
| `LOG_LEVEL` | `warning` | Minimum log level: `debug`, `info`, `warning`, `error` |

For Docker deployments, set `LOG_CHANNEL=stderr` to send logs to Docker's log collector:

```env
LOG_CHANNEL=stderr
LOG_LEVEL=warning
```

## Docker-specific configuration

When running with Docker Compose, the following settings are relevant in `docker-compose.yml`:

```yaml
services:
  app:
    image: promptgate/promptgate:latest
    ports:
      - "8000:8000"
    environment:
      APP_ENV: production
      APP_URL: https://gateway.example.com
    volumes:
      - pg-data:/app/storage
```

**Port mapping:** The container exposes port `8000` by default. Map it to any host port you need.

**Persistent storage:** Mount a volume to `/app/storage` to persist database files (when using SQLite), logs, and cached data across container restarts.

**FrankenPHP settings:** The Docker image uses FrankenPHP as the application server. FrankenPHP-specific tuning (worker count, etc.) is configured through Caddyfile directives inside the container image. For most deployments, the defaults are sufficient.

## Production checklist

Before deploying to production, verify these settings:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# Use a proper database
DB_CONNECTION=pgsql

# Use Redis for caching and queues
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

# Send logs to Docker or a file
LOG_CHANNEL=stderr
LOG_LEVEL=warning
```

:::tip
Run `php artisan config:cache` (or let the Docker entrypoint handle it) to cache your configuration for better performance in production.
:::
