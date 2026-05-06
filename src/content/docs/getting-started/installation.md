---
title: Installation
description: Install PromptGate via Docker Compose, or run it directly with PHP for development.
---

PromptGate is distributed as **source you clone and run via Docker Compose**. A pre-built Docker image on a public registry is on the roadmap; until then, the canonical installation method is `git clone` + `docker compose up`.

## Requirements

| Component | Minimum | Recommended | Notes |
|---|---|---|---|
| Docker | 24.0+ | 26.0+ | Compose v2 required |
| RAM | 512 MB | 1 GB | More if you enable contextual PII / heavy traffic |
| Disk | 1 GB | 5 GB | Logs + audit trail can grow |
| OS | Linux / macOS / WSL2 | Linux | Production should be Linux |

For a no-Docker dev install you also need **PHP 8.3+**, **Composer 2**, and **Node.js 20+**.

## Quick install (Docker Compose)

This is the fastest path from zero to a running gateway.

### 1. Clone the repository

```bash
git clone https://github.com/promptgate-org/promptgate.git
cd promptgate
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

The defaults are safe for local development. The only value you may want to change before first start is `APP_URL` — set it to whatever URL your browser will use (e.g. `http://localhost:8000` for local, `https://gateway.your-domain.com` behind a reverse proxy).

See **[Configuration](/getting-started/configuration/)** for the full env variable reference.

### 3. Start the stack

```bash
docker compose up -d
```

What this does on first run:

1. Builds the FrankenPHP image (~2 minutes)
2. Starts the application container
3. Runs `php artisan migrate --force` (creates all tables)
4. Runs the admin seeder (`admin@promptgate.dev` / `admin`)
5. Builds frontend assets (Vite)

Subsequent starts skip the build and asset compile, so they take seconds.

### 4. Open the dashboard

Navigate to **`http://localhost:8000`**.

### 5. Log in

```
Email:    admin@promptgate.dev
Password: admin
```

:::caution[Change the password immediately]
The default admin credentials are publicly documented in this guide. The very first thing to do after first login is **change the password** under your user menu (top-right) → Profile.
:::

## Verifying the installation

Once you're logged in, walk this checklist:

- [ ] You land on the **Dashboard** with hero strip + KPIs
- [ ] **Projects** in the sidebar lists "No projects yet" or shows seeded examples
- [ ] **Admin** menu (user dropdown top-right) shows Credentials, Providers, Templates, Audit Log, Backup
- [ ] `docker compose logs -f` shows no errors

If the dashboard 500's, the most common causes are missing `APP_KEY` (re-run `cp .env.example .env`) or stale Docker volumes (`docker compose down -v && docker compose up -d`).

## Development overlay

`docker-compose.override.yml` is auto-loaded by Compose and mounts the local source into the container so file edits take effect immediately:

```bash
docker compose up -d
```

The override:

- Bind-mounts `./backend` → `/app` (live PHP edits)
- Enables Laravel debug mode (`APP_DEBUG=true`)
- Disables OPcache so Blade / route changes reload without restart

For frontend (Blade is server-rendered; Vite is only needed for CSS/JS asset compilation):

```bash
docker compose exec app npm run dev
```

## No-Docker development install

If you'd rather run PHP locally:

### Requirements

- PHP 8.3+ with `bcmath`, `intl`, `mbstring`, `pdo_sqlite`, `zip` extensions
- Composer 2
- Node.js 20+ and npm
- SQLite (default) or MySQL 8 / PostgreSQL 14+

### Install

```bash
git clone https://github.com/promptgate-org/promptgate.git
cd promptgate/backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
npm install && npm run build
php artisan serve
```

Open `http://localhost:8000`.

For frontend hot-reload during dev: `npm run dev` in a second terminal.

## Production deployment

A production install has the same Docker Compose stack, but with a few hardenings:

### 1. Generate a real `APP_KEY`

```bash
docker compose exec app php artisan key:generate
```

Never reuse the example key on a production gateway — it's published in the example file and would let anyone decrypt your stored credentials.

### 2. Set `APP_URL` to your real URL

```env
APP_URL=https://gateway.yourcompany.com
APP_DEBUG=false
APP_ENV=production
```

`APP_URL` is what shows up in the OAuth callback, MCP bridge URL, and curl examples. Get it right.

### 3. Reverse proxy with TLS

PromptGate runs behind any reverse proxy that terminates TLS. Examples:

#### Caddy (simplest)

```caddyfile
gateway.yourcompany.com {
    reverse_proxy localhost:8000
}
```

#### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name gateway.yourcompany.com;
    ssl_certificate /etc/letsencrypt/live/gateway.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gateway.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
    }
}
```

The `proxy_read_timeout 300s` matters for streaming responses (SSE).

### 4. Use a real database

SQLite works for single-instance deployments, but for anything serious switch to MySQL or PostgreSQL. See **[Database Setup](/getting-started/database/)**.

### 5. Open the firewall to outgoing only

PromptGate calls upstream providers and may call upstream OAuth/REST APIs. Inbound only needs port 443 (via your reverse proxy). Outbound needs HTTPS to provider APIs (`api.openai.com`, `api.anthropic.com`, etc.).

### 6. Backup

Schedule a daily run of the admin **Backup / Export** page (or hit `POST /admin/backup` with a session cookie) to grab a portable ZIP. See **[Backup / Export](/admin/backup/)**.

## Updating

```bash
cd promptgate
git pull
docker compose down
docker compose up -d --build
```

The container runs migrations automatically on start, so the schema stays in sync. Your data persists in the `backend/storage` volume (and your DB if external).

:::tip[Before pulling]
Run a backup first if your gateway is in production: **Admin → Backup / Export → Download backup ZIP**.
:::

## Uninstall

```bash
cd promptgate
docker compose down -v   # -v also removes volumes (deletes data)
cd ..
rm -rf promptgate
```

The `-v` flag deletes the Docker volumes — your SQLite database, queue state, and uploaded files. Skip it if you want to keep the data.

---

Next: **[Quick Start](/getting-started/quick-start/)** — wire up your first AI endpoint and call it with `curl`.

---

> © Akyros Labs LLC. All rights reserved.
