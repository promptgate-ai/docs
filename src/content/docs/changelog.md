---
title: "Changelog"
description: "All notable changes to PromptGate are documented in this file."
---

<!-- Generated from CHANGELOG.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

All notable changes to PromptGate are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Operational events ([events](/events/)), the base of v0.9's
  webhooks: one catalogue (`promptgate events`) with a stable payload
  (`type`, `id`, `timestamp`, `data`).
  - Runtime events: `budget.warning` at 80 % and `budget.exceeded`,
    once per scope, limit and period; `limit.exceeded` and
    `guardrail.blocked`, the first per bucket (or key and guard) and
    minute, later ones counted in `repeated`.
  - Health events: `anomaly.detected`/`resolved`;
    `provider.failing`/`recovered` (5 failures in a row, fallbacks
    included; 429 and local refusals don't count);
    `mcp.server_down`/`up` (unreachable, failed start, crash);
    `oauth.needs_reconnect`; `log.dropped`.
  - Publishing never blocks: bounded queues per listener, drops
    counted. Error texts lose URL query strings, and end-user ids never
    appear in `limit.exceeded`.
  - Metrics `promptgate_events_total{type}` and
    `promptgate_events_dropped_total{subscriber}`.
- Hash-chained audit trail ([audit trail](/audit/)): every entry
  signed with HMAC-SHA256 over its fields and the previous entry's MAC,
  keyed from the secret key (`PROMPTGATE_SECRET_KEY` / `secret.key`), in
  the request log database (schema v16, table `audit`). An edited,
  deleted, inserted or reordered entry breaks the chain. One writer for
  the web UI (`ui:<user>`), the command line (`cli`), the MCP control
  plane (`mcp:<key>`) and the gateway, and every entry is published as an
  event under its action.
  - Actions follow the event catalogue (`key.created`,
    `config.changed`, `auth.login_failed`, …).
  - The web UI's v0.8 entries move over as *legacy* and are signed by
    the first write after the upgrade.
  - `audit.retention` (minimum `1d`) deletes old entries daily and
    leaves a signed `audit.pruned` marker, so the chain still verifies.
  - The UI's audit page filters by actor and shows each entry's number.
- `promptgate audit list | verify | export` ([audit trail](/audit/#command-line)):
  - `verify` walks the chain, prints the head and exits 1 at the first
    bad entry.
  - `export` writes every field, the chain's included, as JSON lines or
    CSV. CSV cells are guarded against spreadsheet formulas, and an
    existing file is never overwritten.
  - Filters: `--since` and `--until` (duration, date or RFC 3339),
    `--actor`, `--action key.*`.
- The web UI's audit page shows the chain's state (intact with its head,
  broken at an entry, or not signed yet) and exports the filtered
  entries as CSV or JSONL.
- Exports are recorded as `audit.exported`.
- Webhooks ([webhooks](/webhooks/)): `webhooks.<name>` sends the
  events it subscribes to (`budget.*`, `*`, …) to a URL, signed per
  Standard Webhooks (`webhook-id`, `webhook-timestamp`,
  `webhook-signature`; `whsec_` secrets or 24+ bytes).
  - Durable queue in the request log (schema v17), delivered in order
    per webhook, retried after 30 s up to 24 h, 10 attempts (about two
    days); `410` gives up, redirects aren't followed, the same
    `webhook-id` on every retry.
  - SSRF-checked like the API Gateway (`private: true` for receivers on
    a private network); at most 10,000 waiting deliveries per webhook;
    finished ones kept 30 days with status and the first 2 KB of the
    answer.

- **First start sets everything up** ([first start](/install/#first-start)):
  `promptgate start` without a config asks six questions — provider,
  API key, protection, a `pg_` key with a daily budget, coding agents,
  background service — then runs. `setup` asks the same; `setup --yes`
  takes `--protection`, `--budget`, `--connect`, `--service`.
- Ready-made protection ([guardrails](/guardrails/#ready-made-protection)):
  `recommended` (secrets masked, personal data redacted, prompt
  injection blocked, token saver), `strict`, `log`, `off`. Without any
  config file, `recommended` applies.
- `promptgate connect claude-code|codex` sends the agent through
  PromptGate by setting the base URL in its own config (backed up
  first); `disconnect` undoes it, and `uninstall` offers to.
- `start` names the active guardrails.

### Changed

- The config `setup` writes has guardrails on (`recommended`) and,
  with a `pg_` key, a daily budget of $20 per key. Before, every
  guardrail was commented out: a fresh install only logged. Configs
  already written keep what they have. Started without any config file
  (a container without one), PromptGate now applies `recommended`;
  before, it applied no guardrails.
- `setup` no longer asks for the listen address (`--listen` sets it).
- The command line now records its changes in the audit trail:
  `keys create/revoke/enable/delete`, `oauth connect/refresh/disconnect/prune`,
  `mcp import --write` and the key `mcp setup` creates. Before, only
  `ui users` and `ui passwd` were recorded.
- Control-plane changes are recorded under the tool's action
  (`key.created`), with the agent as `mcp:<key>`. Before, the action
  carried an `mcp_` prefix.
- Audit entries become events in the running gateway, which reads new
  entries every second, so changes made by `promptgate` commands in
  another process reach webhooks too. Before, only the process that
  wrote an entry published it.

### Fixed

- A web UI save could reload the config twice. When the file watcher
  noticed the write before the UI's reload request arrived, both
  reloaded. A reload now happens only when the files changed since the
  last successful one. SIGHUP still always reloads.
  The watcher test now writes files the way the UI does (temp file and
  rename). Before, the watcher could read a half-written file under
  load and reload once more.
- Publishing a release could leave `latest/checksums.txt` missing on
  install.promptgate.dev, so `install.sh` failed for the latest
  version: the upload synced `latest/` with `--delete`, which against R2
  removed the file it had just uploaded. `latest/` is now copied.
- The request log could drop rows with `database is locked
  (SQLITE_BUSY)` while another process wrote to the same database (the
  command line, the web UI, the webhook queue). SQLite's settings
  (`busy_timeout` among them) were applied to one pooled connection
  only, and a transaction that read before it wrote failed at once when
  another writer came in between. Every connection now gets the
  settings, and transactions take the write lock when they begin.

## [0.8.1] - 2026-11-20

### Fixed

- **Claude Code with a Claude subscription.** Claude Code signed in with
  Pro or Max sends an OAuth access token (`sk-ant-oat…`), which
  Anthropic accepts only as `Authorization: Bearer`. Passthrough sent
  every Anthropic key as `x-api-key`, so each request came back 401 and
  Claude Code retried until it gave up. Subscription tokens now go out
  as bearer tokens; API keys are unchanged. Live-tested with Claude
  Code 2.1 on a subscription.

## [0.8.0] - 2026-10-23

The API Gateway release: agents and apps call more than models and MCP
servers — GitHub, Jira, Salesforce, an internal service — and until now
every one of them carried long-lived tokens and bypassed the log.
PromptGate now serves those APIs on `/api/<name>/…` behind the same
`pg_` keys: the API's credential — a static header or an OAuth token —
lives only in PromptGate, every call is logged and rate-limited, the
guardrails read request bodies and answers, and an SSRF check at dial
time keeps configured URLs from becoming a door into the network
PromptGate runs in. OAuth connections hold the tokens — 30 providers
with v1's mistakes fixed (PKCE sent, the right client authentication,
refresh tokens at all), sealed with AES-256-GCM, renewed before they
expire — for APIs and for remote MCP servers, which with `oauth: auto`
find their authorization server and register PromptGate by themselves.
Own implementation, no OAuth module.

### Added

- API Gateway (`internal/apigw`) on `surfaces.api_gateway.mount`:
  `/api/<name>/<path>` goes to the API's `url` joined with `<path>`,
  `pg_` keys only (`keys[].apis`), the caller's credentials,
  `X-Forwarded-*` and `X-PromptGate-*` headers never reach the API;
  traversal in any encoding refused (encoded slashes kept), method
  allowlist, streaming in both directions with flushing for event
  streams, request/response caps, redirects passed back unfollowed,
  retries for idempotent methods, `X-PromptGate-Request-Id`, one error
  shape; APIs reload live.
- OAuth connections, part 1 — [OAuth](/oauth/): `oauth.connections`
  (`preset`, `grant` authorization_code/client_credentials, client
  credentials, `scopes`, tenant `config`, URL overrides, `token_auth`,
  `pkce`, `params`) and `oauth.redirect_url`, validated on load; 30
  built-in presets (`promptgate oauth presets`) with v1's mistakes
  fixed: PKCE S256 sent, Basic client authentication where the
  provider wants it, Google/Dropbox offline access, Figma's refresh
  endpoint, every tenant field used and checked; tokens stored in the
  request log database (schema v15) sealed with AES-256-GCM
  (`PROMPTGATE_SECRET_KEY` or a generated `secret.key`), pending
  authorizations only as the hash of their state.
- OAuth connections, part 2: the authorization code flow with PKCE
  (`promptgate oauth connect`, the web UI's `/oauth/callback` or a
  loopback listener of the command), state bound to the web UI user
  and single-use; client credentials; renewal a minute before expiry,
  one renewal for concurrent requests, renewal after a 401;
  *needs reconnect* with the reason when the provider refuses the
  refresh token or the secret key changed; RFC 7009 revocation on
  `oauth disconnect`; `oauth list`, `refresh`, `prune`; token
  endpoints reached through the SSRF check, never following redirects.
- OAuth connections in use: `apis.<name>.oauth` and
  `mcp.servers.<name>.oauth` send the connection's token as
  `Authorization` (never the caller's), renew it once and resend after
  a 401 (API request bodies are kept for that); an API's `url` defaults
  to its preset's API; without a token the API Gateway answers 502
  `oauth_unavailable` with the command to run. `promptgate mcp
  servers|tools|call` use the stored tokens too.
- Quality gate: pgfuzz's new `api` probe runs in `scripts/pgfuzz-gate.sh`
  (stages api-access, api-headers, api-paths, api-ssrf, api-size,
  api-requests, api-answers — 25 stages in all); API Gateway benchmarks
  (`go test -bench APICall ./internal/apigw`, a load run in
  bench/results): a plain
  call costs about 0.25 ms at the median over calling the API directly.
- Web UI: **APIs** (list with today's calls, errors and p50; a page per
  API with its credentials, OAuth state, recent calls and masked
  definition; YAML editor; disable, enable, delete) and **Connections**
  (state, expiry, who uses each; connect, renew, disconnect; new
  connections from the 30 presets) under *API Gateway*; the key form
  limits keys to APIs; an MCP server's page shows its OAuth state with
  a Connect button; the OAuth result page leads to the connections.
- `promptgate apis list|call` (call runs one request through the API
  Gateway's rules in-process, without a pg_ key), `keys create --api`,
  an APIS column in `keys list`; control plane tools `apis`,
  `oauth_connections`, `api_set` and `api_delete` — agents can't set
  credentials, `private` or move a credentialed API — and `key_create`
  takes `apis`; `mcp import` gives remote servers without credentials
  `oauth: auto`.
- MCP authorization discovery: `mcp.servers.<name>.oauth: auto` finds
  the authorization server from the 401's `resource_metadata` or the
  well-known URIs (RFC 9728), reads its metadata (RFC 8414 / OpenID),
  registers PromptGate as a client (RFC 7591, public with PKCE), sends
  `resource` (RFC 8707) with every request and refuses servers without
  PKCE S256; `promptgate oauth connect mcp:<server>`; 2025-03-26
  servers without metadata are tried at their origin. Named
  connections get `resource` too.
- `security.ssrf.mcp: true` checks remote MCP servers' addresses; a
  changed SSRF setting reconnects them at once.
- Guardrails on API Gateway bodies: global rules, `guardrails.apis.<api>`,
  then the key's; requests read as role `assistant`, answers as role
  `tool`; JSON (every string value) and text bodies, binary bodies and
  event streams pass uninspected; redaction restored in the answer;
  blocks answer 422 (request) or 502 (answer withheld), compressed text
  bodies the guards can't read are refused (415 / 502);
  `ip_allowlist` and `time_window` apply to every call. The web UI's
  guardrails page has the new scope.
- API Gateway requests in the request log (surface `api`: API as
  provider, method as model, path without query as route; refused
  requests too), `logs --surface api`, `stats --by api|method`
  (`--surface api`), own per-minute totals (store schema v14,
  `api_rollups`) kept out of model stats and cost; `limits.apis`
  (per API, shared by all keys, `"*"`), 429 with `Retry-After`;
  Prometheus `promptgate_api_requests_total`,
  `promptgate_api_request_duration_seconds`,
  `promptgate_ssrf_blocked_total`; console lines, the web UI's log
  filter, the limits page and the control plane's `stats`, `logs`
  and `limit_set` know the new surface.
- API Gateway configuration: `apis.<name>` (`url`, `methods`, header
  policy `forward`/`block`/`set` with `${ENV}` and `{{ key }}`,
  `{{ user }}`, `{{ request_id }}`, timeouts, body caps, `query`,
  `retries`, `private`, `forwarded`), `surfaces.api_gateway.mount`
  (default `/api`) and `keys[].apis` — see [API Gateway](/api-gateway/).
- SSRF protection (`internal/netguard`): outbound connections are
  checked at dial time on the resolved address — loopback, private,
  link-local and metadata, CGNAT, multicast and reserved ranges, IPv4
  in mapped/NAT64/6to4 form — so DNS rebinding can't get through;
  exceptions in `security.ssrf.allow`.

### Changed

- The API Gateway also refuses `..;` path segments (`..;jsessionid=x`),
  which Tomcat and other servlet containers read as `..`; streamed
  answers reuse their copy buffers (17 instead of 52 KB per call).
- A remote MCP server whose OAuth connection has no token yet gets its
  requests without one; its 401 then says what to run.
- The secret key file is created only when an OAuth connection first
  needs it, written whole and linked into place — concurrent first
  starts agree on one key and never read a half-written file.
- Surface mounts are checked pairwise for overlaps (three surfaces now).

### Performance

Release run, on a machine kept busy by unrelated projects (load average
13–24): the proxy path is unchanged code and measures as v0.7.0 does
within the run's noise (0.30 ms at the median at one client in the
steadier round, 52–53 MB RSS); an API Gateway call with guardrails on
both bodies costs 0.26–0.27 ms at the median over calling the API
directly, 0.24 ms without — see
bench/results.

## Earlier releases

- [0.7.x](/changelog/v0-7/) — the MCP gateway (archived early: the unreleased v0.8 changes need the room)
- [0.6.x](/changelog/v0-6/)
- [0.5.x](/changelog/v0-5/)
- [0.4.x](/changelog/v0-4/)
- [0.3.x](/changelog/v0-3/)
- [0.2.x](/changelog/v0-2/)
- [0.1.x](/changelog/v0-1/)

[Unreleased]: https://github.com/promptgate-ai/promptgate/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/promptgate-ai/promptgate/compare/v0.6.0...v0.7.0
