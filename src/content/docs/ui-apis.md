---
title: "Web UI: APIs and connections"
description: "The pages of the API Gateway and its OAuth connections in the web UI, under API Gateway in the sidebar. The other pages: web UI pages."
---

<!-- Generated from docs/ui-apis.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

The pages of the [API Gateway](/api-gateway/) and its
[OAuth connections](/oauth/) in the [web UI](/ui/), under
*API Gateway* in the sidebar. The other pages: [web UI pages](/ui-pages/).

## APIs

**APIs** lists every API under `apis`: its name and base URL, how it
authenticates upstream — an OAuth connection, or the names of the
headers it sets (never their values) — today's calls, errors and median
latency, and whether it is disabled or `private` (exempt from the SSRF
check). Below: how a client calls an API, and how many OAuth
connections hold tokens.

- **Add API** / **Edit** — the entry under `apis` as YAML, starting from
  a template; checked with the whole config, previewed as a diff, saved
  through the checked path. The gateway applies it to the next call.
  `private: true` lets an API reach the internal network: set it only
  for internal services.
- On an API's page: the route clients call, its credentials and — with
  an OAuth connection — whether that is connected, with a **Connect**
  button when it isn't; the last 20 calls (method, path, key, status,
  duration, error; each links to its log entry); the definition with
  `${ENV}` references, literal header values hidden; **Disable**,
  **Enable**, **Delete**, and a link to its logs.

## Connections

**Connections** lists the OAuth connections: those under
`oauth.connections`, the ones MCP servers with `oauth: auto` discovered
(`mcp:<server>`), and tokens whose connection left the config. For each:
the provider, the state — *connected*, *not connected*, *needs
reconnect* with the reason, *client credentials*, *disabled* — when the
access token expires, and which APIs and MCP servers send its token.
Tokens are never shown.

- **Connect** sends the browser to the provider's consent page; the
  provider sends it back to the redirect URL shown below the table
  (`oauth.redirect_url`), and the connection is stored for the user who
  started it. Client credentials connections fetch a token at once.
- **Renew** gets a new access token now; **Disconnect** revokes the
  tokens where the provider supports it and forgets them. Both are
  recorded in the audit trail.
- **Add connection** starts from one of the 30 providers — the chosen
  preset fills in a template with its tenant fields and `${ENV}`
  references for the client id and secret — or from your own endpoints.
  The entry is checked, previewed and saved like every config change;
  **Delete connection** removes it (stored tokens stay until
  `promptgate oauth prune`).

The pages need the request log (`logging.store`), where tokens live.

## Elsewhere

- **Keys**: a key may be limited to some APIs, like providers,
  endpoints and MCP servers.
- **MCP servers**: a server with `oauth` shows its connection's state
  and a **Connect** button.
- **Logs**: *API Gateway calls* as traffic, with the API as provider
  and the method as model.
- **Guardrails**, **Rate limits**: the scope *API* / *API Gateway APIs*.
