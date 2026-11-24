// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sidebar from './src/sidebar.json' with { type: 'json' };

export default defineConfig({
	site: 'https://docs.promptgate.dev',
	integrations: [
		starlight({
			title: 'PromptGate',
			description: 'PromptGate — the self-hosted AI gateway as a single binary. Documentation.',
			lastUpdated: true,
			logo: {
				src: './src/assets/logo-icon.png',
				alt: 'PromptGate',
				// Title text stays alongside the icon — same pattern as the
				// marketing site header.
				replacesTitle: false,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/promptgate-ai/docs' },
			],
			customCss: ['./src/styles/custom.css'],
			components: {
				Footer: './src/components/Footer.astro',
				PageTitle: './src/components/PageTitle.astro',
				Hero: './src/components/Hero.astro',
			},
			head: [
				{ tag: 'meta', attrs: { name: 'copyright', content: '© Akyros Labs LLC. All rights reserved.' } },
				// Favicons
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' } },
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
				{ tag: 'link', attrs: { rel: 'shortcut icon', href: '/favicon.ico' } },
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
				{ tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'PromptGate' } },
				{ tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
				// Social preview (OG + Twitter Card) — applies as default to every page;
				// Starlight pages can still override per-page via frontmatter `image`.
				{ tag: 'meta', attrs: { property: 'og:image', content: 'https://docs.promptgate.dev/og-default.png' } },
				{ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
				{ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
				{ tag: 'meta', attrs: { property: 'og:image:alt', content: 'PromptGate — the self-hosted AI gateway' } },
				{ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
				{ tag: 'meta', attrs: { name: 'twitter:image', content: 'https://docs.promptgate.dev/og-default.png' } },
			],
			// Written by scripts/sync-docs.mjs from the PromptGate docs.
			sidebar,
		}),
	],
});
