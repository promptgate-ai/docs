// Copies the PromptGate docs into this Starlight site.
// (c) 2026 Akyros Labs LLC. All rights reserved.
//
// The Markdown in the PromptGate repository (docs/, CHANGELOG.md) and the
// pgfuzz README are the only source: this script turns them into pages
// under src/content/docs/ and writes the sidebar to src/sidebar.json.
// The output is committed, because the PromptGate repository is private
// and CI here can't read it.
//
//   node scripts/sync-docs.mjs [path/to/promptgate] [path/to/pgfuzz]
//
// Defaults: ../go-source and ../pgfuzz next to this repository.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pg = path.resolve(process.argv[2] ?? path.join(root, '..', 'go-source'));
const fuzz = path.resolve(process.argv[3] ?? path.join(root, '..', 'pgfuzz'));
const out = path.join(root, 'src', 'content', 'docs');

// Sidebar groups, in order. A doc missing here fails the sync, so a new
// page can't go unlisted.
const groups = [
  ['Getting started', ['install', 'configuration', 'routing', 'formats', 'cli']],
  ['Keys, users and spend', ['users', 'limits', 'budgets']],
  ['AI Gateway endpoints', ['endpoints', 'endpoint-routes', 'endpoint-sessions', 'endpoint-evals', 'json-schema']],
  ['Guardrails', ['guardrails', 'guard-secrets', 'guard-pii', 'guard-pii-contextual', 'guard-injection', 'guard-token-saver', 'guard-access', 'guard-lists']],
  ['MCP gateway', ['mcp', 'mcp-agents', 'mcp-endpoints', 'mcp-control']],
  ['API Gateway', ['api-gateway', 'oauth']],
  ['Web UI', ['ui', 'ui-pages', 'ui-apis']],
  ['Operations', ['metrics', 'events', 'webhooks', 'audit', 'anomalies']],
  ['Testing', ['pgfuzz']],
];
const skip = new Set(['releasing']); // for maintainers, stays in the repository

// pages: slug → { file, body }
const pages = new Map();
for (const f of fs.readdirSync(path.join(pg, 'docs'))) {
  const slug = f.replace(/\.md$/, '');
  if (f.endsWith('.md') && !skip.has(slug)) {
    pages.set(slug, { from: `docs/${f}`, body: read(path.join(pg, 'docs', f)) });
  }
}
pages.set('pgfuzz', { from: 'pgfuzz/README.md', body: read(path.join(fuzz, 'README.md')) });
pages.set('changelog', { from: 'CHANGELOG.md', body: read(path.join(pg, 'CHANGELOG.md')) });
const archived = fs
  .readdirSync(path.join(pg, 'docs', 'changelog'))
  .filter((f) => /^\d+\.\d+\.md$/.test(f))
  .sort((a, b) => minor(b) - minor(a));
for (const f of archived) {
  pages.set(changelogSlug(f), { from: `docs/changelog/${f}`, body: read(path.join(pg, 'docs', 'changelog', f)) });
}

const listed = groups.flatMap(([, slugs]) => slugs);
const unlisted = [...pages.keys()].filter((s) => !listed.includes(s) && !s.startsWith('changelog'));
const missing = listed.filter((s) => !pages.has(s));
if (unlisted.length || missing.length) {
  fail(`sidebar out of date — not listed: ${unlisted.join(', ') || '-'}; no such doc: ${missing.join(', ') || '-'}`);
}

// Start clean: every page here comes from the sources, except the landing page.
for (const entry of fs.readdirSync(out)) {
  if (entry !== 'index.mdx') fs.rmSync(path.join(out, entry), { recursive: true });
}
const warnings = [];
for (const [slug, { from, body }] of pages) {
  const file = path.join(out, `${slug}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, page(slug, from, body, warnings));
}

const sidebar = groups.map(([label, slugs]) => ({ label, items: slugs.map((slug) => ({ slug })) }));
sidebar.push({
  label: 'Changelog',
  items: [{ label: 'Latest', slug: 'changelog' }, ...archived.map((f) => ({ label: `v${f.replace(/\.md$/, '')}`, slug: changelogSlug(f) }))],
});
fs.writeFileSync(path.join(root, 'src', 'sidebar.json'), JSON.stringify(sidebar, null, 2) + '\n');

for (const w of warnings) console.warn(`warning: ${w}`);
console.log(`synced ${pages.size} pages from ${pg} and ${fuzz}`);

function page(slug, from, body, warnings) {
  const lines = body.split('\n');
  const h1 = lines.findIndex((l) => l.startsWith('# '));
  if (h1 < 0) fail(`${from}: no "# Title" line`);
  const title = plain(lines[h1].slice(2));
  const rest = lines.slice(h1 + 1).join('\n').replace(/^\n+/, '');
  const description = clip(plain(firstParagraph(rest)), 160);
  const dir = path.posix.dirname(from);
  const linked = rest.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (all, bang, text, href) => {
    if (bang || /^([a-z]+:|#)/.test(href)) return all;
    const target = resolve(dir, href);
    if (target === null) {
      warnings.push(`${from}: dropped link to ${href} (not on the docs site)`);
      return text;
    }
    return `[${text}](${target})`;
  });
  return [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    `<!-- Generated from ${from} by scripts/sync-docs.mjs. Edit the source, not this file. -->`,
    '',
    linked.trimEnd(),
    '',
  ].join('\n');
}

// resolve maps a relative Markdown link to its page on this site, or null.
function resolve(dir, href) {
  const [file, anchor] = href.split('#');
  const hash = anchor ? `#${anchor}` : '';
  const p = path.posix.normalize(path.posix.join(dir, file));
  if (p === 'CHANGELOG.md') return `/changelog/${hash}`;
  if (p === 'README.md') return `/${hash}`;
  let m = p.match(/^docs\/changelog\/(\d+\.\d+\.md)$/);
  if (m) return `/${changelogSlug(m[1])}/${hash}`;
  m = p.match(/^docs\/([a-z0-9-]+)\.md$/);
  if (m && pages.has(m[1])) return `/${m[1]}/${hash}`;
  return null;
}

function changelogSlug(f) {
  return `changelog/v${f.replace(/\.md$/, '').replace('.', '-')}`;
}

function minor(f) {
  const [maj, min] = f.split('.').map(Number);
  return maj * 1000 + min;
}

function firstParagraph(md) {
  const para = [];
  for (const l of md.split('\n')) {
    if (/^(#|```|\||>|- |\* |<)/.test(l)) {
      if (para.length) break;
      continue;
    }
    if (!l.trim()) {
      if (para.length) break;
      continue;
    }
    para.push(l.trim());
  }
  return para.join(' ');
}

// clip shortens s to at most n characters, at a word boundary.
function clip(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, s.lastIndexOf(' ', n - 1)) + '…';
}

function plain(s) {
  return s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`|\*\*?/g, '')
    .trim();
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    fail(`${file}: ${err.message}`);
  }
}

function fail(msg) {
  console.error(`sync-docs: ${msg}`);
  process.exit(1);
}
