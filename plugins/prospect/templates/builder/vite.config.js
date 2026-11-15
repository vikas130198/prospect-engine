// Build config for one prototype. The Prospect Engine copies the prototype's
// content.json / assets / custom components into src/site/ and runs `vite build`.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/themes.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => String(s ?? '').replace(/\[\[(.*?)\]\]/g, '').replace(/\s+/g, ' ').trim();

export function resolveTheme(theme = {}) {
  const base = catalog.themes[theme.preset] || catalog.themes['modern-slate'];
  const colors = { ...base.colors, ...(theme.colors || {}) };
  const fonts = { ...base.fonts, ...(theme.fonts || {}) };
  for (const k of ['heading', 'body']) if (!catalog.fonts[fonts[k]]) fonts[k] = base.fonts[k];
  return { colors, fonts, radius: theme.radius || base.radius, dark: base.dark };
}

// Simple generated favicon: the business initial on the brand colour (no external file needed).
function favicon(name, colors) {
  const letter = (plain(name).match(/[A-Za-z0-9]/) || ['*'])[0].toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${colors.primary}'/><text x='32' y='44' font-family='Georgia,serif' font-size='36' font-weight='700' text-anchor='middle' fill='${colors['primary-contrast']}'>${letter}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function prospectHead() {
  return {
    name: 'prospect-head',
    transformIndexHtml(html) {
      const c = JSON.parse(fs.readFileSync(path.join(root, 'src/site/content.json'), 'utf8'));
      const t = resolveTheme(c.theme);
      const title = plain(c.meta?.title) || plain(c.business?.name) || 'Website preview';
      const desc = plain(c.meta?.description);
      const families = [...new Set([t.fonts.heading, t.fonts.body])].map((f) => `family=${catalog.fonts[f]}`).join('&');
      const vars = Object.entries(t.colors).map(([k, v]) => `--color-${k}:${v}`).join(';');
      const stack = (f, fallback) => `'${f}', ${fallback}`;
      const tags = [
        `<title>${esc(title)}</title>`,
        desc && `<meta name="description" content="${esc(desc)}" />`,
        // Preview sites must never be indexed by search engines.
        `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />`,
        `<meta name="googlebot" content="noindex, nofollow" />`,
        `<meta name="theme-color" content="${esc(t.colors.bg)}" />`,
        `<link rel="icon" href="${favicon(c.business?.name, t.colors)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        desc && `<meta property="og:description" content="${esc(desc)}" />`,
        /^https:\/\//.test(c.meta?.og_image || '') && `<meta property="og:image" content="${esc(c.meta.og_image)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
        `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=swap" />`,
        `<style id="prospect-theme">:root{${vars};--font-heading:${stack(t.fonts.heading, 'Georgia, serif')};--font-body:${stack(t.fonts.body, 'system-ui, sans-serif')};--radius-brand:${t.radius};color-scheme:${t.dark ? 'dark' : 'light'}}</style>`,
        // Structured data only when built from verified information (validated by the engine).
        c.meta?.structured_data && `<script type="application/ld+json">${JSON.stringify(c.meta.structured_data).replace(/</g, '\\u003c')}</script>`,
      ].filter(Boolean);
      return html.replace('<!--prospect-head-->', tags.join('\n    ')).replace('%PROSPECT_LANG%', esc(c.meta?.lang || 'en'));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), prospectHead()],
  define: {
    __PROSPECT_CODE__: JSON.stringify(process.env.PROSPECT_CODE || 'PREVIEW'),
  },
  build: {
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 600,
    reportCompressedSize: false,
  },
  logLevel: 'warn',
});
