---
title: Management API
description: REST surface for provisioning tokens and endpoints from your own backend. Bearer auth, scope-gated, kill-switched.
---

The Management API is what your application calls to **provision a PromptGate project for an end-user** without anyone clicking around in the UI. Same project, two distinct write surfaces:

| Surface | Scope | Methods |
|---|---|---|
| Tokens | `tokens:write` | `POST` create · `POST .../rotate` · `DELETE` revoke |
| Endpoints | `endpoints:write` | `POST` create · `PUT` update · `PATCH .../deactivate` · `PATCH .../activate` |

Both are gated by the same kill-switch (**`Settings → Management API → Management REST API`**, default OFF) and the same throttle (30 req/min per bootstrap token).

For the conceptual overview see **[Management API (feature)](/features/management-api/)**.

## All examples assume

```bash
PG_URL=https://gateway.your-domain.com
PG_UUID=<project UUID>                       # from the project switcher in the UI
PG_BOOTSTRAP=pg_live_<your-bootstrap-token>  # token with tokens:write + endpoints:write
```

## Tokens

### Create

```bash
curl -X POST $PG_URL/api/$PG_UUID/admin/tokens \
  -H "Authorization: Bearer $PG_BOOTSTRAP" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-1842 prod token",
    "env": "live",
    "scopes": ["chat"],
    "subject_id": "user_1842",
    "monthly_budget_usd_cap": 5.00
  }'
```

```json
201 Created
{
  "ok": true,
  "data": {
    "token": "pg_live_<plaintext-shown-once>",
    "uuid": "1f4d…",
    "name": "user-1842 prod token",
    "env": "live",
    "scopes": ["chat"],
    "monthly_budget_usd_cap": 5.0,
    "created_at": "2026-05-19T10:00:00+00:00",
    "note": "Store this token now. It is shown only once."
  }
}
```

Fields:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Human label, shown in the Tokens list |
| `env` | no | `live` or `test`, default `live` |
| `scopes` | no | Defaults to the project type's runtime scopes. Caller can only mint **management** scopes it owns |
| `subject_id` | no | Free-form, audit-only — typically your downstream user ID |
| `endpoint_ids` | no | Allowlist of endpoint IDs this token can call; `null` = all |
| `rate_limit_per_minute` | no | Token-level RPM override |
| `rate_limit_per_hour` | no | Token-level RPH override |
| `monthly_budget_usd_cap` | no | Pre-flight enforced on every request — see [Budgets](/security/budgets/) |
| `metadata` | no | Operator-defined JSON, returned by `GET /tokens` |

### Rotate

```bash
curl -X POST $PG_URL/api/$PG_UUID/admin/tokens/$TOKEN_UUID/rotate \
  -H "Authorization: Bearer $PG_BOOTSTRAP"
```

Mints a new plaintext, invalidates the old hash. Use this on suspected leak or as part of regular rotation.

### Revoke

```bash
curl -X DELETE $PG_URL/api/$PG_UUID/admin/tokens/$TOKEN_UUID \
  -H "Authorization: Bearer $PG_BOOTSTRAP"
```

Marks the token inactive. A token cannot revoke itself.

## Endpoints

### Create

```bash
curl -X POST $PG_URL/api/$PG_UUID/admin/endpoints \
  -H "Authorization: Bearer $PG_BOOTSTRAP" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summarise",
    "provider_model": "gpt-4o-mini",
    "credential_id": 7,
    "temperature": 0.2,
    "max_output_tokens": 500,
    "prompt": "You are a concise summariser.",
    "user_prompt_template": "Summarise: {{input}}",
    "monthly_budget_usd": 10.00,
    "estimated_cost_per_1k_tokens_usd": 0.002,
    "usage_hard_limit_tokens": 8000
  }'
```

```json
201 Created
{
  "ok": true,
  "data": {
    "uuid": "ep-1f4d…",
    "slug": "summarise",
    "name": "Summarise",
    "is_active": true,
    "provider_model": "gpt-4o-mini",
    "credential_id": 7,
    "temperature": 0.2,
    "max_output_tokens": 500,
    "monthly_budget_usd": 10.0,
    "estimated_cost_per_1k_tokens_usd": 0.002,
    "usage_hard_limit_tokens": 8000,
    "prompt": "You are a concise summariser.",
    "user_prompt_template": "Summarise: {{input}}",
    "created_at": "2026-05-19T10:00:00+00:00"
  }
}
```

Required: `name` plus **either** `provider_template_id` **or** the pair `provider_model + credential_id`. Everything else is optional with the same defaults as the web wizard.

JSON-native fields (send as real arrays / objects, not strings):

| Field | Shape |
|---|---|
| `input_schema` / `output_schema` | JSON Schema object |
| `variables` | `[{name, type, required, max_length, …}]` |
| `failover` | `[{credential_id, provider_model}, …]` |

### Update

```bash
curl -X PUT $PG_URL/api/$PG_UUID/admin/endpoints/$ENDPOINT_UUID \
  -H "Authorization: Bearer $PG_BOOTSTRAP" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summarise",
    "provider_model": "gpt-4o",
    "credential_id": 7,
    "temperature": 0.4,
    "max_output_tokens": 1000,
    "prompt": "You are a concise summariser.",
    "user_prompt_template": "Summarise: {{input}}"
  }'
```

**Full PUT** — every field the service writes is overwritten. Pass the complete intended state. A new `endpoint_version` snapshot is recorded so the change is restorable from the UI.

### Deactivate / activate

```bash
curl -X PATCH $PG_URL/api/$PG_UUID/admin/endpoints/$ENDPOINT_UUID/deactivate \
  -H "Authorization: Bearer $PG_BOOTSTRAP"

curl -X PATCH $PG_URL/api/$PG_UUID/admin/endpoints/$ENDPOINT_UUID/activate \
  -H "Authorization: Bearer $PG_BOOTSTRAP"
```

Deactivated endpoints return 404 to gateway traffic; config, logs, and versions are preserved.

## Errors

| Status | Cause |
|---|---|
| 401 | Missing / invalid bearer token |
| 403 | Token has wrong scope, doesn't belong to the project, or the Management API toggle is off |
| 404 | Project / token / endpoint not found |
| 422 | Validation error — response body lists `errors` per field |
| 429 | Throttle: 30 req/min per bootstrap token |

See **[Errors](/api/errors/)** for the canonical error envelope.

## Quickstart: provision a tenant

A typical end-to-end provisioning flow from your backend:

```bash
# 1. Create the endpoint (one-time, or per-tenant if they get their own config)
EP=$(curl -s -X POST $PG_URL/api/$PG_UUID/admin/endpoints \
  -H "Authorization: Bearer $PG_BOOTSTRAP" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tenant chat",
    "provider_model": "gpt-4o-mini",
    "credential_id": 7,
    "temperature": 0.7,
    "max_output_tokens": 1000
  }' | jq -r '.data.uuid')

# 2. Mint a token scoped to that tenant
TK=$(curl -s -X POST $PG_URL/api/$PG_UUID/admin/tokens \
  -H "Authorization: Bearer $PG_BOOTSTRAP" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"acme-corp\",
    \"subject_id\": \"tenant_42\",
    \"scopes\": [\"chat\"],
    \"monthly_budget_usd_cap\": 25.00
  }" | jq -r '.data.token')

# 3. Hand the token to the tenant's app (server-side! never to a browser)
echo "Tenant uses: $TK"
```

When the tenant cancels:

```bash
curl -X DELETE $PG_URL/api/$PG_UUID/admin/tokens/$TENANT_TOKEN_UUID \
  -H "Authorization: Bearer $PG_BOOTSTRAP"
```

Their token is revoked instantly — any in-flight requests get 401 on the next call.

---

> © Akyros Labs LLC. All rights reserved.
