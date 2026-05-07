---
title: First-run Onboarding
description: A 5-step checklist on the dashboard guides new admins from "fresh install" to "first request answered" without leaving the page.
---

The first time you load the dashboard on a fresh PromptGate install, a **Welcome to PromptGate** banner appears at the top with a 5-step checklist. Each step ticks itself off automatically as you complete it — there's no imperative tracking, just five binary "does this row exist?" checks against the database.

## The five steps

| # | Step | Done when |
|---|---|---|
| 1 | Create your first project | A row exists in `projects` |
| 2 | Add a provider credential | A row exists in `credentials` |
| 3 | Create your first endpoint | A row exists in `endpoints` |
| 4 | Issue an API token | An active row exists in `api_tokens` |
| 5 | Send your first request | Any row exists in `gateway_logs` |

The banner hides itself once **all five** are done OR you click the **×** to dismiss it. Dismiss is persisted as `onboarding.dismissed=true` in the `app_settings` k/v store.

## Why no "click here" tracking?

Two reasons:

1. **It's idempotent.** If you delete the seed project the wizard re-appears, because step #1 is genuinely undone again. That's the right behaviour for a re-run.
2. **It works after restore.** If you import a backup with projects + credentials + endpoints, the wizard sees they're all there and goes silent — no "you haven't clicked the button yet" false alarms.

## Resetting

Set `onboarding.dismissed=false` in `app_settings` to bring the banner back at any time. There's no UI button for this — admins who want it back are usually debugging, and `php artisan tinker` is one line away.

```php
\App\Services\Settings\AppSettings::set('onboarding.dismissed', false);
```

---

> © Akyros Labs LLC. All rights reserved.
