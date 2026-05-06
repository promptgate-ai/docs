---
title: SSRF Protection
description: API Gateway upstream URLs are validated at create time AND at proxy time to block private / loopback / cloud-metadata destinations.
---

API Gateway endpoints proxy to a configured upstream URL — and without a guard, anyone with project access could point an endpoint at `http://localhost/` or the cloud metadata service (`169.254.169.254`) and exfiltrate things they shouldn't reach. **SSRF Protection** is the layer that blocks that.

## What it blocks

The validator rejects any URL that resolves to:

| Range | Description |
|---|---|
| `127.0.0.0/8` | Loopback (IPv4) |
| `::1` | Loopback (IPv6) |
| `0.0.0.0` | Unspecified |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | RFC1918 private |
| `169.254.0.0/16` | Link-local (covers AWS / GCP / Azure cloud metadata at 169.254.169.254) |
| `100.64.0.0/10` | CG-NAT shared address space |
| `fe80::/10` | IPv6 link-local |
| `fc00::/7` | IPv6 unique-local |

It also rejects schemes other than `http` / `https` (no `file://`, `gopher://`, `ssh://`, etc.).

## When the validation runs

Two passes:

1. **At endpoint create / update** — friendly form-validation error: "Upstream URL blocked by SSRF guard."
2. **At proxy time** — every forwarded request re-validates. Defends against **DNS rebinding**: an attacker registers a hostname that resolves publicly when you save the endpoint but flips to `127.0.0.1` later. Without proxy-time validation, this slips through.

## How it resolves hostnames

The validator inspects the URL's host:

- **Literal IP**: validated directly with `filter_var(..., FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)`.
- **Hostname**: resolved with `dns_get_record(host, DNS_A | DNS_AAAA)` to all A and AAAA records, then **every** resolved IP is validated. If even one IP is in a blocked range, the URL is rejected.

So a hostname with mixed public + private DNS records (round-robin) gets blocked because of the private record.

## Behaviour

```
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "ok": false,
  "error": "Upstream URL blocked by SSRF guard.",
  "detail": "Upstream host 'internal-api.svc.local' resolves to a non-public address (10.0.5.2); refusing to proxy."
}
```

A `gateway_logs` row is also written with `error_message = "ssrf_blocked: ..."`.

## Override: `SSRF_ALLOWED_HOSTS`

Set the env var to a comma-separated list of hosts (or IPs) you want to permit despite their private/loopback nature:

```bash
SSRF_ALLOWED_HOSTS=internal-api.svc.local,10.0.0.42,api.tools.local
```

A host on the allowlist is **not resolved** at all — the validator short-circuits and accepts. Useful when:

- You're running a docker-compose stack and your upstream is `http://api:8080` on the bridge network.
- You have an internal service at a stable RFC1918 address.

### Wildcard `*` — disable entirely

```bash
SSRF_ALLOWED_HOSTS=*
```

Skips SSRF validation completely. **Used by the test suite** (which talks to synthetic `.test` hostnames that don't resolve), and for development. **Don't ship this to production** — it's the equivalent of disabling the guard.

## Unresolvable hosts

If a hostname has no A or AAAA records (typo, expired domain, internal DNS not configured), `dns_get_record` returns empty. Per the validator, an empty result is treated as "cannot validate" → **rejected**:

```json
{
  "error": "Cannot resolve upstream host: 'this-does-not-exist.example.'."
}
```

This is a deliberate fail-closed: better to reject a typo at create time than to forward to whatever resolves later.

## Performance

`dns_get_record` is a network call — typically a few ms with a warm resolver. Cached by your OS / glibc / Docker DNS. The validator runs once per request, in addition to the DNS lookup the upstream HTTP call would do anyway, so the marginal cost is one extra DNS query.

If that's too much, use `SSRF_ALLOWED_HOSTS` to skip the lookup for known-good hosts.

## Combining with other defences

SSRF is one defence in depth — combine with:

- **Network segmentation** — run PromptGate without route to internal subnets you don't want exposed.
- **Egress firewall** — allowlist provider hostnames and known upstream domains; deny by default.
- **OAuth Service Connections** — the proxy's `Authorization` header comes from a connection, not the client; clients can't send their own upstream auth.

## Behaviour reference

| Input | Result |
|---|---|
| `https://api.openai.com/v1/chat/completions` | ✅ allowed |
| `http://1.1.1.1/` | ✅ allowed (public IP) |
| `http://127.0.0.1/` | ❌ blocked |
| `http://[::1]/` | ❌ blocked |
| `http://10.0.0.42/` | ❌ blocked |
| `http://169.254.169.254/latest/meta-data/` | ❌ blocked (cloud metadata) |
| `file:///etc/passwd` | ❌ blocked (scheme) |
| `gopher://localhost` | ❌ blocked (scheme) |
| `http://internal.svc.local/` (in allowlist) | ✅ allowed |
| `http://this-host-does-not-exist.invalid/` | ❌ blocked (unresolvable) |
| Anything (with `SSRF_ALLOWED_HOSTS=*`) | ✅ allowed |

---

Next: **[OAuth Connections](/security/oauth-connections/)**.

---

> © Akyros Labs LLC. All rights reserved.
