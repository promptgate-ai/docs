---
title: "Webhooks"
description: "Webhooks send events to your own URL as they happen: a budget running out, a provider failing, an MCP server going down, a key created or revoked. Use them for…"
---

<!-- Generated from docs/webhooks.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

Webhooks send [events](/events/) to your own URL as they happen: a
budget running out, a provider failing, an MCP server going down, a key
created or revoked. Use them for a chat channel, a pager, a ticket or a
SIEM. Deliveries are signed per the
[Standard Webhooks](https://www.standardwebhooks.com) specification, so
any of its libraries can verify them.

```yaml
webhooks:
  ops-alerts:
    url: https://hooks.example.com/promptgate
    secret: ${PROMPTGATE_WEBHOOK_SECRET}     # whsec_… or 24+ bytes
    events: [budget.*, provider.failing, mcp.server_down]
  siem:
    url: https://siem.internal.example/ingest
    secret: ${SIEM_WEBHOOK_SECRET}
    events: ["*"]
    headers: { Authorization: "Bearer ${SIEM_TOKEN}" }
    private: true                          # the receiver is on a private network
```

| field | default | |
|---|---|---|
| `url` | — | absolute `http` or `https` URL; no credentials in it (use `headers`) |
| `secret` | — | signing secret: `whsec_` followed by base64 (as Standard Webhooks libraries generate it), or any string of at least 24 bytes. `openssl rand -base64 32` makes one. Never logged or shown. |
| `events` | — | event types, prefixes such as `budget.*`, or `*`; see `promptgate events`. A pattern that matches no event is refused at load. |
| `headers` | — | sent with every delivery, e.g. the receiver's own token; values may use `${ENV}`. Never logged or shown. |
| `timeout` | `10s` | for one attempt, `1s` to `1m` |
| `private` | `false` | allow a receiver on a private, loopback or link-local address |
| `disabled` | `false` | keep the entry but queue nothing for it |

Names are lowercase letters, digits and `-`. Changes apply on reload,
without a restart.

## What a receiver gets

Every delivery is a `POST` with the event as its JSON body (see
[payload](/events/#payload)) and these headers:

| header | |
|---|---|
| `webhook-id` | the event's id (`evt_…`); the same on every retry, so a receiver can drop duplicates |
| `webhook-timestamp` | Unix seconds when this attempt was signed |
| `webhook-signature` | `v1,` and base64 of HMAC-SHA256 over `<id>.<timestamp>.<body>` |
| `content-type` | `application/json` |
| `user-agent` | `PromptGate-Webhooks/<version>` |

A `2xx` answer counts as delivered. Anything else, a timeout or a
connection error is a failure.

## Verifying the signature

Check the signature over the raw body, before you parse it, and reject
timestamps more than five minutes away from your clock, so a recorded
delivery can't be replayed later. Compare in constant time.

With a Standard Webhooks library (JavaScript, Python, Go, Ruby, PHP,
Java, C#, Rust, Elixir):

```python
from standardwebhooks.webhooks import Webhook

wh = Webhook(secret)               # the same whsec_… string
event = wh.verify(raw_body, headers)   # raises on a bad signature or an old timestamp
```

The libraries expect a `whsec_` secret. With a plain secret, give them
`whsec_` followed by the base64 of it.

Without a library, in Python:

```python
import base64, hashlib, hmac, time

def verify(secret: str, headers, body: bytes) -> bool:
    key = base64.b64decode(secret[6:]) if secret.startswith("whsec_") else secret.encode()
    msg_id, ts = headers["webhook-id"], headers["webhook-timestamp"]
    if abs(time.time() - int(ts)) > 300:
        return False
    mac = hmac.new(key, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()
    expected = "v1," + base64.b64encode(mac).decode()
    return any(hmac.compare_digest(expected, s) for s in headers["webhook-signature"].split())
```

In Node.js:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, headers, rawBody) {
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret);
  const id = headers["webhook-id"], ts = headers["webhook-timestamp"];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const mac = createHmac("sha256", key).update(`${id}.${ts}.`).update(rawBody).digest("base64");
  const expected = Buffer.from(`v1,${mac}`);
  return headers["webhook-signature"].split(" ").some(
    (s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), expected));
}
```

In Go, with the standard library only:

```go
func verify(secret string, h http.Header, body []byte) bool {
	key := []byte(secret)
	if s, ok := strings.CutPrefix(secret, "whsec_"); ok {
		key, _ = base64.StdEncoding.DecodeString(s)
	}
	id, ts := h.Get("webhook-id"), h.Get("webhook-timestamp")
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil || time.Since(time.Unix(sec, 0)).Abs() > 5*time.Minute {
		return false
	}
	mac := hmac.New(sha256.New, key)
	fmt.Fprintf(mac, "%s.%s.", id, ts)
	mac.Write(body)
	want := []byte("v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil)))
	for _, sig := range strings.Fields(h.Get("webhook-signature")) {
		if hmac.Equal([]byte(sig), want) {
			return true
		}
	}
	return false
}
```

The signature header may hold several signatures separated by spaces
(the specification allows that during a secret rotation); accept the
delivery when one of them matches.

## Delivery

- **Durable.** Every event a webhook wants is written to a queue in the
  request log before it is sent, so deliveries survive a restart. The
  gateway (`promptgate start`) sends them. With `logging.store: off`
  there is no queue and no webhooks.
- **In order, per webhook.** A webhook gets its next event only after
  the one before was delivered or given up. One slow receiver doesn't
  hold up the others.
- **Retries.** After a failure the next attempt follows after 30 s,
  2 min, 10 min, 30 min, 1 h, 3 h, 6 h, 12 h and 24 h, each ±10 %. After
  10 attempts, about two days, the delivery is given up. A receiver
  that is offline for a day still gets every event once it is back.
- **At least once.** A receiver may see an event twice, for example when
  its `2xx` was lost on the way back. Drop duplicates by `webhook-id`.
- **`410 Gone`** gives the delivery up at once.
- **Redirects** are not followed. A `3xx` is a failure; point `url` at
  the final address.
- **SSRF check.** Like the [API Gateway](/api-gateway/#ssrf-protection),
  deliveries are refused for private, loopback and link-local addresses
  at connection time, unless the webhook has `private: true` or the
  address is in `security.ssrf.allow`.
- **Limits.** At most 10,000 deliveries wait per webhook. Beyond that,
  new events for it are dropped and the gateway logs a warning, so a
  receiver that is gone for long can't fill the disk. Finished
  deliveries are kept for 30 days, with the status and the first 2 KB
  of the receiver's answer. Deliveries of a webhook that is removed or
  disabled are given up within the hour.

Events from every process reach the webhooks: a `promptgate keys
create` on the command line is written to the [audit trail](/audit/),
and the running gateway picks it up within a second and delivers it.

## Inspecting and testing

```bash
promptgate webhooks list                       # state, waiting, delivered and given up in 24 h
promptgate webhooks test ops-alerts            # send a signed webhook.test now, show the answer
promptgate webhooks deliveries ops-alerts --state failed
promptgate webhooks deliveries --id 1842       # the event and the receiver's answer
promptgate webhooks redeliver --failed ops-alerts   # or: redeliver 1842 1843
```

- `list` shows a webhook as **failing** while its oldest waiting
  delivery has failed attempts — with when it was queued and the last
  error — and as **idle** before its first delivery.
- `test` sends a `webhook.test` event directly, signed and with the
  webhook's headers, timeout and SSRF check, whatever events the
  webhook takes. It doesn't enter the queue; exit code 1 unless the
  receiver answers `2xx`. Use it after changing a URL, secret or header.
- `redeliver` puts finished deliveries back into the queue with their
  attempts reset: by id, or every delivery a webhook gave up. They go
  out before the webhook's newer events; the running gateway picks
  them up within seconds. Each call is recorded in the
  [audit trail](/audit/) as `webhook.redelivered`.
- [Metrics](/metrics/): `promptgate_webhook_deliveries_total{webhook,result}`
  and `promptgate_webhook_pending{webhook}` — alert on a queue that
  keeps growing.

A receiver on your own machine needs `private: true`:

```yaml
webhooks:
  local:
    url: http://127.0.0.1:9000/hook
    secret: test-secret-of-at-least-24-bytes
    events: ["*"]
    private: true
```

`promptgate keys create test` then sends a `key.created` event.
