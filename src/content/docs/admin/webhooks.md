---
title: Webhooks
description: HMAC-SHA256-signed outbound notifications for ~23 audit events.
---

A **webhook** posts a JSON event to a URL you configure whenever a matching audit event fires. PromptGate signs every payload with HMAC-SHA256 so receivers can verify authenticity.

Use webhooks for:

- Pushing audit events to a SIEM.
- Triggering Slack notifications on token revocations or refresh failures.
- Wiring PromptGate into your existing incident pipeline.

## Where they live

Webhooks are **per-project**. Project sidebar → **Webhooks**.

![Webhooks list — placeholder](#)

## Creating a webhook

| Field | Notes |
|---|---|
| **Name** | Human-readable identifier. |
| **URL** | Where PromptGate POSTs the payload. |
| **Events** | Multi-select of subscribable events. |
| **Active** | Inactive webhooks don't fire. |

The **secret** is shown **once** at create:

```
Secret: whsec_a1b2c3d4...
```

This is what you use to verify the HMAC signature on incoming payloads. Like API tokens, it's hashed/stored and not retrievable later — copy it now.

## Subscribing to events

The full list of event keys is in **[Audit Log](/security/audit-log/)**. A non-exhaustive subset of webhook-friendly events:

- `auth.login_failed`
- `credential.created` / `.deactivated` / `.deleted`
- `token.created` / `.rotated` / `.revoked` / `.deleted`
- `endpoint.created` / `.updated` / `.deactivated`
- `oauth_connection.connected` / `.disconnected` / `.refresh_failed`
- `provider.disabled`
- `guardrail.blocked`
- `backup.exported`

The webhook fires **once per matching audit event**.

## Payload shape

```http
POST https://your-receiver.com/webhook
Content-Type: application/json
X-PromptGate-Event: token.revoked
X-PromptGate-Signature: sha256=abc123...
X-PromptGate-Timestamp: 1715000000

{
  "event": "token.revoked",
  "severity": "warn",
  "actor": "admin@promptgate.dev",
  "project": {"id": 7, "name": "Quickstart", "uuid": "..."},
  "target": "Mobile App Prod",
  "metadata": { "token_id": 42 },
  "ip_address": "10.0.0.42",
  "occurred_at": "2026-05-06T10:14:22Z"
}
```

## HMAC verification

Verify the `X-PromptGate-Signature` header to confirm authenticity:

```python
import hmac, hashlib

def verify(body_bytes: bytes, signature_header: str, secret: str) -> bool:
    sent = signature_header.removeprefix("sha256=")
    expected = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sent, expected)
```

```js
import { createHmac, timingSafeEqual } from 'crypto';

function verify(rawBody, signatureHeader, secret) {
    const sent = signatureHeader.replace(/^sha256=/, '');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return timingSafeEqual(Buffer.from(sent, 'hex'), Buffer.from(expected, 'hex'));
}
```

The body is signed **as-is** (raw bytes). Don't re-stringify before verifying — JSON serialisation differences produce different signatures.

The `X-PromptGate-Timestamp` lets you reject replays (e.g. anything older than 5 minutes).

## Test button

The webhook detail page has a **Send test** button — fires a synthetic `webhook.test` event with a dummy payload. Use it to verify your receiver is wired correctly before going live.

## Delivery log

Each delivery attempt is recorded in `webhook_deliveries`:

- HTTP status of the receiver
- Timestamp
- Request body sent
- Response body received

Visible on the webhook's detail page. Useful for debugging "why didn't I get the notification?" — usually you find a 4xx from your receiver.

## Retries

Currently **no automatic retries**. A failed delivery (timeout, non-2xx) is logged and that's it.

Retries with exponential backoff are on the roadmap. Until then, your receiver should be defensively idempotent and you should monitor the delivery log for failures.

## Failure modes

| Situation | What happens |
|---|---|
| Receiver returns 2xx | Delivery marked `success=true` |
| Receiver returns non-2xx | `success=false`, response logged |
| Receiver times out (default 10s) | `success=false`, error logged |
| Receiver unreachable | `success=false` |

## Rate

Webhooks fire from `audit_logs` insertion. If your gateway emits 1000 audit events per hour, your receiver gets up to 1000 webhooks per hour (one per matching subscription). Plan accordingly.

---

Next: **[Backup / Export](/admin/backup/)**.

---

> © Akyros Labs LLC. All rights reserved.
