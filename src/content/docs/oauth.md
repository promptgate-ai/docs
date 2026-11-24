---
title: "OAuth connections"
description: "Many APIs and remote MCP servers want OAuth tokens instead of a static key. PromptGate holds them: you connect once, PromptGate keeps the tokens encrypted,…"
---

<!-- Generated from docs/oauth.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Many APIs and remote MCP servers want OAuth tokens instead of a static
key. PromptGate holds them: you connect once, PromptGate keeps the
tokens encrypted, refreshes them, and sends them upstream for the
[API Gateway](/api-gateway/) and the [MCP gateway](/mcp/). The agents
and apps calling through PromptGate only ever hold their `pg_` key.

```yaml
oauth:
  redirect_url: https://gw.example.com/ui/oauth/callback   # default: /oauth/callback on the web UI
  connections:
    github:
      preset: github
      client_id: ${GITHUB_CLIENT_ID}
      client_secret: ${GITHUB_CLIENT_SECRET}
      scopes: [repo, "read:user"]          # default: the preset's
    zendesk:
      preset: zendesk
      client_id: ${ZENDESK_CLIENT_ID}
      client_secret: ${ZENDESK_CLIENT_SECRET}
      config: { subdomain: acme }           # the preset's per-tenant fields
    billing:                                # no preset: everything explicit
      grant: client_credentials
      token_url: https://auth.example.com/oauth/token
      client_id: svc-promptgate
      client_secret: ${BILLING_SECRET}
      token_auth: basic
      params: { audience: https://billing.example.com }
```

| Field | Default | Meaning |
|---|---|---|
| `preset` | — | a [built-in provider](#presets); fills in the URLs and quirks |
| `grant` | `authorization_code` | `authorization_code`: a person consents once; `client_credentials`: machine to machine |
| `client_id` / `client_secret` | — | the OAuth app registered with the provider; the secret is required for `client_credentials` |
| `scopes` | the preset's | scopes requested, joined the way the provider expects |
| `config` | — | the preset's per-tenant fields, checked against their patterns |
| `authorize_url`, `token_url`, `refresh_url`, `revoke_url` | the preset's | override the preset, or set them without one; `https` only (`http` for `localhost`) |
| `token_auth` | the preset's, else `post` | client authentication at the token endpoint: `post` (form body) or `basic` |
| `pkce` | the preset's, else `true` | send an S256 code challenge |
| `params` | — | extra parameters of the authorization request (and of a `client_credentials` token request), e.g. `audience`; PromptGate's own (`state`, `redirect_uri`, …) can't be set |
| `resource` | — | the API the token is for (RFC 8707), sent with the authorization and every token request |
| `disabled` | `false` | keep the entry, use no token |

Names are lowercase letters, digits and `-` (max 32). Client secrets
belong in the environment (`${…}`), like every other secret in the
config.

## Connecting

Register an OAuth app with the provider and give it PromptGate's
redirect URL — `oauth.redirect_url`, by default the web UI's
`http://127.0.0.1:7879/oauth/callback` (with `ui.mount`:
`http://<server.listen><mount>/oauth/callback`). Then:

```sh
promptgate oauth connect github     # opens the consent page in the browser
```

After you allow access, the provider sends the browser back to the
redirect URL. A running web UI receives it there (sign in if asked;
the authorization can be finished by any signed-in user, since you
opened the link yourself); without one, the command listens on that
address itself. The tokens are stored, and `connect` reports how long
the access token is valid. `--no-browser` only prints the link,
`--timeout` (default 10m) limits the wait.

`client_credentials` connections need no consent: `connect` fetches a
token right away to check the credentials, and PromptGate fetches new
ones by itself.

Every authorization request carries a random `state` (stored only as
its hash, single-use, ten minutes) and, unless the preset or
`pkce: false` says otherwise, a PKCE S256 challenge. A callback for an
authorization another web UI user started is refused. The provider's
redirect is a cross-site navigation, which doesn't carry the web UI's
`SameSite=Strict` session cookie; the callback page therefore hands
over to `/oauth/complete` on the same site, where the session is
checked. Token endpoints are reached through the
[SSRF check](/api-gateway/#ssrf-protection) and never follow
redirects.

## Using a connection

```yaml
apis:
  github: { oauth: github }                  # url defaults to the preset's API: https://api.github.com
  zendesk: { oauth: zendesk }                # https://acme.zendesk.com/api/v2
mcp:
  servers:
    jira: { url: https://mcp.example.com/mcp, oauth: jira }
```

The connection's access token goes upstream as `Authorization` on every
call; whatever the caller sent as `Authorization` never does. When the
upstream answers 401, PromptGate renews the token once and sends the
request again (an API request's body is kept for that). A connection
without a token answers 502 `oauth_unavailable` with what to do —
`promptgate oauth connect <name>`. An `oauth` reference and a static
`Authorization` header exclude each other.

## MCP servers: `oauth: auto`

Remote MCP servers that follow the MCP authorization spec need no
OAuth app of your own:

```yaml
mcp:
  servers:
    linear: { url: https://mcp.linear.app/mcp, oauth: auto }
```

```sh
promptgate oauth connect mcp:linear
```

PromptGate asks the server without a token and follows its 401
(`WWW-Authenticate: Bearer resource_metadata="…"`, or the well-known
URI `/.well-known/oauth-protected-resource/<path>`) to the protected
resource metadata (RFC 9728), from there to the authorization server's
metadata (RFC 8414 or OpenID Connect discovery), and registers itself
as a client (RFC 7591) for the redirect URL — a public client with PKCE
unless the server hands out a secret. Servers of the 2025-03-26 spec
without metadata are tried at their origin (`/authorize`, `/token`,
`/register`). The scope comes from the 401's `scope` or the metadata's
`scopes_supported`; every authorization and token request names the
server as `resource` (RFC 8707), so the token is good for that server
only. An authorization server that doesn't announce PKCE S256 is
refused, as the spec requires.

The registered client is stored sealed with the tokens and reused; it
is registered again when the server's URL or the redirect URL changes,
or after `oauth disconnect mcp:<server>`. Servers without dynamic
registration need a named connection with your own OAuth app and
`resource: <server URL>`.

## Tokens over time

- **Renewal:** a token is renewed a minute before it expires, by the
  first request that needs it — concurrent requests wait for that one
  renewal instead of each refreshing (providers that rotate refresh
  tokens would void all but one). A token without an expiry is used
  until an upstream answers 401; then it is renewed once.
- **Reconnect:** when the provider refuses the refresh token
  (`invalid_grant`, a revoked app) or the token can't be decrypted (the
  secret key changed), the connection shows as *needs reconnect* with
  the reason, and requests that need it fail with a clear error until
  someone runs `connect` again.
- **Disconnect:** `promptgate oauth disconnect <name>` revokes the
  refresh and access token where the provider supports RFC 7009
  (`revoke_url`) and forgets them either way.

```sh
promptgate oauth list             # connected, expiry, needs reconnect (and why)
promptgate oauth refresh github   # renew now
promptgate oauth prune            # delete tokens of connections removed from the config
```

## Presets

`promptgate oauth presets` lists the 30 built-in providers,
`promptgate oauth presets <name>` shows one — URLs, default scopes,
PKCE, client authentication, the API's base URL and the tenant fields
it needs.

| | |
|---|---|
| Any account | `airtable`, `asana`, `bitbucket`, `calendly`, `discord`, `dropbox`, `figma`, `github`, `gitlab`, `google`, `hubspot`, `linear`, `linkedin`, `microsoft`, `notion`, `slack`, `stripe`, `zoom` |
| Per tenant (`config`) | `auth0` (`domain`), `freshdesk` (`subdomain`), `gitlab-self-hosted` (`domain`), `mailchimp` (`dc`), `microsoft-tenant` (`tenant_id`), `okta` (`domain`), `pipedrive` (`company_domain`), `salesforce` (`instance`), `servicenow` (`instance`), `shopify` (`shop`), `snowflake` (`account`), `zendesk` (`subdomain`) |

What the presets get right that PromptGate v1 got wrong:

- **PKCE** (S256) is on for every provider unless it rejects it
  (`stripe`, `mailchimp`); v1 stored the flag and never sent a
  challenge, so Airtable and GitLab failed.
- **Client authentication** follows the provider: `basic` for Notion,
  Zoom, Bitbucket, Airtable, Figma, Pipedrive and Snowflake.
- **Refresh tokens** at all: Google gets `access_type=offline` and
  `prompt=consent`, Dropbox `token_access_type=offline`; Figma refreshes
  at its own endpoint.
- **Tenant fields** are checked on load against their patterns, and
  every field is used — Mailchimp's data center and Pipedrive's company
  domain name the API host.

## Where tokens live

Tokens are stored in the request log's database (`logging.store`),
encrypted with AES-256-GCM. The key is `PROMPTGATE_SECRET_KEY` (32
bytes, base64 — `openssl rand -base64 32`) or, without it, `secret.key`
next to the config file, which PromptGate creates (mode 0600) on first
use. The database alone reveals nothing; keep the key out of database
backups. A lost or changed key doesn't break anything: the connections
show as disconnected and are connected again.

A pending authorization is stored only as the SHA-256 of its `state`,
expires after ten minutes and works once.
