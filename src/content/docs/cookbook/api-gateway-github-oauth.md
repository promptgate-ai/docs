---
title: Recipe — Proxy GitHub with OAuth
description: Stand up an API Gateway endpoint that calls the GitHub API on behalf of a user, with auto-refresh OAuth tokens.
---

This recipe sets up an API Gateway endpoint that proxies to `api.github.com` using a GitHub OAuth client. PromptGate handles the authorization flow, stores the tokens encrypted, refreshes when they expire, and injects `Authorization: Bearer <github-token>` on every upstream request.

End state: a client calls `POST $PG_URL/api/$UUID/proxy/github/...` and the proxy forwards to GitHub with the right token — without the client ever seeing it.

## Prerequisites

- PromptGate installed and running.
- A GitHub OAuth app at <https://github.com/settings/developers> — note the client ID + client secret.
- The OAuth app's **redirect URI** registered as `<your-gateway>/oauth/callback`.

## Step 1 — Create an API Gateway project

Sidebar → **Projects** → **+ New project**:

- Name: `GitHub Proxy`
- Type: `API Gateway`
- Environment: `prod`

## Step 2 — Create the OAuth Service Connection

Project sidebar → **OAuth Connections** → **+ New connection**.

The form has Quick-Fill presets at the top. Click **GitHub** — the URLs and default scopes auto-fill:

| Field | Filled |
|---|---|
| Authorization URL | `https://github.com/login/oauth/authorize` |
| Token URL | `https://github.com/login/oauth/access_token` |
| Default scopes | `read:user repo` |

Now manually paste your own client_id + client_secret from your GitHub OAuth app:

- Name: `GitHub OAuth`
- Client ID: `<your client id>`
- Client Secret: `<your client secret>`

Save. The secret is encrypted with `APP_KEY` at rest.

## Step 3 — Run the OAuth flow

On the connection's detail page, click **Connect**.

You'll be redirected to GitHub:

```
GitHub: "PromptGate wants permission to: Read your profile, Read access to repositories"
[Authorize] [Cancel]
```

Click **Authorize**. GitHub redirects back to `<your-gateway>/oauth/callback?code=...&state=...`. PromptGate exchanges the code for tokens and stores them encrypted.

You're back on the connection page with a green "Connected" chip. Done.

## Step 4 — Create a proxy endpoint

Project sidebar → **Endpoints** → **+ New endpoint**:

| Field | Value |
|---|---|
| Name | `GitHub API` |
| Slug | `github` |
| Upstream URL | `https://api.github.com` |
| Allowed methods | `GET`, `POST`, `PATCH`, `DELETE` |
| Auth mode | `token` |
| **Upstream OAuth Connection** | `GitHub OAuth` ← **the one you just created** |
| Timeout | `30` |

Save.

When the proxy fires a request through this endpoint, it will:

1. Strip the client's `Authorization: Bearer pg_…` header.
2. Check if the OAuth connection's access token is still fresh (< 60s of expiry).
3. If expired, refresh via the refresh_token.
4. Inject `Authorization: Bearer <github-access-token>` on the upstream call.

## Step 5 — Issue a `proxy`-scoped token

Project sidebar → **API Tokens** → **+ New token**:

- Name: `GitHub Proxy client`
- Environment: `live`
- Scopes: `proxy`

Save. **Copy the plaintext** (`pg_live_…`).

## Step 6 — Call the proxy

```bash
PG_URL=https://gateway.your-domain.com
PG_UUID=<your project UUID>
PG_TOKEN=<the pg_live_... you just copied>

# List my repos
curl "$PG_URL/api/$PG_UUID/proxy/github/user/repos?per_page=5" \
  -H "Authorization: Bearer $PG_TOKEN"
```

Returns the GitHub API response verbatim:

```json
[
  { "id": 12345, "name": "my-repo", "private": false, "...": "..." }
]
```

### Python

```python
import os, requests

base = f"{os.environ['PG_URL']}/api/{os.environ['PG_UUID']}/proxy/github"
headers = {"Authorization": f"Bearer {os.environ['PG_TOKEN']}"}

r = requests.get(f"{base}/user/repos", headers=headers, params={"per_page": 5})
for repo in r.json():
    print(repo["name"])

# Create an issue
r = requests.post(
    f"{base}/repos/me/some-repo/issues",
    headers=headers,
    json={"title": "Bug found", "body": "It's broken."},
)
print(r.status_code, r.json()["html_url"])
```

### Node.js

```js
const base = `${process.env.PG_URL}/api/${process.env.PG_UUID}/proxy/github`;
const auth = { 'Authorization': `Bearer ${process.env.PG_TOKEN}` };

// List repos
const repos = await (await fetch(`${base}/user/repos?per_page=5`, { headers: auth })).json();
console.log(repos.map(r => r.name));

// Create an issue
const issue = await (await fetch(`${base}/repos/me/some-repo/issues`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Bug found', body: "It's broken." }),
})).json();
console.log(issue.html_url);
```

## What's happening

1. Client → PromptGate: `Authorization: Bearer pg_live_…`. Verified, scope `proxy`, project matches.
2. PromptGate runs SSRF check on `https://api.github.com` (it's public, allowed).
3. PromptGate strips the client's Authorization header.
4. PromptGate checks `oauth_connection.expires_at`. If past, calls GitHub's token URL with the refresh_token, gets a new access_token.
5. PromptGate sends the request to GitHub with `Authorization: Bearer <github-access-token>`.
6. Returns GitHub's response to the client.

## Observability

- **Live Logs**: every proxy hit logged with `provider_key=http`, the method, the upstream status.
- **Audit Log**: the OAuth connect / refresh / disconnect events. If a refresh fails, you'll see `oauth_connection.refresh_failed` and the client gets 502.

## Failure modes

| Situation | Result |
|---|---|
| Connection not connected | 502 + `Upstream OAuth connection failed` |
| GitHub revoked the OAuth grant | refresh fails → 502, audit `refresh_failed` |
| GitHub rate limited | upstream's 429 passed through |
| Wrong scope on the PromptGate token | 403 |
| Method not in `allowed_methods` | 405 |

## Bonus — protect the upstream

Add a per-minute rate limit to the endpoint (`rate_limit_per_minute: 60`). Now even if the GitHub token has a higher limit, your client gets throttled at the gateway. Useful when multiple internal apps share the connection.

## Pattern: same approach for Google / Slack / Notion

The same recipe works for any OAuth-protected upstream — just pick the matching Quick-Fill preset, paste your client_id/secret, run the flow, bind the endpoint. See **[OAuth Service Connections](/security/oauth-connections/)** for the full provider list.

---

Next: **[Expose Endpoint as MCP Tool](/cookbook/expose-mcp-tool/)**.

---

> © Akyros Labs LLC. All rights reserved.
