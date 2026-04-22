---
title: Installation
description: Install PromptGate with Docker
---

PromptGate ships as a Docker image powered by FrankenPHP. The recommended way to run it is with Docker Compose.

## Requirements

- Docker 24+ and Docker Compose v2
- 512 MB RAM minimum (1 GB recommended)
- 1 GB disk space

## Docker Compose (recommended)

**1. Clone the repository:**

```bash
git clone https://github.com/promptgate-dev/promptgate.git
cd promptgate
```

**2. Copy the environment file:**

```bash
cp .env.example .env
```

**3. Start the stack:**

```bash
docker compose up -d
```

This starts PromptGate with FrankenPHP, runs database migrations, and seeds the default admin account.

**4. Open the dashboard:**

Navigate to `http://localhost:8000` in your browser.

**5. Log in with the default admin credentials:**

```
Email:    admin@promptgate.dev
Password: admin
```

:::caution
Change the default admin password immediately after your first login. The default credentials are publicly documented and must not be used in production.
:::

## Docker Compose with dev overlay

For local development, use the dev overlay which mounts your source code and enables hot-reloading:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

The dev overlay:

- Mounts the application source into the container
- Enables Laravel debug mode
- Exposes additional debugging ports

## Local development (without Docker)

If you prefer to run PromptGate directly on your machine:

**Requirements:**

- PHP 8.3+
- Composer 2
- Node.js 20+ and npm
- SQLite (default) or PostgreSQL/MySQL

**1. Clone and install dependencies:**

```bash
git clone https://github.com/promptgate-dev/promptgate.git
cd promptgate
composer setup
```

The `composer setup` command copies `.env.example`, installs PHP and Node dependencies, generates an application key, runs migrations, seeds the database, and builds frontend assets.

**2. Start the development server:**

```bash
php artisan serve
```

The application is available at `http://localhost:8000`.

**3. (Optional) Run the Vite dev server for frontend hot-reloading:**

```bash
npm run dev
```

## Verifying the installation

After starting PromptGate, verify everything is working:

1. Open `http://localhost:8000` — you should see the login page
2. Log in with `admin@promptgate.dev` / `admin`
3. You should land on the dashboard

If something went wrong, check the logs:

```bash
# Docker
docker compose logs -f

# Local
tail -f storage/logs/laravel.log
```

## Updating

To update to the latest version:

```bash
git pull
docker compose down
docker compose up -d --build
```

Docker Compose automatically runs migrations on startup, so your database schema stays up to date.
