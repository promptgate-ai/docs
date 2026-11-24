# PromptGate Documentation

Source for [docs.promptgate.dev](https://docs.promptgate.dev) — install
guides, provider configuration, routing rules, agent-proxy mode, MCP
bridge, security hardening, and the full API reference for
[PromptGate](https://github.com/promptgate-ai/promptgate), the
self-hosted AI gateway.

Built with [Astro Starlight](https://starlight.astro.build) — same Astro
version line as the [marketing site](https://github.com/promptgate-ai/website),
so components and design tokens stay in sync.

## Local development

```bash
npm install
npm run dev          # http://localhost:4321
```

The pages are not written here. They come from the Markdown in the
PromptGate repository (`docs/`, `CHANGELOG.md`, `docs/changelog/`) and
from the pgfuzz README, copied by
[`scripts/sync-docs.mjs`](scripts/sync-docs.mjs):

```bash
npm run sync         # reads ../go-source and ../pgfuzz, or pass both paths
```

The script rewrites links between docs to site routes, takes each
page's title and description from its first heading and paragraph,
and writes the sidebar to `src/sidebar.json`. A doc missing from its
sidebar groups fails the sync. The output is committed, because the
PromptGate repository is private and CI here can't read it. Only the
landing page (`src/content/docs/index.mdx`) is edited here.

## Build & preview

```bash
npm run build        # writes dist/ — about 45 pages + Pagefind search index
npm run preview      # serve the production build locally
```

## Project structure

```
src/
├── content/docs/        generated pages (see above) + index.mdx
├── sidebar.json         generated sidebar
├── assets/              Images embedded in Markdown
├── components/Footer.astro   Custom footer (brand-aligned)
└── styles/custom.css    Brand overrides on top of Starlight defaults
public/                  Static assets (favicon, og-images)
scripts/sync-docs.mjs    copies the docs from the PromptGate repository
astro.config.mjs         Starlight configuration
```

## Deployment

A tag push (`v*`) builds and deploys to Cloudflare Pages
(`docs.promptgate.dev`) via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml);
pushes to `main` only run CI.

The build runs on Node 22 with Astro 7. Pagefind builds the local
search index at the end of `npm run build` — no third-party search
service, no API key, no telemetry.

## Contributing

Issues are welcome. The pages are generated, so a fix lands in the
PromptGate docs and reaches this site with the next sync.

For substantive changes (new sections, restructured navigation), open
an issue first so we can talk through the shape.

## License

Same Business Source License 1.1 as the gateway itself — see
[LICENSE](./LICENSE). Documentation is part of the Licensed Work; this
keeps the docs and the code under matching terms so nobody can fork
the docs into a competing managed service while leaving the code
behind.

After 4 years from publication of each version, that version's
documentation automatically converts to Apache License, Version 2.0.

(c) 2026 Akyros Labs LLC
