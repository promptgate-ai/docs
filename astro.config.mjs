// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'PromptGate',
			description: 'AI Gateway Platform — Documentation',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/promptgate-org/promptgate' },
			],
			customCss: ['./src/styles/custom.css'],
			components: {
				Footer: './src/components/Footer.astro',
			},
			head: [
				{ tag: 'meta', attrs: { name: 'copyright', content: '© Akyros Labs LLC. All rights reserved.' } },
			],
			editLink: {
				baseUrl: 'https://github.com/promptgate-org/promptgate/edit/main/docs/',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
						{ label: 'Configuration', slug: 'getting-started/configuration' },
						{ label: 'Database Setup', slug: 'getting-started/database' },
					],
				},
				{
					label: 'Concepts',
					items: [
						{ label: 'Architecture', slug: 'concepts/architecture' },
						{ label: 'Project Types', slug: 'concepts/project-types' },
						{ label: 'Editions (Community vs Cloud)', slug: 'concepts/editions' },
					],
				},
				{
					label: 'Projects & Endpoints',
					items: [
						{ label: 'Projects', slug: 'features/projects' },
						{ label: 'AI Endpoints', slug: 'features/ai-endpoints' },
						{ label: 'Routing Rules', slug: 'features/routing-rules' },
						{ label: 'Replay from Logs', slug: 'features/replay' },
						{ label: 'Response Cache', slug: 'features/response-cache' },
						{ label: 'Endpoint Evals', slug: 'features/evals' },
						{ label: 'Cost Dashboard', slug: 'features/cost-dashboard' },
						{ label: 'Endpoint Versions', slug: 'features/endpoint-versions' },
						{ label: 'Anomaly Alerts', slug: 'features/anomaly-alerts' },
						{ label: 'Management API', slug: 'features/management-api' },
						{ label: 'Tool / Function Calling', slug: 'features/tool-calling' },
						{ label: 'AI Wrapper', slug: 'features/ai-wrapper' },
						{ label: 'API Gateway', slug: 'features/api-gateway' },
						{ label: 'Sessions', slug: 'features/sessions' },
						{ label: 'JSON Schema Validation', slug: 'features/schemas' },
						{ label: 'Streaming', slug: 'features/streaming' },
					],
				},
				{
					label: 'Providers',
					items: [
						{ label: 'Overview', slug: 'providers/overview' },
						{ label: 'Credentials', slug: 'features/credentials' },
						{ label: 'Provider Templates', slug: 'features/provider-templates' },
						{ label: 'Provider Settings', slug: 'providers/settings' },
						{ label: 'Adding a Provider', slug: 'providers/adding' },
					],
				},
				{
					label: 'Security',
					items: [
						{ label: 'Authentication', slug: 'security/authentication' },
						{ label: 'Client Tokens', slug: 'security/client-tokens' },
						{ label: 'Guardrails', slug: 'security/guardrails' },
						{ label: 'PII Filter', slug: 'security/pii-filter' },
						{ label: 'Prompt Injection', slug: 'security/prompt-injection' },
						{ label: 'Keyword Blocklist', slug: 'security/keyword-blocklist' },
						{ label: 'Content Length', slug: 'security/content-length' },
						{ label: 'Rate Limits', slug: 'security/rate-limits' },
						{ label: 'Budgets', slug: 'security/budgets' },
						{ label: 'SSRF Protection', slug: 'security/ssrf' },
						{ label: 'OAuth Connections', slug: 'security/oauth-connections' },
						{ label: 'Audit Log', slug: 'security/audit-log' },
					],
				},
				{
					label: 'MCP',
					items: [
						{ label: 'Overview', slug: 'mcp/overview' },
						{ label: 'MCP Bridge', slug: 'features/mcp-bridge' },
						{ label: 'MCP Gateway', slug: 'mcp/gateway' },
						{ label: 'MCP Control Plane', slug: 'mcp/control-plane' },
					],
				},
				{
					label: 'Observability',
					items: [
						{ label: 'Dashboard', slug: 'observability/dashboard' },
						{ label: 'Metrics', slug: 'observability/metrics' },
						{ label: 'Live Logs', slug: 'observability/live-logs' },
						{ label: 'Playground', slug: 'observability/playground' },
					],
				},
				{
					label: 'Administration',
					items: [
						{ label: 'Admin Area', slug: 'admin/overview' },
						{ label: 'Webhooks', slug: 'admin/webhooks' },
						{ label: 'Backup / Export', slug: 'admin/backup' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'Overview', slug: 'api/overview' },
						{ label: 'Authentication', slug: 'api/auth' },
						{ label: 'Gateway API', slug: 'api/gateway' },
						{ label: 'Wrapper API', slug: 'api/wrapper' },
						{ label: 'Proxy API', slug: 'api/proxy' },
						{ label: 'MCP API', slug: 'api/mcp' },
						{ label: 'Control Plane API', slug: 'api/control-plane' },
						{ label: 'Errors', slug: 'api/errors' },
					],
				},
				{
					label: 'Plugins (Coming Soon)',
					items: [
						{ label: 'Marketplace', slug: 'plugins/marketplace' },
						{ label: 'Developing Plugins', slug: 'plugins/developing' },
					],
				},
				{
					label: 'Cookbook',
					items: [
						{ label: 'Use OpenAI via the Gateway', slug: 'cookbook/openai-via-gateway' },
						{ label: 'Multi-provider AI Wrapper', slug: 'cookbook/ai-wrapper-setup' },
						{ label: 'Proxy GitHub with OAuth', slug: 'cookbook/api-gateway-github-oauth' },
						{ label: 'Expose Endpoint as MCP Tool', slug: 'cookbook/expose-mcp-tool' },
					],
				},
			],
		}),
	],
});
