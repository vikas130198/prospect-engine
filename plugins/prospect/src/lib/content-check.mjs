// Content schema, skeleton generation and the "never invent facts" accuracy check.
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES } from './paths.mjs';
import { readJSON, UserError } from './util.mjs';

export const SECTION_TYPES = {
  hero: { required: ['heading'], skeleton: { variant: 'split', eyebrow: '', heading: '[[Main headline]]', subheading: '[[One-sentence value proposition]]', primary_cta: { label: '[[Primary action]]', href: '#contact' }, secondary_cta: { label: '', href: '#about' }, image: null, image_alt: '', icon: 'sparkles', visual_label: '', badges: [] } },
  about: { required: ['heading', 'body'], skeleton: { eyebrow: 'About', heading: '[[About heading]]', body: ['[[Short story of the business, from verified research]]'], highlights: [], image: null, image_alt: '', icon: 'heart', visual_label: '' } },
  services: { required: ['heading', 'items'], skeleton: { eyebrow: 'Services', heading: '[[Services heading]]', intro: '', variant: 'cards', items: [{ icon: 'sparkles', title: '[[Service]]', text: '[[Short description]]' }] } },
  menu: { required: ['heading', 'categories'], skeleton: { eyebrow: 'Menu', heading: '[[Menu heading]]', intro: '', categories: [{ name: '[[Category]]', items: [{ name: '[[Item]]', description: '' }] }], note: '' } },
  gallery: { required: ['images'], skeleton: { eyebrow: 'Gallery', heading: '[[Gallery heading]]', images: [] } },
  features: { required: ['heading', 'items'], skeleton: { eyebrow: 'Why choose us', heading: '[[Why choose us]]', items: [{ icon: 'star', title: '[[Reason]]', text: '[[Short explanation]]' }] } },
  process: { required: ['heading', 'steps'], skeleton: { eyebrow: 'How it works', heading: '[[How it works]]', steps: [{ title: '[[Step]]', text: '' }] } },
  testimonials: { required: ['items'], skeleton: { eyebrow: 'Reviews', heading: 'What customers say', items: [] } },
  stats: { required: ['items'], skeleton: { items: [] } },
  pricing: { required: ['plans'], skeleton: { eyebrow: 'Pricing', heading: '[[Pricing heading]]', plans: [] } },
  team: { required: ['members'], skeleton: { eyebrow: 'Team', heading: '[[Meet the team]]', members: [] } },
  faq: { required: ['items'], skeleton: { eyebrow: 'FAQ', heading: 'Frequently asked questions', items: [{ q: '[[Question]]', a: '[[Answer — only from verified information]]' }] } },
  cta: { required: ['heading'], skeleton: { heading: '[[Call-to-action heading]]', text: '', cta: { label: '[[Action]]', href: '#contact' } } },
  contact: { required: [], skeleton: { eyebrow: 'Contact', heading: '[[Contact heading]]', intro: '', info: { phone: '[[Add phone number]]', email: '', whatsapp: '', address: '[[Add address]]', hours: [] }, map_query: '', show_form: true, form: { submit_label: 'Send enquiry' }, social: [] } },
  marquee: { required: ['items'], skeleton: { items: ['[[Short phrase]]', '[[Short phrase]]', '[[Short phrase]]', '[[Short phrase]]'], icon: 'sparkles', style: 'solid', speed: 'normal' } },
  custom: { required: ['component'], skeleton: { component: 'MySection' } },
};

export const VARIANTS = { hero: ['split', 'centered', 'fullbleed', 'editorial'], services: ['cards', 'list'], gallery: ['grid', 'scroll'], process: ['cards', 'stack'] };

export function loadMotion() {
  return readJSON(path.join(TEMPLATES, 'builder', 'src', 'lib', 'motion.json'));
}

/** Check a motion object against the presets/options the template supports. */
export function motionProblems(m) {
  const errors = [];
  const warnings = [];
  if (m === undefined || m === null) return { errors, warnings: ['No "motion" settings — the default "elegant" preset is used. Choose the preset that fits this business.'] };
  if (typeof m !== 'object' || Array.isArray(m)) return { errors: ['"motion" must be an object like {"preset": "cinematic"}.'], warnings };
  const { presets, options } = loadMotion();
  if (!m.preset) warnings.push('motion.preset is not set — "elegant" is used.');
  else if (!presets[m.preset]) errors.push(`Unknown motion preset "${m.preset}". Options: ${Object.keys(presets).join(', ')}.`);
  for (const [k, v] of Object.entries(m)) {
    if (k === 'preset' || k === 'notes') continue;
    const allowed = options[k];
    if (!allowed) warnings.push(`motion.${k} is not a supported setting (ignored). Supported: ${Object.keys(options).join(', ')}.`);
    else if (allowed === 'boolean' ? typeof v !== 'boolean' : !allowed.includes(v)) errors.push(`motion.${k} must be ${allowed === 'boolean' ? 'true or false' : 'one of: ' + allowed.join(', ')}.`);
  }
  return { errors, warnings };
}

export function loadThemes() {
  return readJSON(path.join(TEMPLATES, 'builder', 'src', 'lib', 'themes.json'));
}

export function listLayouts() {
  const dir = path.join(TEMPLATES, 'layouts');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJSON(path.join(dir, f)));
}

export function getLayout(name) {
  const l = listLayouts().find((x) => x.name === name);
  if (!l) throw new UserError(`Unknown layout "${name}".`, `Available: ${listLayouts().map((x) => x.name).join(', ')}.`);
  return l;
}

const SECTION_IDS = { hero: 'home', about: 'about', services: 'services', menu: 'menu', gallery: 'gallery', features: 'why-us', process: 'process', testimonials: 'reviews', stats: 'highlights', pricing: 'pricing', team: 'team', faq: 'faq', cta: 'get-started', contact: 'contact' };
const NAV_LABELS = { about: 'About', services: 'Services', menu: 'Menu', gallery: 'Gallery', features: 'Why us', process: 'How it works', pricing: 'Pricing', team: 'Team', faq: 'FAQ', contact: 'Contact' };

/** Build a starting content.json from a layout. Placeholders [[...]] mark everything still to be written. */
export function skeletonContent({ layout, theme, business_name, agency, sections: chosen, motion }) {
  const l = getLayout(layout);
  const types = chosen?.length ? chosen.map((t) => (typeof t === 'string' ? { type: t } : t)) : l.sections.filter((s) => !s.optional);
  const sections = types.map((s) => {
    const def = SECTION_TYPES[s.type];
    if (!def) throw new UserError(`Unknown section type "${s.type}".`);
    return { type: s.type, id: s.id || SECTION_IDS[s.type] || s.type, ...structuredClone(def.skeleton), ...(s.variant ? { variant: s.variant } : {}) };
  });
  const navTypes = ['about', 'services', 'menu', 'gallery', 'features', 'process', 'pricing', 'team', 'faq'];
  const links = sections.filter((s) => navTypes.includes(s.type)).slice(0, 4).map((s) => ({ label: NAV_LABELS[s.type], href: `#${s.id}` }));
  if (sections.some((s) => s.type === 'contact')) links.push({ label: 'Contact', href: '#contact' });
  return {
    schema: 1,
    meta: { title: `[[${business_name || 'Business'} — short benefit]]`, description: '[[150-character description from verified research]]', lang: 'en' },
    business: { name: business_name || '[[Business name]]', tagline: '', logo: null },
    theme: { preset: theme || l.default_theme },
    motion: motion || { preset: l.default_motion || 'elegant' },
    preview: { agency_name: agency?.name || 'Our studio', agency_url: /^https:\/\//.test(agency?.website || '') ? agency.website : '' },
    nav: { links, cta: { label: l.nav_cta, href: '#contact' } },
    sections,
    footer: { text: '', social: [] },
  };
}

// ---------- validation ----------

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const PHONE_RE = /(?:\+|\b)\d[\d\s().-]{6,16}\d\b/g;
const CLAIM_RE = /\b(award[- ]?winning|awards?|certified|accredited|licensed|iso \d+|\d+\+?\s*(years|yrs)|since (19|20)\d{2}|#\s?1\b|number one|no\.? ?1\b|best in|top[- ]rated|\d[\d,]*\+?\s*(happy )?(clients|customers|patients|students|projects|orders|members)|guarantee[d]?|100\s?%|lowest price|cheapest)\b/gi;

function walkStrings(obj, cb, pathParts = []) {
  if (typeof obj === 'string') cb(obj, pathParts.join('.'));
  else if (Array.isArray(obj)) obj.forEach((v, i) => walkStrings(v, cb, [...pathParts, i]));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) walkStrings(v, cb, [...pathParts, k]);
}

const strip = (s) => String(s).replace(/\[\[.*?\]\]/g, '');

/**
 * Validate a prototype content object against the schema and the lead's verified facts.
 * errors block the build; warnings are shown for review; placeholders are listed for the user.
 */
export function validateContent(content, lead, { customDir } = {}) {
  const errors = [];
  const warnings = [];
  const placeholders = [];
  const themes = loadThemes().themes;

  if (!content || typeof content !== 'object') return { errors: ['content.json is empty or not an object.'], warnings, placeholders };
  if (!content.meta?.title || !strip(content.meta.title).trim()) errors.push('meta.title is missing (page title).');
  else if (strip(content.meta.title).length > 70) warnings.push(`meta.title is ${strip(content.meta.title).length} characters; aim for 70 or fewer.`);
  if (!content.meta?.description || !strip(content.meta.description).trim()) errors.push('meta.description is missing.');
  else {
    const n = strip(content.meta.description).length;
    if (n < 50 || n > 170) warnings.push(`meta.description is ${n} characters; aim for 50–170.`);
  }
  if (!content.business?.name || /\[\[/.test(content.business.name)) errors.push('business.name must be the real business name.');
  if (content.theme?.preset && !themes[content.theme.preset]) errors.push(`Unknown theme preset "${content.theme.preset}". Options: ${Object.keys(themes).join(', ')}.`);
  const mp = motionProblems(content.motion);
  errors.push(...mp.errors);
  warnings.push(...mp.warnings);
  for (const [k, v] of Object.entries(content.theme?.colors || {})) {
    if (!/^#[0-9a-f]{6}$/i.test(v)) errors.push(`theme.colors.${k} must be a 6-digit hex colour like #1a2b3c.`);
  }

  const sections = Array.isArray(content.sections) ? content.sections : [];
  if (!sections.length) errors.push('There are no sections.');
  if (sections[0]?.type !== 'hero') errors.push('The first section must be a hero.');
  if (sections.filter((s) => s.type === 'hero').length > 1) errors.push('Only one hero section is allowed (it holds the single H1).');
  const ids = new Set();
  for (const [i, s] of sections.entries()) {
    const where = `sections[${i}] (${s?.type})`;
    const def = SECTION_TYPES[s?.type];
    if (!def) {
      errors.push(`${where}: unknown section type. Valid: ${Object.keys(SECTION_TYPES).join(', ')}.`);
      continue;
    }
    if (!s.id || !/^[a-z][a-z0-9-]*$/.test(s.id)) errors.push(`${where}: id must be lowercase letters, numbers and dashes.`);
    else if (ids.has(s.id)) errors.push(`${where}: duplicate id "${s.id}".`);
    else ids.add(s.id);
    for (const r of def.required) {
      const v = s[r];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) errors.push(`${where}: "${r}" is required.`);
    }
    if (s.variant !== undefined && VARIANTS[s.type] && !VARIANTS[s.type].includes(s.variant)) errors.push(`${where}: variant must be one of: ${VARIANTS[s.type].join(', ')}.`);
    if (s.type === 'marquee') {
      const items = Array.isArray(s.items) ? s.items : [];
      if (items.some((t) => typeof t !== 'string')) errors.push(`${where}: items must be short text strings.`);
      else if (items.some((t) => strip(t).length > 40)) warnings.push(`${where}: keep marquee phrases short (≤ 40 characters).`);
      if (items.length && items.length < 3) warnings.push(`${where}: use at least 3 phrases so the band loops smoothly.`);
    }
    if (s.type === 'gallery' && s.variant === 'scroll' && (s.images || []).length < 4) warnings.push(`${where}: the "scroll" gallery needs 4+ images to look good (falls back to grid below 3).`);
    if (s.type === 'testimonials') {
      for (const [j, t] of (s.items || []).entries()) {
        if (!/^https?:\/\//.test(t.source_url || '')) errors.push(`${where}.items[${j}]: testimonials must be real reviews with a public source_url. Never write fake reviews — remove the section instead.`);
      }
    }
    if (s.type === 'stats') {
      for (const [j, t] of (s.items || []).entries()) if (!t.source) errors.push(`${where}.items[${j}]: every statistic needs a "source" (where it was verified).`);
    }
    if (s.type === 'pricing') {
      for (const [j, p] of (s.plans || []).entries()) if (!p.source && !/\[\[/.test(p.price || '')) errors.push(`${where}.plans[${j}]: prices need a "source" or must be a [[placeholder]].`);
    }
    if (s.type === 'menu' || s.type === 'services') {
      const items = s.type === 'menu' ? (s.categories || []).flatMap((c) => c.items || []) : s.items || [];
      for (const it of items) {
        if (it.price && !/\[\[/.test(it.price) && !it.price_source && !s.price_source) errors.push(`${where}: price "${it.price}" needs a price_source (on the item or section) or must be a [[placeholder]].`);
      }
    }
    if (s.type === 'team') {
      for (const m of s.members || []) if (!m.source && !/\[\[/.test(m.name || '')) warnings.push(`${where}: team member "${m.name}" has no source — only list people confirmed publicly.`);
    }
    if (s.type === 'gallery' && !(s.images || []).length) warnings.push(`${where}: gallery has no images and will be hidden. Remove it or add images.`);
    if (s.type === 'custom') {
      if (!/^[A-Z][A-Za-z0-9]*$/.test(s.component || '')) errors.push(`${where}: component must be a PascalCase name.`);
      else if (customDir && !fs.existsSync(path.join(customDir, `${s.component}.tsx`))) errors.push(`${where}: custom/${s.component}.tsx does not exist.`);
    }
    for (const key of ['image']) {
      if (s[key] && !/^https:\/\//.test(s[key]) && !/^assets\//.test(s[key])) errors.push(`${where}: image must be "assets/<file>" or an https URL.`);
      if (s[key] && !s.image_alt) warnings.push(`${where}: image has no image_alt text.`);
    }
  }
  for (const l of content.nav?.links || []) {
    if (/^#/.test(l.href || '') && l.href !== '#top' && !ids.has(l.href.slice(1))) errors.push(`Navigation link "${l.label}" points to ${l.href}, which does not exist.`);
  }

  // --- accuracy: phones/emails must come from verified contacts or user-provided facts ---
  const known = new Set();
  const addKnown = (v) => {
    if (!v) return;
    const s = String(v);
    known.add(s.toLowerCase());
    const d = s.replace(/\D/g, '');
    if (d.length >= 7) known.add(d.slice(-9));
  };
  for (const c of lead?.contacts || []) addKnown(c.value);
  walkStrings(lead?.facts || {}, (s) => {
    addKnown(s);
    for (const m of s.matchAll(EMAIL_RE)) addKnown(m[0]);
    for (const m of s.matchAll(PHONE_RE)) addKnown(m[0]);
  });
  const researchText = JSON.stringify(lead?.research || {}).toLowerCase();
  const allowedHosts = new Set(['wa.me', 'www.google.com', 'maps.google.com']);
  walkStrings(content, (raw, where) => {
    if (/\[\[/.test(raw)) for (const m of raw.matchAll(/\[\[(.*?)\]\]/g)) placeholders.push(`${where}: ${m[1]}`);
    const s = strip(raw);
    if (/^(preview|meta\.structured_data)/.test(where) || /source(_url)?$|\.url$|\.href$|evidence$/.test(where)) return;
    for (const m of s.matchAll(EMAIL_RE)) {
      if (!known.has(m[0].toLowerCase())) errors.push(`${where}: email "${m[0]}" is not in the verified contacts. Use a [[placeholder]] or add it with a source first.`);
    }
    for (const m of s.matchAll(PHONE_RE)) {
      const d = m[0].replace(/\D/g, '');
      // Real phone numbers have 9+ digits (or 8+ with a country code); skips prices, years and ranges.
      if (d.length < (m[0].trim().startsWith('+') ? 8 : 9) || (/\d\s+[-–]\s+\d|\d–\d/.test(m[0]) && !m[0].trim().startsWith('+'))) continue;
      if (!known.has(d.slice(-9))) errors.push(`${where}: phone "${m[0].trim()}" is not in the verified contacts. Use a [[placeholder]] or add it with a source first.`);
    }
    for (const m of s.matchAll(CLAIM_RE)) {
      if (!researchText.includes(m[0].toLowerCase())) warnings.push(`${where}: claim "${m[0]}" — make sure this is verified for this business, or remove it.`);
    }
    if (/https?:\/\//.test(s) && /\.(href|url)$/.test(where) === false) {
      for (const m of s.matchAll(/https?:\/\/([^/\s"']+)/g)) if (!allowedHosts.has(m[1])) warnings.push(`${where}: contains a link to ${m[1]} — check it is correct.`);
    }
  });
  if (content.meta?.structured_data) {
    const sd = JSON.stringify(content.meta.structured_data);
    for (const m of sd.matchAll(PHONE_RE)) if (!known.has(m[0].replace(/\D/g, '').slice(-9))) errors.push('meta.structured_data contains an unverified phone number.');
    if (/\[\[/.test(sd)) errors.push('meta.structured_data must not contain placeholders.');
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)].slice(0, 40), placeholders };
}
