---
title: Database Setup
description: SQLite is the default. Switch to MySQL or PostgreSQL when you need to scale beyond a single instance.
---

PromptGate uses Laravel Eloquent and works against any database Laravel supports. Out of the box you get **SQLite**, which is perfect for single-instance / local / small-team setups. When you outgrow that, swap to **MySQL 8+** or **PostgreSQL 14+**.

## Which database should I pick?

| Use case | Recommendation |
|---|---|
| Local dev, getting-started, single-user prod | **SQLite** (default) |
| Single-host prod with one app container | **SQLite** still fine, or MySQL/Postgres if you prefer |
| Multi-host or reverse-proxied across replicas | **PostgreSQL** or **MySQL** |
| You already run Postgres elsewhere | **PostgreSQL** |
| You already run MySQL | **MySQL 8+** |

SQLite is more capable than people think — at the gateway-log volumes most teams generate, it'll outperform a poorly-tuned MySQL on the same hardware. Don't switch just because "real" databases sound more serious.

## SQLite (default)

No setup required. The default `.env`:

```bash
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
```

The file is created automatically on `php artisan migrate`. With Docker Compose it lives in `backend/database/database.sqlite` on the host (mounted into the container at `/app/database/database.sqlite`).

**Pros**: zero ops, fast small queries, embedded, easy to back up (`cp` the file).
**Cons**: one writer at a time (writes serialise inside the file lock), no replication.

### Backing up SQLite

The simplest backup is to copy the file while the app is idle. For a hot backup:

```bash
docker compose exec app sqlite3 database/database.sqlite ".backup database/snapshot.sqlite"
```

Or use the **[Backup / Export](/admin/backup/)** admin page, which dumps every table as JSON regardless of the underlying engine — that's portable across engines too.

## Switching to MySQL

### 1. Run a MySQL instance

If you don't already have one, add it to your Compose file:

```yaml
services:
  app:
    # ... existing app config
    depends_on:
      - mysql
    environment:
      DB_CONNECTION: mysql
      DB_HOST: mysql
      DB_PORT: '3306'
      DB_DATABASE: promptgate
      DB_USERNAME: promptgate
      DB_PASSWORD: changeme

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: promptgate
      MYSQL_USER: promptgate
      MYSQL_PASSWORD: changeme
      MYSQL_ROOT_PASSWORD: changeme-root
    volumes:
      - mysql-data:/var/lib/mysql

volumes:
  mysql-data:
```

### 2. Update `.env`

```bash
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=promptgate
DB_USERNAME=promptgate
DB_PASSWORD=changeme
```

### 3. Migrate from scratch (fresh install)

```bash
docker compose down
docker compose up -d
docker compose exec app php artisan migrate --force
docker compose exec app php artisan db:seed --force
```

### 4. Migrate from SQLite (existing data)

If you already have data in SQLite that you want to keep:

```bash
# 1. Take a backup (admin → Backup / Export)
# 2. Stop the app
docker compose stop app

# 3. Update .env to point at MySQL
# 4. Boot fresh schema in MySQL
docker compose start app
docker compose exec app php artisan migrate --force

# 5. Restore from your JSON backup ZIP
# (Restore is a manual process today — use the JSON dumps with
#  artisan tinker to insert rows. A first-class restore command
#  is on the roadmap.)
```

:::caution[Encryption key matters]
The same `APP_KEY` must be configured for restore — encrypted columns (credentials, OAuth tokens) are ciphertext in the backup and decrypt only with the matching key.
:::

## Switching to PostgreSQL

### 1. Run a PostgreSQL instance

```yaml
services:
  app:
    depends_on:
      - postgres
    environment:
      DB_CONNECTION: pgsql
      DB_HOST: postgres
      DB_PORT: '5432'
      DB_DATABASE: promptgate
      DB_USERNAME: promptgate
      DB_PASSWORD: changeme

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: promptgate
      POSTGRES_USER: promptgate
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

### 2. Update `.env`

```bash
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=promptgate
DB_USERNAME=promptgate
DB_PASSWORD=changeme
```

### 3. Migrate

Same procedure as MySQL — `php artisan migrate --force` rebuilds the schema.

## Tuning for production

### Connection pool

Laravel uses one connection per request out of the box. For high-throughput gateways, switch to **PgBouncer** (Postgres) or **ProxySQL** (MySQL) with transaction-level pooling.

### Indexes

The migrations ship with all indexes the gateway needs at typical traffic. If you're doing heavy reporting on `gateway_logs`, consider adding:

```sql
-- Postgres / MySQL
CREATE INDEX gateway_logs_created_endpoint_idx
    ON gateway_logs (created_at DESC, endpoint_id);
```

This speeds up the per-endpoint metrics page when the table grows past a few million rows.

### Pruning old logs

`gateway_logs` accumulates one row per request. For a busy gateway, prune monthly:

```bash
docker compose exec app php artisan tinker
# inside tinker:
\App\Models\GatewayLog::query()->where('created_at', '<', now()->subDays(90))->delete();
```

A scheduled prune command is on the roadmap; until then, run this from cron.

### Backups

Whatever engine you use, **back up regularly**. The admin **[Backup / Export](/admin/backup/)** page produces a portable ZIP that's engine-agnostic and small (because it skips logs by default).

For native dumps:

```bash
# SQLite
cp backend/database/database.sqlite backups/promptgate-$(date +%F).sqlite

# MySQL
docker compose exec mysql mysqldump -u promptgate -p promptgate > backups/promptgate-$(date +%F).sql

# Postgres
docker compose exec postgres pg_dump -U promptgate promptgate > backups/promptgate-$(date +%F).sql
```

---

Next: **[Architecture](/concepts/architecture/)** — the mental model.

---

> © Akyros Labs LLC. All rights reserved.
