// Bundles the MCP server and CLI into self-contained files in plugins/prospect/dist/
// so plugin users need no `npm install` for the plugin itself.
// Also writes dist/THIRD_PARTY_NOTICES.md with the licenses of every bundled package.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins', 'prospect');
const bundled = new Set();

for (const name of ['server', 'cli']) {
  const result = await build({
    entryPoints: [path.join(plugin, 'src', `${name}.mjs`)],
    outfile: path.join(plugin, 'dist', `${name}.mjs`),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    minify: false,
    legalComments: 'none',
    metafile: true,
    banner: { js: "// Prospect Engine — MIT License. Bundled third-party licenses: see THIRD_PARTY_NOTICES.md\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    logLevel: 'warning',
  });
  for (const input of Object.keys(result.metafile.inputs)) {
    const m = input.replace(/\\/g, '/').match(/node_modules\/((?:@[^/]+\/)?[^/]+)/g);
    if (m) bundled.add(m[m.length - 1].replace('node_modules/', ''));
  }
  console.log(`built dist/${name}.mjs`);
}

// Collect license texts of bundled packages.
const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'LICENCE', 'LICENSE-MIT'];
const sections = [];
const problems = [];
for (const pkg of [...bundled].sort()) {
  const dir = path.join(root, 'node_modules', pkg);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const license = meta.license || (meta.licenses || []).map((l) => l.type).join(' OR ') || 'UNKNOWN';
  if (!/^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|MIT-0|\(MIT OR [^)]+\))$/.test(license)) problems.push(`${pkg}: ${license}`);
  const file = LICENSE_FILES.map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  const text = file ? fs.readFileSync(file, 'utf8').trim() : `License: ${license} (no license file shipped with the package)`;
  sections.push(`## ${pkg}@${meta.version} — ${license}\n\n${meta.homepage || meta.repository?.url || ''}\n\n\`\`\`\n${text}\n\`\`\``);
}
fs.writeFileSync(
  path.join(plugin, 'dist', 'THIRD_PARTY_NOTICES.md'),
  `# Third-party notices\n\nThe files in this folder bundle the following open-source packages. Their licenses are reproduced below.\n\n${sections.join('\n\n')}\n`,
);
console.log(`wrote dist/THIRD_PARTY_NOTICES.md (${bundled.size} packages)`);
if (problems.length) {
  console.error(`\nReview these licenses before publishing:\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
}
