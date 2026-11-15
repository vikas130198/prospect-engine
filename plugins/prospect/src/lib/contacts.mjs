// Engine 7 helper: extract publicly listed business contact details from a website, with sources.
import { parse } from 'node-html-parser';
import { safeFetch } from './net.mjs';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(example|sentry|wixpress|domain|email)\.|^(name|your|user|test)@|noreply|no-reply/i;
const PHONE_RE = /(?:\+|00)?\(?\d[\d\s().-]{7,17}\d/g;
const CONTACT_PATH = /(contact|about|reach|location|find-us|visit|enquir|inquir|book)/i;

const SOCIAL_HOSTS = new Set(['instagram.com', 'facebook.com', 'fb.com', 'linkedin.com', 'tiktok.com', 'youtube.com', 'x.com', 'twitter.com', 'pinterest.com', 'threads.net']);
function isSocial(h) {
  try {
    return SOCIAL_HOSTS.has(new URL(h).hostname.replace(/^(www|m)\./, ''));
  } catch {
    return false;
  }
}

/** Plausible phone formatting: balanced brackets, few groups, no runs of single digits (code samples, dates). */
function plausiblePhone(raw) {
  const t = raw.trim();
  if ((t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length) return false;
  const groups = t.replace(/[()+]/g, ' ').split(/[\s.-]+/).filter(Boolean);
  if (groups.length > 6) return false;
  if (groups.filter((g) => g.length === 1).length > 1) return false;
  return true;
}

function deobfuscate(s) {
  return s.replace(/\s*\[\s*at\s*\]\s*|\s+\(at\)\s+|\s+at\s+(?=[a-z0-9-]+\s*(\[\s*dot\s*\]|\(dot\))\s*)/gi, '@').replace(/\s*\[\s*dot\s*\]\s*|\s*\(dot\)\s*/gi, '.');
}

export function extractFrom(url, html) {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  const found = [];
  const push = (type, value, evidence, confidence = 'medium') => found.push({ type, value: value.trim(), source_url: url, evidence, confidence });
  for (const a of root.querySelectorAll('a[href]')) {
    const h = (a.getAttribute('href') || '').trim();
    if (/^mailto:/i.test(h)) {
      const e = decodeURIComponent(h.slice(7).split('?')[0]);
      if (e && !BAD_EMAIL.test(e)) push('email', e.toLowerCase(), 'mailto link', 'high');
    } else if (/^tel:/i.test(h)) {
      push('phone', decodeURIComponent(h.slice(4)), 'tel link', 'high');
    } else if (/wa\.me\/|api\.whatsapp\.com\/send|whatsapp\.com\/send/i.test(h)) {
      const num = (h.match(/wa\.me\/(\+?\d+)/i) || h.match(/phone=(\+?\d+)/i) || [])[1];
      push('whatsapp', num ? `+${num.replace(/^\+/, '')}` : h, `public WhatsApp link: ${h}`, 'high');
    } else if (isSocial(h)) {
      push('social', h, 'link on website', 'high');
    } else if (/(calendly\.com|booksy|fresha|zocdoc|opentable|resy|setmore|simplybook|square\.site\/book)/i.test(h)) {
      push('booking_link', h, 'booking link on website', 'high');
    }
  }
  const body = deobfuscate((root.querySelector('body') || root).textContent.replace(/\s+/g, ' '));
  for (const m of body.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (!BAD_EMAIL.test(e)) push('email', e, 'shown as text on page', 'medium');
  }
  for (const m of body.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    if (/^(19|20)\d{2}(19|20)\d{2}$/.test(digits)) continue; // year ranges
    const ctx = body.slice(Math.max(0, m.index - 30), m.index).toLowerCase();
    if (!plausiblePhone(m[0])) continue;
    if (!/(\btel\b|phone|call|mob|contact|whatsapp|\bph\b)/.test(ctx) && !m[0].trim().startsWith('+')) continue;
    push('phone', m[0], `text near "${ctx.trim().slice(-25)}"`, 'low');
  }
  // Structured data often holds the official address/phone.
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : data['@graph'] || [data];
      for (const it of items) {
        if (it.telephone) push('phone', String(it.telephone), 'schema.org structured data', 'high');
        if (it.email) push('email', String(it.email).replace(/^mailto:/, '').toLowerCase(), 'schema.org structured data', 'high');
        const a = it.address;
        if (a && typeof a === 'object') {
          const addr = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry?.name || a.addressCountry].filter(Boolean).join(', ');
          if (addr) push('address', addr, 'schema.org structured data', 'high');
        }
      }
    } catch { /* ignore invalid JSON-LD */ }
  }
  const links = root.querySelectorAll('a[href]').map((a) => a.getAttribute('href'));
  return { found, links };
}

export async function extractContacts(url, { maxPages = 4 } = {}) {
  const first = await safeFetch(url);
  if (first.error) return { url, error: first.error, contacts: [] };
  const base = new URL(first.finalUrl);
  const pages = [{ url: first.finalUrl, html: first.body }];
  const { links } = extractFrom(first.finalUrl, first.body);
  const candidates = [];
  for (const h of links) {
    try {
      const abs = new URL(h, base);
      if (abs.hostname !== base.hostname) continue;
      if (CONTACT_PATH.test(abs.pathname) && !candidates.includes(abs.href.split('#')[0])) candidates.push(abs.href.split('#')[0]);
    } catch { /* skip */ }
  }
  for (const c of candidates.slice(0, maxPages - 1)) {
    const r = await safeFetch(c, { maxBytes: 1_500_000 });
    if (!r.error && r.status < 400) pages.push({ url: r.finalUrl, html: r.body });
  }
  const all = [];
  for (const p of pages) all.push(...extractFrom(p.url, p.html).found);
  // De-duplicate, keeping the highest confidence.
  const rank = { high: 3, medium: 2, low: 1 };
  const map = new Map();
  for (const c of all) {
    const key = c.type + ':' + (c.type === 'phone' || c.type === 'whatsapp' ? c.value.replace(/[^\d]/g, '') : c.value.toLowerCase());
    const prev = map.get(key);
    if (!prev || rank[c.confidence] > rank[prev.confidence]) map.set(key, c);
  }
  return {
    url: first.finalUrl,
    pages_checked: pages.map((p) => p.url),
    contacts: [...map.values()].slice(0, 40),
    note: 'These are candidates found on public pages. Confirm each before saving. WhatsApp is only confirmed when a public wa.me / WhatsApp link exists.',
  };
}
