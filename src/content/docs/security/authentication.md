---
title: Authentication
description: Login and session management
---

PromptGate uses a custom authentication system designed for administrative access. There is no self-registration — all user accounts are created by administrators.

## Web authentication

### Login

The web dashboard uses session-based authentication. Navigate to your PromptGate instance and log in with your email and password.

```
https://gateway.example.com/login
```

### Default admin account

On first installation, PromptGate seeds a default admin account:

| Field | Value |
|---|---|
| Email | `admin@promptgate.dev` |
| Password | `admin` |

:::caution
Change the default admin password immediately after installation. This account has full access to all projects and settings.
:::

### No self-registration

PromptGate does not include a registration page. This is intentional — it is an internal tool, not a consumer-facing application. User accounts are created through:

- The admin seeder (default account on fresh install)
- Admin user management *(coming soon)*
- Artisan commands for creating users

### Rate limiting

The login endpoint is protected against brute-force attacks:

- **5 login attempts** per email address per minute
- After exceeding the limit, the account is temporarily locked
- The lockout duration increases with repeated failures

Failed login attempts are logged for security auditing.

## Session management

After a successful login, PromptGate creates a server-side session:

- Sessions are stored according to the `SESSION_DRIVER` configuration (file, Redis, or database)
- Session lifetime is controlled by Laravel's `SESSION_LIFETIME` setting (default: 120 minutes)
- Sessions are invalidated on logout

:::tip
For production deployments, use Redis as the session driver for better performance and automatic expiration:
```env
SESSION_DRIVER=redis
```
:::

## API authentication

API endpoints use Bearer token authentication with client tokens. See [Client Tokens](/security/client-tokens/) for details on token management.

```bash
curl -H "Authorization: Bearer pg_live_..." \
     https://gateway.example.com/api/v1/endpoints/my-endpoint
```

:::note
API authentication via client tokens is under active development. The current release supports web session authentication only.
:::

## Security recommendations

- **Change the default password** immediately after installation
- **Use HTTPS** in production — configure a reverse proxy (nginx, Caddy) with TLS or let FrankenPHP handle automatic HTTPS
- **Set strong session configuration** — use Redis for session storage and keep session lifetimes short for sensitive environments
- **Monitor failed logins** — check the audit log regularly for unusual login patterns *(coming soon)*
