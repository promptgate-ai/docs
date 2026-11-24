---
title: "Access rules — ip_allowlist, time_window"
description: "Who may use a key, and when: \"the CI key only works from the build network\", \"engineering keys only during office hours\". Both rules look at the request, not…"
---

<!-- Generated from docs/guard-access.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Who may use a key, and when: "the CI key only works from the build
network", "engineering keys only during office hours". Both rules look
at the request, not its content, and refuse with **403** in the
client SDK's error shape — before anything reaches a provider, and
without using a rate-limit token or budget.

```yaml
server:
  trusted_proxies: [10.0.0.0/8]          # nginx / load balancer in front

guardrails:
  keys:
    ci:
      ip_allowlist: { allow: [10.20.0.0/16] }
    engineering:
      time_window:
        timezone: Europe/Berlin
        windows:
          - { days: mon-fri, from: "07:00", to: "20:00" }
```

Like every guardrail they apply globally, per model alias or per key,
merged field by field ([scopes](/guardrails/#scopes)). Action `block`
(default) or `log` to try a rule out first.

## `ip_allowlist`

| field | | |
|---|---|---|
| `allow` | IPs and CIDRs | only these may send; empty allows everyone not denied |
| `deny` | IPs and CIDRs | always refused, even inside `allow` |

IPv4 and IPv6 both work; `::ffff:10.1.2.3` counts as `10.1.2.3`. A
request whose address can't be determined is refused.

```text
Request blocked: requests from 198.51.100.7 are not allowed.
```

### Behind a reverse proxy

Behind nginx, Caddy, a load balancer or Cloudflare, every request
arrives from the proxy. List the proxies in `server.trusted_proxies`;
for connections from them PromptGate reads `X-Forwarded-For` **from
the right** and takes the first address that isn't a trusted proxy.
Entries further left were written by the client and are never
believed, so nobody can claim an allowed address by sending the header
themselves. With `trusted_proxies` empty (the default) the header is
ignored.

## `time_window`

| field | | |
|---|---|---|
| `timezone` | IANA name, e.g. `Europe/Berlin` | default: the server's time zone |
| `windows` | list | a request is allowed if it falls into any of them |
| `windows[].days` | `mon-fri`, `sat`, `[mon, wed]`, `weekdays`, `weekend`, `daily` | default every day; ranges may wrap (`fri-mon`) |
| `windows[].from` / `to` | `"08:00"` / `"18:00"` | default `00:00` / `24:00`; `to` is exclusive |

A window that ends before it starts runs past midnight, and the hours
after midnight belong to the day it began: `{days: fri, from: "22:00",
to: "02:00"}` covers Saturday 01:30, not Friday 01:30.

```text
Request blocked: outside the allowed hours (mon-fri 07:00–20:00 Europe/Berlin).
```

Common settings (`enabled`, `action`) and scopes are described in
[guardrails](/guardrails/).
