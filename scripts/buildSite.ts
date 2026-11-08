import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_URL = 'https://lewis-wow.github.io/claude-bit/schema.json';
const REPO_URL = 'https://github.com/lewis-wow/claude-bit';

const root = join(import.meta.dirname, '..');
const outputDirectory = join(root, 'site');

type SchemaProperty = { description?: string; default?: unknown };

const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const schema = JSON.parse(readFileSync(join(root, 'schema.json'), 'utf8')) as {
  properties: Record<string, SchemaProperty>;
};

const rows = Object.entries(schema.properties)
  .filter(([key]) => key !== '$schema')
  .map(([key, value]) => {
    const fallback =
      value.default === undefined ? '' : `<code>${escape(JSON.stringify(value.default))}</code>`;

    return `<tr><td><code>${escape(key)}</code></td><td>${escape(value.description ?? '')}</td><td>${fallback}</td></tr>`;
  })
  .join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>claude-bit configuration schema</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 52rem; margin: 0 auto; padding: 2rem 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent); padding: .5rem .6rem .5rem 0; text-align: left; vertical-align: top; }
  code { font-size: .9em; }
  pre { background: color-mix(in srgb, currentColor 8%, transparent); padding: .8rem; border-radius: .4rem; overflow-x: auto; }
</style>
</head>
<body>
<h1>claude-bit configuration schema</h1>
<p>JSON Schema for <code>claude-bit.json</code>, generated from the same definition that
validates the file at runtime. Point your editor at it:</p>
<pre><code>{ "$schema": "${SCHEMA_URL}" }</code></pre>
<p><a href="schema.json">schema.json</a> &middot; <a href="${REPO_URL}">repository</a></p>
<h2>Top-level options</h2>
<table>
<tr><th>Key</th><th>Meaning</th><th>Default</th></tr>
${rows}
</table>
</body>
</html>
`;

mkdirSync(outputDirectory, { recursive: true });
copyFileSync(join(root, 'schema.json'), join(outputDirectory, 'schema.json'));
writeFileSync(join(outputDirectory, 'index.html'), page);

console.log(`wrote ${outputDirectory}`);
