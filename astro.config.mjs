// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'PromptGate',
			description: 'AI Gateway Platform — Documentation',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/promptgate-dev/promptgate' },
			],
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
						{ label: 'Configuration', slug: 'getting-started/configuration' },
					],
				},
				{
					label: 'Features',
					items: [
						{ label: 'Projects', slug: 'features/projects' },
						{ label: 'Credentials', slug: 'features/credentials' },
						{ label: 'Provider Templates', slug: 'features/provider-templates' },
						{ label: 'AI Endpoints', slug: 'features/ai-endpoints' },
						{ label: 'AI Wrapper', slug: 'features/ai-wrapper' },
						{ label: 'API Gateway', slug: 'features/api-gateway' },
						{ label: 'MCP Bridge', slug: 'features/mcp-bridge' },
					],
				},
				{
					label: 'Security',
					items: [
						{ label: 'Authentication', slug: 'security/authentication' },
						{ label: 'Client Tokens', slug: 'security/client-tokens' },
						{ label: 'Audit Log', slug: 'security/audit-log' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'Overview', slug: 'api/overview' },
					],
				},
				{
					label: 'Plugins',
					items: [
						{ label: 'Marketplace', slug: 'plugins/marketplace' },
						{ label: 'Developing Plugins', slug: 'plugins/developing' },
					],
				},
			],
		}),
	],
});
