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

- Homebrew: `brew install promptgate-ai/tap/promptgate` (macOS; the
  cask carries the Linux binaries too). The release workflow writes the
  cask after the binaries are uploaded, through a deploy key that can
  write to the tap only; on macOS the cask clears the download's
  quarantine flag, since the binaries are signed with PromptGate's own
  key, not notarized by Apple.

### Changed

- Docs: the guardrails, AI Gateway endpoints, end users, MCP gateway
  and API Gateway pages open with everything the feature can do and one
  config that uses all of it (each checked with `promptgate validate`).
  New pages: operations (log, metrics, events, webhooks, audit,
  anomalies at a glance), MCP servers (server settings, protocol
  versions, local programs) and the pgfuzz quality gate.
- Docs: the quality gate page lists all 26 stages (the MCP and API
  Gateway stages were missing); links to pgfuzz go to its docs page.

## [0.9.0] - 2026-11-25

The operations release, and the one to start with: `promptgate start`
on a fresh machine asks six questions, writes a config with
protection on — secrets masked, personal data redacted and restored,
prompt injection refused, a daily budget per key — points Claude Code
and Codex at the gateway and keeps it running in the background. For
the people who run it, every change and every incident becomes an
event: a hash-chained audit trail that shows when an entry was edited
or removed, and signed webhooks that take events to a chat channel, a
pager or a SIEM, queued durably and retried for two days. Guardrails
read their words, networks and phrases from files and URLs, and the
keyword guard finds 20,000 of them as fast as a handful.

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
  - `promptgate webhooks list` (state ok / failing / idle / disabled,
    waiting, delivered and given up in 24 h), `test <webhook>` (a signed
    `webhook.test` now, exit 1 unless 2xx), `deliveries` (filters,
    `--id` with the event and the answer), `redeliver <id>… | --failed
    <webhook>` (audited as `webhook.redelivered`); metrics
    `promptgate_webhook_deliveries_total{webhook,result}` and
    `promptgate_webhook_pending{webhook}`; a receiver example in Go.

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
- Guardrail lists from files and URLs ([lists](/guard-lists/)):
  `lists` fills `keywords` words, `ip_allowlist` ranges,
  `prompt_injection` phrases and `pii` allowed values. Files are
  watched; URLs are fetched in the background (headers with `${ENV}`,
  `refresh`, ETag), the last good copy kept and used across restarts,
  `required` to refuse starting without one. Events `list.updated` and
  `list.failed`; `promptgate lists [--check]`.

### Changed

- `keywords` finds all words in one pass: 20,000 words cost 3.3 µs per
  2 KB request, where word-by-word search took half a millisecond.

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

### Performance

Release run against v0.8.1, same config, every feature on: the proxy
path measures the same (0.09 ms at the median at one client, 0.26 ms
at 16, about 55,000 req/s), with or without a 10,000-entry keyword
list; starting takes 41–59 ms, RSS 52–60 MB — see
bench/results.

## Earlier releases

- [0.8.x](/changelog/v0-8/) — the API Gateway and OAuth connections; 0.8.1 Claude subscriptions through passthrough
- [0.7.x](/changelog/v0-7/) — the MCP gateway
- [0.6.x](/changelog/v0-6/)
- [0.5.x](/changelog/v0-5/)
- [0.4.x](/changelog/v0-4/)
- [0.3.x](/changelog/v0-3/)
- [0.2.x](/changelog/v0-2/)
- [0.1.x](/changelog/v0-1/)

[Unreleased]: https://github.com/promptgate-ai/promptgate/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/promptgate-ai/promptgate/compare/v0.8.1...v0.9.0
