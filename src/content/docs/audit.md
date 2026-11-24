---
title: "Audit trail"
description: "The audit trail records every change to PromptGate and every sign-in: who made it, when, from which address, with a short detail. A detail never contains a…"
---

<!-- Generated from docs/audit.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

The audit trail records every change to PromptGate and every sign-in:
who made it, when, from which address, with a short detail. A detail
never contains a secret. Changes come from three places, and all of
them write to the same trail:

| actor | what |
|---|---|
| `ui:<user>` | the [web UI](/ui/): sign-ins, failed sign-ins, sign-outs, passwords, users, and every save (config file, endpoints, keys, APIs, MCP servers, OAuth connections, policies, prices, eval runs) |
| `cli` | the command line: `keys create/revoke/enable/delete`, `ui users add/remove`, `ui passwd`, `oauth connect/refresh/disconnect/prune`, `mcp import --write`, and the key `mcp setup` creates |
| `mcp:<key>` | an agent using PromptGate's [own MCP tools](/mcp-control/) |
| `gateway` | the gateway itself: the first admin at the first start, and retention |

`promptgate setup` isn't recorded: it creates the config the trail
belongs to.

The trail lives in the request log database. With `logging.store: off`
there is no trail, and the MCP control plane offers no write tools.

## Actions

Every entry has an action from the [event catalogue](/events/#catalogue),
such as `key.created`, `config.changed` or `auth.login_failed`, and is
published as an [event](/events/) under that name. Webhooks can then
subscribe to `key.*` or to `*`. `promptgate events` lists every action.

## Tamper evidence

Each entry is signed into a hash chain. It carries an HMAC-SHA256 over
its fields and over the MAC of the entry before it. The signing key is
derived from PromptGate's secret key (`PROMPTGATE_SECRET_KEY` or
`secret.key` next to the config), the same key that seals OAuth tokens.
The first change that needs it creates the key file.

Someone who can write to the database but doesn't have the key can't
change, delete, insert or reorder an entry without the chain showing it.
That includes the timestamp, the actor and whether an entry counts as
legacy. A verification walks the chain from the first entry and names
the first one that doesn't fit.

What the chain can't show:

- **Entries cut off at the end.** The newest entries have no successor
  that would miss them. Every entry is also published as an event, so a
  webhook receiver or SIEM holds a copy outside the database.
- **An attacker who has the secret key.** That attacker can sign
  anything. Keep the key out of backups that travel with the database,
  or set it with `PROMPTGATE_SECRET_KEY` from a secret store.

A different secret key makes every entry fail verification, just as
OAuth tokens become unreadable. Keep the key when you move PromptGate.

## Upgrading from v0.8

Version 0.9 moves the web UI's entries (sign-ins, users, changes) into
the new trail unchanged and marks them *legacy*. The first entry written
after the upgrade signs them in order and renames their actions to the
catalogue's names (`login` becomes `auth.login`). A gateway start does
the same. From then on they verify like every other entry. They are only
as trustworthy as the database was before the upgrade.

Schema v16 can't be read by v0.8 binaries. Downgrading needs a backup
of the database.

## Retention

```yaml
audit:
  retention: 400d   # default: 0, entries are kept forever
```

Once a day the gateway deletes entries older than `audit.retention`. It
always keeps the newest entry and appends an `audit.pruned` entry that
names the last deleted entry and its MAC, so the rest still verifies.
Deleting old entries without that signed marker shows as a gap. The
minimum is `1d`, so a typo can't empty the trail.

## Command line

```sh
promptgate audit list                         # the newest 50
promptgate audit list --actor cli --action 'key.*' --since 30d -n 200
promptgate audit verify                       # exit 1 when the chain is broken
promptgate audit export --format csv -o audit.csv --since 2026-01-01
```

| command | |
|---|---|
| `list` | newest first: number, time, actor, action, detail, address; `-n` (default 50), `--json` (one object per line, with the chain's fields) |
| `verify` | walks the chain and prints the number of entries, the range, entries pruned and from before v0.9, and the **head** (the last entry's number and MAC). Exit 1 names the first entry that doesn't verify. `--json` for scripts. |
| `export` | every field (`seq`, `time`, `actor`, `action`, `detail`, `ip`, `legacy`, `prev`, `mac`), oldest first, as `--format jsonl` (default) or `csv`, to stdout or `-o file` (never overwritten). Recorded as `audit.exported`. |

`list` and `export` take `--since` and `--until` (a duration such as `24h`
or `30d`, a date, or an RFC 3339 time), `--actor`, and `--action` (an
action or a prefix such as `key.*`).

Record the head from time to time, for example in a CI job or a ticket.
A later `verify` whose chain no longer reaches that entry, or reaches it
with a different MAC, shows that entries at the end were removed. A CSV
export protects a spreadsheet from formulas: a value starting with `=`,
`+`, `-` or `@` gets a leading `'`.

## In the web UI

*Settings → Audit trail* shows the state of the chain on top: intact
(with the head), broken (with the first bad entry) or not signed yet.
Below it, entries are listed newest first with their number in the
chain. You can filter by actor (`ui:admin`, `cli`, `mcp:ci-bot`) and by
action. **Export CSV** and **JSONL** download what the filters select,
with every field, and are recorded as `audit.exported`.
