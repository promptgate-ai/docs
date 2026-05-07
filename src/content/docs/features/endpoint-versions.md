---
title: Endpoint Versioning
description: Every save to an endpoint snapshots its config so you can compare, diff, and roll back. History is append-only — restores create a new version, never overwrite.
---

Every time you save an endpoint, PromptGate writes a snapshot of its configuration to `endpoint_versions`. That gives you three things you didn't have before:

1. **History** — what did this endpoint look like a week ago?
2. **Diff** — exactly which fields changed between two versions?
3. **Restore** — apply any old version as the current config without typing it back in.

## How it works

Snapshots cover the user-editable config columns: `name`, `slug`, `prompt`, `user_prompt_template`, `input_schema`, `output_schema`, `provider_model`, `credential_id`, `provider_template_id`, `failover`, `temperature`, `top_p`, `max_output_tokens`, rate limits, cache settings, budget, streaming, sessions, MCP exposure, routing rules. Identity / timestamps stay out — they're not configuration.

The version number is monotonic per endpoint, starts at 1, and increments by 1 on every save. There is no "delete a version" — history is append-only.

## Restore

Click **Restore this version** on any non-latest version. PromptGate:

1. Applies that snapshot to the endpoint (overwrites the live config).
2. Records the result as a *new* version with `note = "restored from v<n>"` and `author_user_id = you`.
3. Writes an `endpoint.version.restore` audit entry referencing the source version number.

So a restore looks like this in history:

```
v3  (current)  restored from v1     ← what you just did
v2             updated
v1             created
```

If the restore was wrong, restore again — `v3` is now in history; you can roll forward back to `v2`.

## Diff

The version detail page shows a side-by-side diff against the **previous** version (`v3` vs `v2`). Use the **Compare** form on the index page to diff any two arbitrary versions (e.g. `v1` vs `v5`).

The diff is field-level: only fields whose values differ are listed. JSON fields (`input_schema`, `output_schema`, `failover`) are pretty-printed; scalars are dumped via `var_export`.

## Pairs well with

- **Evals** — restore an old version, run the eval set, restore the new version, run again. Did the regression we suspected actually exist?
- **Replay from Logs** — replays always run against *current* config; combined with versioning you can replay a request, restore an older version, replay again, and compare both responses in Live Logs.

## Limitations

- Versions persist forever; they're not pruned by retention policy. A loud endpoint with daily edits will accumulate rows. We'll add a "snapshot only when changed" optimization if this becomes a real footprint problem.
- API Gateway endpoints (HTTP proxy) aren't versioned yet — AI Gateway only.

---

> © Akyros Labs LLC. All rights reserved.
