---
title: OAuth Service Connections
description: OAuth 2.0 authorization-code flow for API Gateway upstream auth — encrypted tokens, auto-refresh, Quick-Fill presets.
---

When your API Gateway proxies to an upstream API that requires OAuth 2.0 (Google, GitHub, Slack, …), an **OAuth Service Connection** holds the client credentials and the resulting access + refresh tokens. PromptGate runs the auth flow once, stores the tokens encrypted, and **auto-refreshes** them when they expire.

The endpoint binds to a connection via `oauth_connection_id`, and the proxy injects `Authorization: Bearer <access_token>` upstream — automatically.

## Lifecycle

```
1. You register an OAuth app with the provider (e.g. console.cloud.google.com)
   → get a client_id + client_secret.

2. In PromptGate, create a connection with those values + the provider's
   auth_url + token_url + scopes.

3. Click 'Connect' — PromptGate redirects you to the provider's consent page,
   you approve, the provider redirects back to /oauth/callback with a code.

4. PromptGate exchanges the code for access + refresh tokens. Tokens are
   encrypted with APP_KEY and stored.

5. Bind an API Gateway endpoint to this connection.

6. When the proxy forwards a request, it:
   - Checks if the access token is expired (or within 60s of expiring).
   - If yes, refreshes via the refresh_token.
   - Injects 'Authorization: Bearer <token>' on the upstream request.
```

## Quick-Fill presets

The connection create form has six built-in presets:

- Google
- GitHub
- Slack
- Microsoft (Entra)
- Notion
- Discord

Click a preset → the auth URL, token URL, and default scopes are filled in. You still paste your own `client_id` + `client_secret`.

![OAuth presets — placeholder](#)

Each preset links to the provider's "register an OAuth app" page, so first-time setup is one click away.

## Generic OAuth

For providers without a preset, fill in the fields manually:

| Field | Notes |
|---|---|
| **Name** | Human-readable identifier. |
| **Authorization URL** | Where users go to grant access. e.g. `https://accounts.google.com/o/oauth2/v2/auth`. |
| **Token URL** | Where the gateway exchanges code for tokens, and refreshes. e.g. `https://oauth2.googleapis.com/token`. |
| **Client ID** | From the provider's OAuth app registration. |
| **Client Secret** | Encrypted at rest with `APP_KEY`. |
| **Scopes** | Space-separated. Sent as the `scope` parameter to the auth URL. |
| **Audience** | Optional. Some providers (Auth0) require it. |

Token requests go out with `Accept: application/json` so providers like GitHub (which default to form-encoded) return JSON.

## The redirect URI

Register this URL with your provider as an allowed redirect URI:

```
{APP_URL}/oauth/callback
```

So if `APP_URL=https://gateway.your-domain.com`, the redirect URI is `https://gateway.your-domain.com/oauth/callback`.

This is a single global endpoint — every connection uses the same URI. The state token tells PromptGate which connection initiated the flow on callback.

## Storage and encryption

The `oauth_service_connections` table stores:

| Column | Encrypted? |
|---|---|
| `client_id` | No (it's not a secret per OAuth spec) |
| `client_secret` | **Yes** (AES-256-GCM via `encrypted` cast) |
| `access_token` | **Yes** |
| `refresh_token` | **Yes** |
| `token_type` | No (e.g. "Bearer") |
| `expires_at` | No |
| `connected_at` | No |
| `scopes`, `audience`, `authorization_url`, `token_url` | No |

Losing your `APP_KEY` makes the encrypted columns unrecoverable — same warning as for credentials.

## Auto-refresh

When the proxy is about to forward a request:

1. Look up `endpoint.oauth_connection_id`.
2. If `connection.expires_at` is past (or within 60s):
   - POST to `connection.token_url` with `grant_type=refresh_token`, the stored `refresh_token`, the `client_id`, and the `client_secret`.
   - Store the new `access_token` (and possibly `refresh_token` if the provider rotated it).
   - Update `expires_at`.
3. Inject `Authorization: <token_type> <access_token>` on the upstream request.

If refresh fails (refresh_token revoked, network error, provider down), the request fails with **502** and a clear error. The user has to re-connect.

## CSRF protection on the flow

The OAuth `state` parameter is a **single-use** random token cached for 10 minutes:

1. `Connect` button → generate a state, cache `state → connection_uuid`, redirect.
2. Provider redirects back with the same state.
3. PromptGate `Cache::pull(state)` — atomically reads + deletes.
4. If the state is unknown or already consumed → 400. Replay attempt is blocked.

This prevents an attacker from tricking the user's browser into completing an OAuth flow against an attacker-chosen connection.

## Disconnect

Click **Disconnect** on a connection's detail page. Effect:

- `access_token`, `refresh_token`, `expires_at`, `connected_at` are cleared.
- Endpoints bound to this connection get **502** on the next request (no token to inject).
- Audit entry: `oauth_connection.disconnected`.

Reversible — click **Connect** again to redo the flow.

## Delete

Removes the connection row entirely. Endpoints with `oauth_connection_id` pointing to it have it nulled out (foreign key `nullOnDelete`). Those endpoints lose their upstream auth and start failing.

The form prompts for confirmation.

## Endpoint binding

In the API Gateway endpoint form, **Upstream OAuth Connection** is a dropdown listing the project's active connections. Pick one — the proxy injects the bearer.

If the connection is **not connected** (no access_token), the dropdown shows `(not connected)` next to the name. The endpoint will still save, but proxy requests get 502 until you complete the auth flow.

## Errors

| Situation | Response |
|---|---|
| Endpoint references a non-existent / inactive connection | 502 (proxy time) |
| Connection has no access_token | 502 |
| Refresh fails (network / revoked) | 502 + audit entry `oauth_connection.refresh_failed` |
| State unknown on callback | 400 |
| Provider returns `error=access_denied` | Redirect to connection page with error toast |

## Best practices

- **One connection per upstream service** per project. Don't share connections across projects (each project's clients should grant access independently).
- **Rotate `client_secret`** if you suspect leakage. The form lets you leave the secret blank on edit to keep the existing value, or paste a new one to replace.
- **Audit the `oauth_connection.*` events** — you can spot revoked refresh tokens (`refresh_failed`) before users complain.
- **Don't fork connections** — if the same upstream needs multiple scopes for different endpoints, register multiple connections. Cleaner audit and easier disconnect.

---

Next: **[Audit Log](/security/audit-log/)**.

---

> © Akyros Labs LLC. All rights reserved.
