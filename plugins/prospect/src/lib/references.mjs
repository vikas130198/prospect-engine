// Engine 3: user-managed design reference library (inspiration only — never copied).
import fs from 'node:fs';
import path from 'node:path';
import { now, readJSON, slugify, UserError, writeJSON, copyDir, ensureDir, exists, removeDir } from './util.mjs';

export const REFERENCE_CATEGORIES = ['restaurants', 'healthcare', 'real-estate', 'ecommerce', 'corporate', 'education', 'interior-design', 'hospitality', 'manufacturing', 'beauty', 'fitness', 'events', 'other'];

const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;

export function listReferences(w, { category, tag, favourite } = {}) {
  const idx = readJSON(w.referencesIndex, { references: [] });
  return idx.references.filter((r) => !r.removed && (!category || r.category === category) && (!tag || r.tags.includes(tag)) && (!favourite || r.favourite));
}

export function addReference(w, { name, category, url, description, tags, style, image_paths, favourite }) {
  if (!name) throw new UserError('A reference needs a name.');
  if (!REFERENCE_CATEGORIES.includes(category)) throw new UserError(`Unknown category "${category}".`, `Use one of: ${REFERENCE_CATEGORIES.join(', ')}.`);
  if (url && !/^https?:\/\//.test(url)) throw new UserError('Reference URL must start with http:// or https://');
  const idx = readJSON(w.referencesIndex, { references: [] });
  let id = slugify(name);
  let n = 2;
  while (idx.references.some((r) => r.id === id)) id = `${slugify(name)}-${n++}`;
  const dir = path.join(w.references, category, id);
  ensureDir(dir);
  const images = [];
  for (const p of image_paths || []) {
    const abs = path.resolve(p);
    if (!exists(abs) || !IMAGE.test(abs)) throw new UserError(`Screenshot not found or not an image: ${p}`);
    if (fs.statSync(abs).size > 15_000_000) throw new UserError(`Screenshot is too large (over 15 MB): ${p}`);
    const dest = path.join(dir, path.basename(abs));
    fs.copyFileSync(abs, dest);
    images.push(path.relative(w.root, dest).replace(/\\/g, '/'));
  }
  const ref = {
    id,
    name,
    category,
    url: url || null,
    description: description || '',
    style: style || {},
    tags: (tags || []).map((t) => String(t).toLowerCase()),
    favourite: Boolean(favourite),
    images,
    folder: path.relative(w.root, dir).replace(/\\/g, '/'),
    created_at: now(),
  };
  idx.references.push(ref);
  writeJSON(w.referencesIndex, idx);
  writeJSON(path.join(dir, 'reference.json'), ref);
  return ref;
}

export function updateReference(w, id, patch) {
  const idx = readJSON(w.referencesIndex, { references: [] });
  const r = idx.references.find((x) => x.id === id && !x.removed);
  if (!r) throw new UserError(`No reference "${id}".`);
  for (const k of ['description', 'tags', 'favourite', 'style', 'url', 'name']) if (patch[k] !== undefined) r[k] = patch[k];
  writeJSON(w.referencesIndex, idx);
  return r;
}

export function removeReference(w, id, { deleteFiles = false } = {}) {
  const idx = readJSON(w.referencesIndex, { references: [] });
  const r = idx.references.find((x) => x.id === id);
  if (!r) throw new UserError(`No reference "${id}".`);
  r.removed = true;
  r.removed_at = now();
  writeJSON(w.referencesIndex, idx);
  if (deleteFiles) removeDir(path.join(w.root, r.folder));
  return { removed: id, files_deleted: deleteFiles };
}

/** Pick up reference folders the user dropped in manually (references/<category>/<name>/ with screenshots). */
export function scanReferences(w) {
  const idx = readJSON(w.referencesIndex, { references: [] });
  const known = new Set(idx.references.map((r) => r.folder));
  const added = [];
  for (const cat of REFERENCE_CATEGORIES) {
    const cdir = path.join(w.references, cat);
    if (!exists(cdir)) continue;
    for (const name of fs.readdirSync(cdir)) {
      const dir = path.join(cdir, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const rel = path.relative(w.root, dir).replace(/\\/g, '/');
      if (known.has(rel)) continue;
      const meta = exists(path.join(dir, 'reference.json')) ? readJSON(path.join(dir, 'reference.json')) : {};
      const notes = exists(path.join(dir, 'notes.md')) ? fs.readFileSync(path.join(dir, 'notes.md'), 'utf8').slice(0, 2000) : '';
      const ref = {
        id: slugify(meta.name || name),
        name: meta.name || name,
        category: cat,
        url: meta.url || null,
        description: meta.description || notes,
        style: meta.style || {},
        tags: meta.tags || [],
        favourite: Boolean(meta.favourite),
        images: fs.readdirSync(dir).filter((f) => IMAGE.test(f)).map((f) => `${rel}/${f}`),
        folder: rel,
        created_at: now(),
      };
      idx.references.push(ref);
      added.push(ref.id);
    }
  }
  writeJSON(w.referencesIndex, idx);
  return { added, total: idx.references.filter((r) => !r.removed).length };
}

export function ensureReferenceFolders(w) {
  for (const c of REFERENCE_CATEGORIES) ensureDir(path.join(w.references, c));
  const readme = path.join(w.references, 'README.md');
  if (!exists(readme)) {
    fs.writeFileSync(readme, `# Design references

Put website designs you like here, one folder per reference, inside the right category:

    references/restaurants/cozy-cafe-example/
        screenshot-home.png
        notes.md            ← optional: what you like about it (layout, colours, fonts)

Then run /prospect:references scan (or ask Claude to add one for you).

References are inspiration only. The engine never copies another site's code, text, images or brand.
`);
  }
}

export { copyDir };
