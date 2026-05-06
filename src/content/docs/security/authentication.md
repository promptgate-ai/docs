---
title: Authentication
description: Web login (single admin) and API authentication (Bearer tokens with scopes).
---

PromptGate has two distinct auth surfaces that don't intersect:

- **Web UI** — session-based login. One admin account in Community Edition.
- **Public API** — Bearer tokens (`pg_live_…` or `pg_test_…`) with scopes. Per-project.

## Web UI login

Navigate to `/login` and submit email + password.

![Login screen — placeholder](#)

### Default credentials (fresh install)

```
Email:    admin@promptgate.dev
Password: admin
```

The seeder creates this account on first migrate. **Change the password immediately** via top-right user menu → **Profile**.

### Rate limiting

The login endpoint is rate-limited to prevent brute-force:

- **5 attempts** per email per minute.
- Subsequent attempts return 429 + `Retry-After`.
- Successful login resets the counter.

Failed attempts are logged in `audit_logs` (event: `auth.login_failed`).

### Sessions

After successful login:

- Laravel creates a server-side session.
- Storage driver is `SESSION_DRIVER` (default: `database`; recommend `redis` in prod).
- Idle lifetime: `SESSION_LIFETIME` (default 120 min).
- Cookie is `HttpOnly` and `SameSite=Lax`. `Secure` is added when serving over HTTPS.
- CSRF is enforced on every state-changing form by Laravel's middleware.

### Logout

Top-right user menu → **Logout**. Invalidates the session server-side.

### Forgot password

In Community Edition, there's no password-reset email flow (single user, you typically have console access). To reset:

```bash
docker compose exec app php artisan tinker
\App\Models\User::query()->where('email', 'admin@promptgate.dev')
    ->update(['password' => Hash::make('your-new-password')]);
```

### Single-user vs multi-user

Community Edition is **single-user** — one admin account, full access to everything. The login system technically supports multiple users (the `users` table is normal), but no UI for invitations, no roles, no permissions. **Multi-user / RBAC / SSO** are Cloud Edition features (see **[Editions](/concepts/editions/)**).

## API authentication

Public API routes (`/api/{uuid}/...`, `/api/control/mcp`) use **Bearer tokens**.

```http
Authorization: Bearer pg_live_abcdef01234567...
```

Tokens are project-scoped and carry scopes that gate which routes they can hit:

| Scope | Routes |
|---|---|
| `chat` | `POST /api/{uuid}/{slug}` (AI Gateway), `POST /api/{uuid}/v1/chat/completions` (Wrapper) |
| `models` | `GET /api/{uuid}/models` |
| `admin` | `GET /api/{uuid}/info`, `/endpoints`, `/tokens`, `POST /api/control/mcp` |
| `proxy` | `ANY /api/{uuid}/proxy/{slug}/{any?}` (API Gateway) |
| `mcp` | `POST /api/{uuid}/mcp` (Bridge or Gateway) |

A token can have **multiple scopes**. A single token can be e.g. `[chat, models]` for an app that needs both.

Issuing, rotating, and revoking tokens is documented in **[Client Tokens](/security/client-tokens/)**.

## Storage and hashing

| Surface | Storage | What's stored |
|---|---|---|
| Web login | Laravel's bcrypt | `users.password` is bcrypt with `BCRYPT_ROUNDS` cost (12 in prod). |
| API tokens | SHA-256 | `api_tokens.token_hash` is the SHA-256 of the plaintext. Plaintext shown once at create / rotate, never again. |

Web sessions store an opaque session ID server-side. The cookie just carries the session ID; the session payload (user ID, CSRF token, etc.) lives in the session store.

## HTTPS

Behind a reverse proxy that terminates TLS, the Laravel `trustProxies` middleware (set to `'*'` in `bootstrap/app.php`) honours `X-Forwarded-Proto`. PromptGate generates `https://…` URLs in OAuth callbacks, MCP bridge URLs, and curl examples whenever `APP_URL` is `https://…`.

If you don't configure HTTPS, **don't ship a production gateway**. Bearer tokens transit in headers; without TLS, network observers see them.

## Security recommendations

- **Change the default password** before exposing the gateway anywhere.
- **HTTPS only** in production.
- **Redis sessions** in prod for performance and session-store consistency across replicas.
- **Short `SESSION_LIFETIME`** if the UI is exposed beyond your VPN (e.g. 30 min).
- **Audit the audit log** weekly — the `auth.login_failed` events are an early signal for brute-force attempts that slipped through rate limits.
- **Token rotation** — rotate API tokens on a cadence (every 90 days is a fine starting point).

---

Next: **[Client Tokens](/security/client-tokens/)**.

---

> © Akyros Labs LLC. All rights reserved.
