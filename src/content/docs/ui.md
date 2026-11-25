---
title: "Web UI"
description: "PromptGate ships a web UI inside the binary: server-rendered pages, a little plain JavaScript, its fonts and icons — no Node, no CDN, no request to another…"
---

<!-- Generated from docs/ui.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate ships a web UI inside the binary: server-rendered pages, a
little plain JavaScript, its fonts and icons — no Node, no CDN, no
request to another host. It is on by default and listens on **its own
port, on localhost only**.

It covers what the YAML and the CLI do — dashboard, request log, cost,
AI Gateway endpoints with versions and evals, a playground, keys,
guardrails, rate limits, budgets, providers and models, prices, the
config file itself, the audit trail and the UI's users — and every
change it makes is written back to the YAML, checked and reversible.

## First start

The first start creates the user `admin` with a random password and
shows it once:

```
  web UI            http://127.0.0.1:7879/
  web UI sign-in    admin / 7hKq…
                    first start: shown once (also in ~/.local/share/promptgate/ui-initial-password) — you choose your own password after signing in
```

The password is also saved next to the database (`ui-initial-password`,
readable only by the gateway's user), for services whose output nobody
watches. After signing in, `admin` must choose a password of their own;
the file is deleted then.

## Pages

[Dashboard, logs, cost, endpoints, MCP servers, playground, evals, keys,
policies, prices, the config file editor, the audit trail and
settings](/ui-pages/), and [APIs and OAuth connections](/ui-apis/)
— what each shows and does.

## Users

Users live in the request log's database (`logging.store`), not in the
config: they are state, like the log. With `logging.store: off` there is
nowhere to keep them, and the UI stays off (`start` says so).

```bash
promptgate ui users                      # list
promptgate ui users add alice            # asks for the password twice
promptgate ui users remove alice         # also ends her sessions
promptgate ui passwd admin               # forgot it? set a new one
# or, signed in: Settings → Users of this UI (add, reset, remove)
echo "$PW" | promptgate ui passwd admin --password-stdin
```

Without a terminal and without `--password-stdin`, `add` and `passwd`
print a random password that must be changed at the next sign-in. These
commands work with or without a running gateway. Every user can do
everything; there are no roles.

Passwords need at least 12 characters. They are stored as PBKDF2-SHA256
hashes (600,000 iterations, a salt per user) — from Go's standard
library, no third-party crypto.

## Sessions and protection

| | |
|---|---|
| session | a random 256-bit token in a cookie (`HttpOnly`, `SameSite=Strict`, `Secure` with `ui.secure_cookies`); only its SHA-256 is stored, so the database alone can't sign anyone in |
| lifetime | ends after `ui.session_ttl` (12h) without activity, and after seven days at most; sessions survive gateway restarts |
| sign-out | ends the session; changing a password ends all of that user's sessions except the current one |
| failed sign-ins | 5 per user name and 20 per address within 15 minutes, then `429` until the window ends; unknown names take as long as wrong passwords |
| cross-site requests | refused for every form post (`Sec-Fetch-Site` / `Origin`); each form and script also sends the session's CSRF token |
| audit | sign-ins, failed sign-ins, sign-outs, password changes, user changes and every save, with the address (behind `server.trusted_proxies`, the client's), signed into a hash chain ([audit trail](/audit/)) |

Every response carries a strict Content-Security-Policy: scripts,
styles, fonts and images only from the UI itself, no inline scripts or
styles, no framing, forms only to the UI. Further headers:
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy` and
`-Resource-Policy: same-origin`. Pages are sent with `Cache-Control:
no-store`; assets have content-hashed names and are cached for a year.

Every build checks the UI from the outside with
[pgfuzz](/quality-gate/): 232 attacks on access, CSRF,
sign-in, headers and reflected markup, all of which must fail.

## Configuration

```yaml
ui:
  enabled: true            # false turns it off
  listen: 127.0.0.1:7879   # its own host:port, apart from API traffic
  mount: /ui               # optional: serve it on the gateway's port under /ui instead
  session_ttl: 12h         # 5m to 7d
  secure_cookies: false    # true when the UI is reached over HTTPS
```

| setting | how |
|---|---|
| move it | `ui.listen`, env `PROMPTGATE_UI_LISTEN=127.0.0.1:9000`, flag `start --ui 127.0.0.1:9000` |
| turn it off | `ui.enabled: false`, env `PROMPTGATE_UI_LISTEN=off`, flag `start --ui off` |
| share the gateway's port | `ui.mount: /ui` — then `/ui` redirects to `/ui/`; the path may not overlap `/v1`, `/healthz` or `surfaces.ai_gateway.mount` |

A listen address or `off` from the environment or a flag beats the file;
a listen address replaces a configured `mount`. UI settings are read at
start; a reload logs that a restart is needed.

Reaching the UI from other machines: put it behind a reverse proxy with
HTTPS and set `ui.secure_cookies: true` (and `server.trusted_proxies`,
so throttling and the audit see real addresses). `start` warns when the
UI listens beyond localhost without secure cookies:

```
WARN the web UI is reachable beyond localhost over plain HTTP — put it behind HTTPS and set ui.secure_cookies
```

The Docker image listens on `0.0.0.0:7879` inside the container — see
[install](/install/#docker) for publishing it.

## Look

The design system is the one of PromptGate v1: Space Grotesk and
JetBrains Mono (embedded, SIL Open Font License — see `promptgate
licenses`), ink and paper tones with a lime accent. The theme follows
the system setting until it is switched in the top bar; the choice is
kept in the browser.
