---
title: "Web UI pages"
description: "What each page of the web UI shows and does. Every page that changes a file previews the change and saves through one checked path: validated like promptgate…"
---

<!-- Generated from docs/ui-pages.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

What each page of the [web UI](/ui/) shows and does. Every page that
changes a file previews the change and saves through one checked path:
validated like `promptgate validate`, refused when the file changed
since it was opened, the previous version kept in
`.promptgate-backups/`, written atomically and reloaded once.

## Dashboard

The home page shows the gateway at a glance and refreshes itself every
30 seconds while the tab is visible:

- **today** (from midnight in `budgets.timezone`): requests with the
  change against yesterday by the same hour, error rate, p95 and p50
  latency, spend, and this month's spend
- **requests per hour** over the last 24 hours, failed ones in red, and
  **spend per day** over the last 30 days — hover a bar for its numbers
- the five **busiest models and keys** today
- the six **budgets** closest to their limit (amber from 80 %, red when
  used up) — the same numbers as `promptgate budgets`
- endpoint **anomalies** of the last hour, and the **gateway**: address,
  default provider, auth mode, keys, aliases, endpoints, uptime

Everything comes from the request log's per-minute stats, so the page
costs the same however many requests were logged. The 30-day chart is
kept for five minutes. Charts are drawn on the server as SVG — no
JavaScript library.

## Logs

**Logs** lists every request, newest first, 100 per page — the same log
as `promptgate logs`. Filter by time (last hour, 24 hours, 7 days,
everything), traffic (model requests or MCP tool calls — those show
server and tool as provider and model), status (`429`, `5xx`), model,
provider, key, end user, endpoint and session; the fields suggest the configured names. An end
user is matched the way it is logged, so with `users.log: hashed` you
can type the plain id. Each row shows tokens, cost, duration and what
happened on the way: streamed, answered from the endpoint cache, a
fallback, a guardrail finding, an endpoint route, an error.

**Live** adds new requests on top as the gateway logs them, for the
current filter. The page asks the log for rows newer than the last one
once a second (server-sent events), so the live view never touches the
request path; at most 32 live views are open at once, and they end on
sign-out. It sends at most 200 rows a second: when more arrive, it jumps
to the newest rather than falling behind, and says so once.

Filters are checked against the log row by row from the newest: a
filter that matches often answers at once, one that matches rarely
reads the whole time range (with two million rows, about a third of a
second). The log keeps one index, on time, so writing stays fast.

A request's page shows everything logged about it, with links to the
requests of the same key, end user, endpoint, session or model. With
`logging.bodies: true` it also shows what the provider got (after
guardrails) and what it answered, up to 1 MB each.

## Cost

**Cost** shows spend over the last 7, 30 or 90 days, this month or last
month (days in `budgets.timezone`): total spend and requests against
the period before, cost per request, tokens, a bar per day, and a table
by model, provider, key, endpoint or end user with each one's share.
Requests without a price count as $0 and are pointed out, so a missing
`pricing:` entry doesn't hide spend. Below are all budgets with what
they have used today and this month.

**Export CSV** downloads the range as one row per day and group — day,
name (and key, for end users), requests, errors, input, output and
cached tokens, unpriced requests and cost in USD. Names that start like
a spreadsheet formula (`=`, `+`, `-`, `@`) get a leading `'`, since
model names and user ids come from clients.

The page reads the per-day totals; they are kept as long as
`logging.stats_retention` (90 days by default).

## Endpoints

**Endpoints** lists the [AI Gateway endpoints](/endpoints/) with their
model, version, input mode, features and today's requests, failures,
p95 and spend.

An endpoint's page shows today's numbers, its variables with their
rules, how to call it (curl to `/gw/<name>`, and as `model:
"endpoint:<name>"` from any OpenAI SDK), and:

- **Prompt preview** — fill in sample values and see the system prompt
  and user message exactly as the endpoint builds them, or the problems
  it would answer with. Nothing is sent to a provider.
- **Versions** — every version the gateway loaded, with the requests it
  served; compare one with the running version, or restore it (its
  definition is written back).
- **Definition** — the endpoint as written in its file, comments
  included.
- **Disable / enable / delete** from the ⋮ menu.

**New endpoint** and **Edit** open a form: name, model, description,
system prompt, template, streaming, disabled, a table of variables
(type, required, default, allowed values, length and range, pattern,
description), and the other settings — params, client_params, schemas,
output_retries, routes, sessions, cache — as YAML. **Check and show
changes** validates and lists the changed lines; saving goes through the
same path as the config editor (checked like `promptgate validate`,
conflicts refused, backup, atomic write, one reload).

New endpoints are written to the endpoints directory as `<name>.yaml`;
endpoints under `endpoints:` in the config file are changed in place.
Only what changed is rewritten: values that stay the same keep their
layout and comments.

## MCP servers

**MCP servers** lists the [MCP gateway's](/mcp/) servers: transport,
target (URL without credentials, or the command line), state —
connected or running, not connected or not started, failing (with the
reason on hover), disabled — the protocol version and era once known,
and the number of tools once their list is loaded. Showing the page
never contacts a server or starts a program. Below: the gateway's
address, the `promptgate mcp setup` / `import` commands, how many
endpoints are served as tools and how many keys have PromptGate's own
tools.

- **Add server** / **Edit** — the entry under `mcp.servers` as YAML,
  starting from a template; checked with the whole config, previewed as
  a diff, saved through the checked path. Only that server reconnects.
- On a server's page: **Load tools** connects (a local program starts)
  and lists its tools as agents call them, `<server>__<tool>`;
  **Reconnect** drops the connection — a program stops and starts again
  on its next call; **Disable**, **Enable**, **Delete**; links to its
  logs and to *What applies*. Its definition shows `${ENV}` references;
  literal header and env values are hidden.

The [API Gateway's](/api-gateway/) pages — **APIs** and **Connections**
— are described in [Web UI: APIs and connections](/ui-apis/).

## Playground

**Playground** sends a request through the running gateway and shows the
answer as it streams in, with status, latency, time to first byte,
tokens, cost, the model that answered, the endpoint route, answer
cache, fallback and guardrail findings.

- **Endpoint** — pick an endpoint and fill in its variables (or a
  message, for endpoints without variables).
- **Model** — any alias or `provider:model`, with a system prompt,
  temperature and max tokens.
- **Request** — a raw request body for any API route. **Replay** on a
  logged request (with `logging.bodies`) opens it here as the provider
  got it, aimed at the model that answered — change the model to
  compare.

Requests run inside the gateway's process as the key `ui:<user>`: the
same guardrails, rate limits and budgets apply, they are logged and
charged like any client's, and they appear in the logs under that key.
Only the UI's own code can make such requests — the identity is carried
in-process and can't be sent over the network. With `auth.mode:
passthrough` the gateway has no provider keys of its own, so the
playground asks for yours and sends it instead. An optional end user is
sent in `users.header`.

## Evals

An endpoint's **Evals** tab runs its test cases — `evals/<endpoint>.yaml`
next to the config, the file `promptgate eval` runs in CI — through the
running gateway and shows each case's answer, latency, tokens and what
it missed (status, contains, not_contains, matches, max_latency,
max_output_tokens). Without a file it shows an example to start from.
Runs are real provider calls, made and logged as `ui:<user>`.

## Keys

**Keys** lists the `pg_` keys with what they may use, their end-user
policy, when they were last used and today's requests and spend.

- **New key** — a name, the providers, AI Gateway endpoints, MCP
  servers and APIs it may use (none checked: all; single MCP tools as
  `server/tool`), PromptGate's own MCP tools (`none`, `read`, `write`)
  and its end-user policy (`optional`, `required`, `ignore`). The key is shown **once**, with how to use it;
  only its SHA-256 hash is stored, so it can't be shown again.
- On a key's page: change providers, endpoints, MCP access, control and policy, **rotate**
  its secret (the old one stops working at once; the new one is shown
  once), **disable**, **enable** or **delete** it, and jump to its logs
  and cost.
- The UI writes `keys.yaml` (`auth.keys_file`) — the file `promptgate
  keys` manages — through the checked write path, and the gateway
  applies the change to the next request. Keys listed under `keys:` in
  the config file are shown read-only; change them there.

## Policies

- **Rate limits** and **Budgets** are tables per scope — keys, model
  aliases, providers, endpoints, end users, and for rate limits MCP
  servers and `server/tool` — with a name (or `*` for
  every name without its own entry) and the limit: requests per time
  and an optional burst, or spend and tokens per day and month. Budgets
  also take the time zone days start in and caps for the whole gateway.
- **Guardrails** edits the rules of one level at a time — every request,
  or an override for a model alias, endpoint or key — as YAML, checked
  by building the guards (an unknown guard or option is refused before
  anything is written). Emptying an override removes it.
- **Providers & models** lists the upstreams (preset, base URL, API key,
  timeout) and the model aliases (provider, model, fallbacks). Settings
  the form has no field for — headers, system prompts, params — stay as
  written. An API key written into the file in plain text is never sent
  to the browser: its field stays empty, and empty keeps it. Use
  `api_key: ${NAME}` instead.
- **What applies** takes a key, endpoint, model and end user — or a key
  and an MCP server — and shows
  the cascade resolved: where the model goes, what the key may use, each
  rate limit and budget that applies with the entry it comes from and
  today's use, and the merged guardrails with the levels that set each
  guard. Key and endpoint pages link to it.

Every policy page previews its change against the config file and saves
through the same checked path as the config editor; values that didn't
change keep their layout and comments.

## Config file

**Config file** edits `promptgate.yaml` as text, with line numbers and
colours for keys, values, comments and `${NAME}` references. What you
type is what is written — comments, blank lines and layout stay yours.

- **Check and show changes** validates the text and lists the changed
  lines against the file on disk.
- **Save and reload** (⌘/Ctrl-S) checks the file exactly like
  `promptgate validate` — with the keys file, endpoints directory,
  environment and flags — and refuses it with the reason when the
  gateway couldn't run it. A valid file is written atomically (a reader
  never sees half of it), with its permissions kept, and the gateway
  reloads it at once; the page says if that reload fails.
- **Conflicts:** the editor remembers which version of the file it
  opened. If the file changed since — edited by hand, by `promptgate
  keys`, or in another tab — saving is refused instead of overwriting
  that change, and the changes are shown against the current file.
- **Backups:** every save keeps the previous version in
  `.promptgate-backups/` next to the file (the last 20); the page lists
  them.
- `${NAME}` references are never expanded into the file: secrets stay
  in the environment.

Each save is recorded in the audit trail with the number of changed
lines.

## Prices

**Prices** shows the price table — USD per million tokens of input,
output, cache reads and cache writes, by provider and model — searchable,
with your overrides from `pricing:` marked. **Answered without a price**
lists the models that served requests in the last 30 days without a
known price: they count as $0 in costs and budgets until a price is set.
**Set a price** writes an override under `pricing:` (a missing cache
price falls back to the input price); an override can be removed again.

## Audit trail

Sign-ins, failed sign-ins, sign-outs, password and user changes, and
every change made through the UI — config file, endpoints, keys,
policies, prices, eval runs — and through the command line and the MCP
control plane, with who, when, from which address and a short detail
(never a secret). Each entry is signed into a hash chain and shows its
number in it. On top, the chain's state: intact (with its head), broken
(at which entry) or not signed yet. Filter by actor (`ui:admin`, `cli`,
`mcp:<key>`) and action, 100 per page; **Export CSV** / **JSONL**
download the selection with every field. See [audit trail](/audit/).

## Settings

The gateway's version and build, platform, address, uptime and price
table; where it keeps its files — config, keys, endpoints, evals,
backups of changed files, request log; the licenses of what the binary
contains; and the **users of this UI**: add one (a random password,
shown once, to change at the first sign-in), reset another's password,
remove a user. You can't reset or remove yourself here (use Change
password), nor remove the last user.
