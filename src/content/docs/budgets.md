---
title: "Budgets"
description: "Budgets cap what PromptGate lets through per calendar day and month — in USD, in tokens, or both — for a pg_ key, an end user, a provider, or all traffic. A…"
---

<!-- Generated from docs/budgets.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Budgets cap what PromptGate lets through per calendar day and month — in
USD, in tokens, or both — for a `pg_` key, an [end user](/users/), a
provider, or all traffic. A
request whose budget is used up gets **402** with an error in your SDK's
shape (`insufficient_quota` for OpenAI SDKs, `billing_error` for Anthropic
SDKs). It is not sent upstream; it is logged like any other request.

```yaml
budgets:
  timezone: Europe/Berlin            # when days and months start (default UTC)
  total: {monthly_usd: 1000}         # all traffic through PromptGate
  keys:
    "*": {daily_usd: 5}              # every pg_ key: 5 USD per day
    ci-bot: {daily_tokens: 2000000, monthly_usd: 100}
  users:
    "*": {daily_usd: 2, monthly_usd: 20}   # each end user of each key
  providers:
    openai: {monthly_usd: 500}
```

Each budget takes any of `daily_usd`, `monthly_usd`, `daily_tokens` and
`monthly_tokens`; a request is refused as soon as one of them is reached.
`"*"` gives every key (or provider) without its own entry the same budget,
counted separately for each.

## What counts

- **USD** uses the built-in price table plus your `pricing:` overrides —
  the same numbers `promptgate stats` shows. Models without a price add
  nothing to USD budgets; give them a price or use a token budget.
- **Tokens** are input + output + cache tokens as reported by the provider.
- **Key budgets** cover requests with that `pg_` key. Passthrough requests
  (the caller's own provider key) have no `pg_` key; they count toward
  provider and total budgets.
- **Endpoint budgets** cover requests to that [AI Gateway
  endpoint](/endpoints/), whichever key sent them.
- **User budgets** cover requests that name that [end user](/users/),
  counted per key and user: the id `42` under two keys is two users.
  Named entries use the id clients send, also with `users.log: hashed`.
  Requests without an id, and keys with `users: ignore`, count only toward
  the other budgets.

## When it is enforced

Spend is known only once a response is complete, so PromptGate checks
what was spent *before* a request starts. A request that starts under
budget always completes — the last one may go slightly over. With many
concurrent requests the overshoot is at most what those requests use.

Budgets reset at midnight (daily) and on the 1st (monthly) in
`budgets.timezone`. The error message says when:

```
budget exceeded for key ci-bot: daily_usd 5.00 USD reached (spent 5.03); resets 2026-10-18 00:00 CEST
```

For an end user it says `budget exceeded for this user: …` without the id,
because the message is logged too.

## Restarts and reloads

- Spend is restored from the request log on start, so a restart doesn't
  reset budgets. User spend comes from the daily per-user totals. This needs `logging.store` on; with `logging.store: off`
  budgets count from zero after each restart (PromptGate warns).
- Monthly budgets need a month of history: `logging.stats_retention`
  (default `90d`) must be at least `31d`. `logging.retention` only governs
  individual request rows and can stay short.
- Editing `budgets:` takes effect without a restart, with the spend so far
  — PromptGate counts all traffic whether or not a budget is configured.
  Changing `timezone` needs a restart.
- Several PromptGate instances each count their own traffic.

## Checking spend

```console
$ promptgate budgets
SCOPE     NAME    LIMIT         USED          OF
total             monthly_usd   $412.80 (41%) $1000.00
key       ci-bot  daily_tokens  1203344 (60%) 2000000
key       ci-bot  monthly_usd   $61.20 (61%)  $100.00
provider  openai  monthly_usd   $388.10 (78%) $500.00
```

With user budgets, the users who have used the largest share of a limit
follow as `user` lines named `key/user`: ten by default, `--top n` for more,
`--top 0` for all. `--json` prints the same as JSON. The numbers come from the request log; a
running gateway may be a fraction of a second ahead.

A request that finds a budget at 80 % publishes `budget.warning`, one that
finds it used up `budget.exceeded`. Each fires once per limit and period
([events](/events/)).
