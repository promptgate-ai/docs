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

Starlight reads `.md` / `.mdx` files from `src/content/docs/`. Each file
is exposed as a route based on its file name. Sidebar navigation is
declared in [`astro.config.mjs`](./astro.config.mjs) under the
`starlight.sidebar` key.

## Build & preview

```bash
npm run build        # writes dist/ — 75 pages + Pagefind search index
npm run preview      # serve the production build locally
```

## Project structure

```
src/
├── content/docs/        Markdown / MDX content per route
├── assets/              Images embedded in Markdown
├── components/Footer.astro   Custom footer (brand-aligned)
└── styles/custom.css    Brand overrides on top of Starlight defaults
public/                  Static assets (favicon, og-images)
astro.config.mjs         Starlight + sidebar configuration
```

## Deployment

Pushes to `main` automatically build and deploy to Cloudflare Pages
(`docs.promptgate.dev`) via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

The build pins to Node 22 + Astro 6.3.x. Pagefind builds the local
search index at the end of `npm run build` — no third-party search
service, no API key, no telemetry.

## Contributing

Issues and pull requests are welcome. Doc files live under
`src/content/docs/` — find the page you want to change there and open
a PR.

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
