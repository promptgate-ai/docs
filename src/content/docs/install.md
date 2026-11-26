---
title: "Installing PromptGate"
description: "PromptGate is one static binary for Linux, macOS and Windows (amd64 and arm64). Pick any of these:"
---

<!-- Generated from docs/install.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

PromptGate is one static binary for Linux, macOS and Windows (amd64 and
arm64). Pick any of these:

## Install script (Linux, macOS)

```bash
curl -fsSL https://install.promptgate.dev/install.sh | sh
```

Downloads the binary for your platform, verifies its SHA-256 against
`checksums.txt` and installs it to `/usr/local/bin` (if writable) or
`~/.local/bin`. When that directory isn't on your PATH yet, the script
adds it to your shell's profile — `~/.zshrc`, `~/.bashrc`
(`~/.bash_profile` on macOS), fish's `conf.d`, or `~/.profile` — once,
and tells you how to use it in the open terminal.

| variable | |
|---|---|
| `PROMPTGATE_VERSION` | a tag such as `v0.8.1`; default: the latest, read from `version.json` |
| `PROMPTGATE_INSTALL_DIR` | another directory, e.g. `/opt/bin` |
| `PROMPTGATE_NO_MODIFY_PATH` | leave shell profiles alone |
| `NO_COLOR` | plain output |

## Windows (PowerShell)

```powershell
irm https://install.promptgate.dev/install.ps1 | iex
```

Installs to `%LOCALAPPDATA%\Programs\promptgate` and adds it to your user
PATH, and to the PATH of the open PowerShell, so `promptgate` works at once.
`PROMPTGATE_VERSION` and `PROMPTGATE_INSTALL_DIR` work as above.

## Homebrew

```bash
brew install promptgate-ai/tap/promptgate
```

## Docker

```bash
docker run -p 7878:7878 -p 127.0.0.1:7879:7879 -v promptgate:/data \
  -e OPENAI_API_KEY ghcr.io/promptgate-ai/promptgate
```

Mount a config at `/config/promptgate/promptgate.yaml` and a volume at
`/data` for the request log and the [web UI](/ui/)'s users. The UI
listens on 7879; its first admin password is in `docker logs` and in
`/data/ui-initial-password`. Publish 7879 only where you need it (here:
the host's localhost). The image is distroless and runs as a non-root
user.

## Linux packages

`.deb`, `.rpm` and `.apk` packages are attached to every release.

## Direct download

Every release lives at `https://install.promptgate.dev/<tag>/` and the
newest at `https://install.promptgate.dev/latest/`:
`promptgate-<os>-<arch>` (`.exe` on Windows), `checksums.txt` and
`checksums.txt.sig`. `https://install.promptgate.dev/version.json` lists
all URLs.

## First start

```bash
promptgate start
```

Without a config, `start` in a terminal asks three things and runs. Enter
takes the suggestion; the arrow keys move, Space ticks:

1. **Guardrails**: a ready-made level ([protection](/guardrails/#ready-made-protection)),
   `recommended` by default — or **choose …** to tick `secrets`, `pii`,
   `prompt_injection`, `token_saver` and `attachments` one by one.
2. **Web UI**: off unless you turn it on. Later: `promptgate start --ui
   127.0.0.1:7879` or `ui.enabled: true`.
3. **Background**: no by default — PromptGate runs in this terminal
   until Ctrl-C. Yes installs it as a service (as `promptgate install`
   does, with the variables the config uses): it starts at login, keeps
   running without the terminal, and the overview below says "runs in
   the background". `promptgate pause` takes it out of the way.

Passing requests through needs nothing else: apps send their own
provider key, and the model name picks the provider (`openai:gpt-5`,
`anthropic:claude-…`, `groq:…`; without a prefix the default provider).
Then the screen clears and PromptGate shows where to point your apps:

```
PromptGate runs on http://127.0.0.1:7878

Point your apps here:
  OpenAI SDKs, Codex           OPENAI_BASE_URL=http://127.0.0.1:7878/v1
  Anthropic SDKs, Claude Code  ANTHROPIC_BASE_URL=http://127.0.0.1:7878

  guardrails        pii: redact · prompt_injection · secrets: mask · token_saver
  keys              none — apps send their own provider key (auth auto)
  web UI            off — promptgate start --ui 127.0.0.1:7879, or ui.enabled in the config
```

`pg_` keys for your apps with a daily budget, sending Claude Code and
Codex through PromptGate come with `promptgate setup` — six questions,
the background service among them — or one at a time: `promptgate keys
create`, `promptgate connect claude-code`. `setup
--yes` asks nothing (flags `--protection`, `--budget`, `--connect
claude-code,codex`, `--service`).

Started without a config and without a terminal (a container, a
service), PromptGate runs on built-in defaults with the recommended
guardrails.

## Run it as a service

```bash
promptgate install    # LaunchAgent / systemd --user / Windows service
promptgate service status
promptgate uninstall  # offers to send connected agents directly again
```

Opened in a browser, the gateway's own address (`http://127.0.0.1:7878`)
shows that PromptGate runs, links to the web UI and lists the base URLs
for SDKs and agents; API clients get JSON there as before.

## Pause and resume

```bash
promptgate pause      # agents go directly to their providers, the service stops
promptgate resume     # the service starts, the agents go through PromptGate again
```

`pause` sends every connected coding agent directly to its provider
first, so none is left pointing at a stopped gateway, then stops the
service. `resume` starts it, waits until the gateway answers, and only
then routes the agents `pause` disconnected through it again. Config,
keys and the request log stay untouched.

## Updates and verification

`promptgate update` installs the newest release only if the Ed25519
signature over `checksums.txt` verifies against the key compiled into your
binary **and** the download matches its checksum. Homebrew installs update
with `brew upgrade promptgate`.
