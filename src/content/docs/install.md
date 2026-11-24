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
`~/.local/bin`. Options: `PROMPTGATE_VERSION=v0.1.0`,
`PROMPTGATE_INSTALL_DIR=/opt/bin`.

## Windows (PowerShell)

```powershell
irm https://install.promptgate.dev/install.ps1 | iex
```

Installs to `%LOCALAPPDATA%\Programs\promptgate` and adds it to your user PATH.

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

Without a config, `start` in a terminal offers to set PromptGate up. It
asks six questions, and Enter takes the suggestion each time:

1. **Provider**: where requests go by default. Providers whose key is in
   the environment are marked.
2. **API key**: from the environment, or pasted (stored in the config,
   readable only by you).
3. **Protection**: ready-made [guardrails](/guardrails/#ready-made-protection),
   `recommended` by default.
4. **Access key**: a first `pg_` key for your apps, with a daily budget
   ($20 suggested). Requests with your own provider key or a Claude or
   ChatGPT subscription don't count against it.
5. **Coding agents**: Claude Code and Codex, when found, are sent through
   PromptGate by setting the base URL in their own config (see
   [`promptgate connect`](/cli/)). The file is copied to
   `<file>.before-promptgate` first.
6. **Background service**: start PromptGate at login and keep it running.
   Suggested when an agent was connected, because the agent can't reach
   its model while PromptGate is stopped.

Then PromptGate runs: in the background, or in the terminal. `promptgate
setup` asks the same questions again later; `setup --yes` asks nothing
(flags `--protection`, `--budget`, `--connect claude-code,codex`,
`--service`).

Started without a config and without a terminal (a container, a
service), PromptGate runs on built-in defaults with the recommended
guardrails.

## Run it as a service

```bash
promptgate install    # LaunchAgent / systemd --user / Windows service
promptgate service status
promptgate uninstall  # offers to send connected agents directly again
```

## Updates and verification

`promptgate update` installs the newest release only if the Ed25519
signature over `checksums.txt` verifies against the key compiled into your
binary **and** the download matches its checksum. Homebrew installs update
with `brew upgrade promptgate`.
