---
title: Editions
description: Community Edition (BSL 1.1, free) vs Cloud Edition (managed, paid).
---

PromptGate is shipped in two editions. They share the same codebase and the same UI; the difference is **who runs it** and **which features are wired**.

## Community Edition

- **License**: [Business Source License 1.1](https://mariadb.com/bsl11/) (BSL 1.1)
- **Cost**: free
- **Where it runs**: your machines
- **Who supports it**: the community + GitHub issues
- **Source**: <https://github.com/promptgate-org/promptgate>

The Community Edition is **single-user** by design — there's exactly one admin account. That keeps the security model simple: every action is yours, every audit entry is yours, every credential is yours.

It includes everything the gateway can do at the protocol / runtime level: all four project types, all eight providers, all guardrails, rate limits, budgets, OAuth connections, MCP, observability, backup. The full feature matrix is on **[FEATURELIST.md](https://github.com/promptgate-org/promptgate/blob/main/FEATURELIST.md)** in the repo.

### What BSL 1.1 means in practice

The license **permits** non-commercial and small-org commercial use. It **prohibits** offering PromptGate as a commercial managed service that competes with the Cloud Edition. After the **change date** (4 years after release), the same code automatically converts to **Apache 2.0**.

In plain English:

- ✅ Run it for yourself, your hobby project, your startup, your day job, internally at any company.
- ✅ Modify the source. Contribute back. Fork it. Patch it. Self-host it forever.
- ❌ Wrap it in a sign-up flow and sell it as a hosted gateway. (That's what Cloud Edition exists for.)

For the exact legal text, see the [LICENSE](https://github.com/promptgate-org/promptgate/blob/main/LICENSE) file in the repo.

## Cloud Edition

- **License**: commercial
- **Cost**: paid (per-user / per-token plans)
- **Where it runs**: managed by Akyros Labs at <https://promptgate.dev>
- **Who supports it**: Akyros Labs

Cloud Edition is the same code with **multi-tenant features unlocked**:

| Feature | Community | Cloud |
|---|---|---|
| All four project types | ✅ | ✅ |
| All 8 providers | ✅ | ✅ |
| Guardrails (all types) | ✅ | ✅ |
| Rate limits / budgets | ✅ | ✅ |
| OAuth connections | ✅ | ✅ |
| MCP Bridge / Gateway / Control Plane | ✅ | ✅ |
| Observability (dashboard / metrics / logs / audit) | ✅ | ✅ |
| Webhooks | ✅ | ✅ |
| Backup / restore | ✅ | ✅ |
| **Single-user admin** | ✅ | — |
| **Multi-user with RBAC** (owner / admin / developer / viewer) | — | ✅ |
| **Invitations / team management** | — | ✅ |
| **MFA / SSO** (TOTP, Google, GitHub, SAML) | — | ✅ |
| **Org hierarchies** (multiple workspaces per org) | — | ✅ |
| **Billing / per-user pricing** | — | ✅ |
| **Managed updates / SLA / monitoring** | — | ✅ |

Cloud Edition is sold as a SaaS — sign up at <https://promptgate.dev> when it's launched, or stay self-hosted on Community.

## Which one should I pick?

| Situation | Edition |
|---|---|
| Solo developer / hobbyist | **Community** |
| Single-team internal tool | **Community** |
| You need multiple users with role-based access | **Cloud** |
| You want SSO / MFA / SAML | **Cloud** |
| You want someone else to run it | **Cloud** |
| You want to keep your data on your own infra | **Community** |
| You build for a customer who'll self-host | **Community** |

If you start on Community and outgrow it, the **[Backup / Export](/admin/backup/)** ZIP gives you a portable JSON dump of every table you can hand to Cloud (or any future self-hosted replica) on import.

## Plugins

Both editions will support the **plugin marketplace** (currently 📋 — see [Plugins](/plugins/marketplace/)). Plugins ship as signed packages and extend providers, guardrails, alert sinks, and OAuth flows.

---

Next: **[Projects](/features/projects/)** — the top-level container.

---

> © Akyros Labs LLC. All rights reserved.
