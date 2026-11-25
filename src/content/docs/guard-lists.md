---
title: "Lists from files and URLs — lists"
description: "Some guardrails take long lists: code names a team must not send, the networks allowed to use a key, addresses that may pass the PII filter. Instead of writing…"
---

<!-- Generated from docs/guard-lists.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Some guardrails take long lists: code names a team must not send, the
networks allowed to use a key, addresses that may pass the PII filter.
Instead of writing them into the config, point the guard at a text file
with one entry per line, or at a URL that PromptGate fetches in the
background — a term list from the intranet, IP ranges from your VPN
provider.

```yaml
guardrails:
  keywords:
    words: ["Project Falcon"]               # still allowed, combined with the lists
    lists:
      - file: lists/codenames.txt           # relative to the config file
      - url: https://intranet.example.com/api/blocked-terms
        headers: { Authorization: "Bearer ${TERMS_TOKEN}" }
        format: json
        field: data.terms                   # {"data": {"terms": ["…", "…"]}}
        refresh: 15m
  ip_allowlist:
    lists:
      - url: https://vpn.example.com/egress-ranges.txt
        into: allow
        required: true                      # see below: no list, no start
```

A file looks like this — empty lines and lines starting with `#` are
skipped, spaces around an entry are trimmed:

```text
# code names of unreleased products
Project Atlas
Nova
```

## Which guards take lists

| guard | `into` (first is the default) | an entry is |
|---|---|---|
| [`keywords`](/guardrails/#keywords) | `words` | a word or phrase |
| [`ip_allowlist`](/guard-access/#ip_allowlist) | `allow`, `deny` | an IP or CIDR |
| [`prompt_injection`](/guard-injection/) | `custom` | a phrase in the [phrase syntax](/guard-injection/), reported as `kind` (default `custom`) |
| [`pii`](/guard-pii/) | `allow` | a value that is never reported; `@domain` allows a domain |

The entries are added to what the setting already lists. Other guards
refuse a `lists` setting.

## Settings

| field | default | |
|---|---|---|
| `file` | — | a text file; relative paths start at the config file's directory |
| `url` | — | `http://` or `https://`; one of `file` and `url` is required |
| `format` | `lines` (`json` for `.json` files) | `lines`: one entry per line; `json`: an array of strings |
| `field` | — | `json` only: dotted path to the array inside an object (`data.terms`) |
| `into` | the guard's first | the setting the entries extend, see above |
| `kind` | `custom` | `prompt_injection` only: the kind its findings report |
| `headers` | — | `url` only: request headers, `${ENV}` allowed — for tokens |
| `refresh` | `15m` | `url` only: how often it is fetched again; at least `30s` |
| `required` | `false` | `url` only: without a copy yet, the gateway refuses to start |

## Files

A list file is read when the config loads and watched like the config
itself: change it and the next requests use the new entries, no
restart. A file that is missing or unreadable makes the config invalid;
as with any config error, the running gateway keeps its previous one.

## URLs

`promptgate start` fetches every URL that has no copy yet before it
serves, then each one every `refresh` in the background — with
`If-None-Match` / `If-Modified-Since`, so an unchanged list costs a
304. A changed list reloads the guardrails; requests in flight finish
with the old entries.

PromptGate keeps the last good copy of each list in its data directory
(`lists/`, readable only by its user) and restarts with it, also when
the server is down. A failed fetch — no connection, an HTTP error, a
body that isn't the configured format, more than 16 MiB — keeps the
copy in use and retries after a minute.

Never fetched and not reachable at start:

- by default the gateway starts without the list's entries. A guard
  that checks nothing without entries — `keywords`, `ip_allowlist` —
  is off until the first fetch; the others work without the extra
  entries.
- with `required: true`, `promptgate start` refuses to start. Use it
  where missing entries let traffic through — above all for an
  `ip_allowlist` `allow` list, which would otherwise admit everyone
  until the first fetch.

Logs, events and `promptgate lists` show a URL without its query and
credentials, which often carry a token. Redirects are followed on the
list's own host only; one to another host fails the fetch, so a token
in `headers` never travels elsewhere.

## Scopes

A `lists` setting belongs to its scope like any other field: entries
from the global rule's lists reach every request, and an override that
sets the same field (`words`, or `lists` that extend it) replaces them
for its model, endpoint or key. Whether a guard is off for lack of
entries is decided after the scopes are merged, so a key's own `words`
keep `keywords` on under an empty global list.

## Watching lists

```bash
promptgate lists            # every list: scope, guard, source, entries, last change, status
promptgate lists --check    # fetch every URL now, nothing stored: try a new URL or token
```

A running gateway publishes two [events](/events/) — `list.updated`
when a URL's list changed, `list.failed` once when fetching starts to
fail — that [webhooks](/webhooks/) can forward.

## Performance

`keywords` finds every word of its list in one pass over the request
(Aho-Corasick): with 20,000 words a 2 KB request takes **3.3 µs**, about
what a few words cost, where searching word by word took half a
millisecond. Building the index for 20,000 words takes about 6 ms on a
reload, its memory grows with the lists' distinct prefixes (1.7 MB for
20,000 similar code names). Apple M3 Pro.
