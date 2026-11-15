// Engine 2 helpers: technical website audit, link checking, PageSpeed Insights.
import { parse } from 'node-html-parser';
import { safeFetch, normalizeUrl } from './net.mjs';
import { readSecrets } from './config.mjs';

const SOCIAL = /(instagram\.com|facebook\.com|fb\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com|pinterest\.|wa\.me|whatsapp\.com)/i;
const CTA_WORDS = /\b(book|order|reserve|call|contact|enquire|enquiry|inquire|get (a )?quote|schedule|appointment|buy|shop|subscribe|sign ?up|whatsapp|visit|start|hire|request)\b/i;
const TRUST_WORDS = /\b(testimonial|review|rated|certif|accredit|award|guarantee|partner|clients|trusted|years|since \d{4}|faq|privacy policy|terms)\b/i;

function text(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

export async function auditWebsite(url) {
  const res = await safeFetch(url);
  if (res.error) {
    return {
      url: String(url),
      reachable: false,
      error: res.error,
      redirects: res.redirects,
      summary: `Website could not be loaded: ${res.error}`,
    };
  }
  const finalUrl = new URL(res.finalUrl);
  const html = res.body || '';
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: true } });
  const q = (s) => root.querySelectorAll(s);
  const meta = (name) => root.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || root.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || null;

  const headings = {};
  const headingOutline = [];
  for (const lvl of [1, 2, 3, 4, 5, 6]) headings[`h${lvl}`] = q(`h${lvl}`).length;
  for (const h of q('h1,h2,h3').slice(0, 25)) headingOutline.push(`${h.tagName.toLowerCase()}: ${text(h).slice(0, 80)}`);

  const imgs = q('img');
  const imgsNoAlt = imgs.filter((i) => i.getAttribute('alt') === undefined || i.getAttribute('alt') === null);
  const lazy = imgs.filter((i) => (i.getAttribute('loading') || '').toLowerCase() === 'lazy').length;
  const modernFormats = imgs.filter((i) => /\.(webp|avif)(\?|$)/i.test(i.getAttribute('src') || '') || /webp|avif/i.test(i.getAttribute('srcset') || '')).length;

  const links = q('a[href]').map((a) => ({ href: a.getAttribute('href'), text: text(a).slice(0, 60) }));
  const internal = new Set();
  const external = new Set();
  const social = new Set();
  const tel = new Set();
  const mailto = new Set();
  for (const l of links) {
    const h = (l.href || '').trim();
    if (/^tel:/i.test(h)) tel.add(h.slice(4));
    else if (/^mailto:/i.test(h)) mailto.add(h.slice(7).split('?')[0]);
    else if (/^(#|javascript:)/i.test(h) || !h) continue;
    else {
      try {
        const abs = new URL(h, finalUrl);
        if (SOCIAL.test(abs.hostname + abs.pathname)) social.add(abs.href);
        if (abs.hostname.replace(/^www\./, '') === finalUrl.hostname.replace(/^www\./, '')) internal.add(abs.href.split('#')[0]);
        else external.add(abs.hostname);
      } catch { /* ignore bad hrefs */ }
    }
  }

  const bodyText = text(root.querySelector('body') || root).slice(0, 200000);
  const ctas = [...q('a,button')].map(text).filter((t) => t && t.length < 40 && CTA_WORDS.test(t));
  const years = [...bodyText.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const copyrightYear = years.length ? Math.max(...years) : null;
  const scripts = q('script[src]').map((s) => s.getAttribute('src'));
  const generator = meta('generator');
  const tech = [];
  const lower = html.toLowerCase();
  if (generator) tech.push(generator);
  for (const [name, re] of [['WordPress', /wp-content|wp-includes/], ['Wix', /wix\.com|wixstatic/], ['Squarespace', /squarespace/], ['Shopify', /cdn\.shopify|shopify/], ['Webflow', /webflow/], ['GoDaddy builder', /godaddy|secureserver/], ['Elementor', /elementor/], ['jQuery', /jquery/], ['Bootstrap', /bootstrap/], ['React/Next.js', /__next|react/]]) {
    if (re.test(lower) && !tech.includes(name)) tech.push(name);
  }

  const issues = [];
  const good = [];
  const add = (cond, bad, ok) => (cond ? issues.push(bad) : ok && good.push(ok));
  add(finalUrl.protocol !== 'https:', 'Site does not use HTTPS (shows "Not secure" in browsers).', 'Uses HTTPS.');
  add(!root.querySelector('meta[name="viewport"]'), 'No mobile viewport tag — likely poor on phones.', 'Has a mobile viewport tag.');
  add(!root.querySelector('title') || !text(root.querySelector('title')), 'Missing page title.', null);
  add(!meta('description'), 'Missing meta description (weak Google snippet).', 'Has a meta description.');
  add(headings.h1 === 0, 'No H1 heading.', null);
  add(headings.h1 > 1, `Multiple H1 headings (${headings.h1}).`, null);
  add(imgs.length > 0 && imgsNoAlt.length / imgs.length > 0.3, `${imgsNoAlt.length} of ${imgs.length} images have no alt text.`, null);
  add(!meta('og:title'), 'No Open Graph tags (poor link previews on WhatsApp/Facebook).', 'Has Open Graph tags.');
  add(tel.size === 0 && mailto.size === 0, 'No clickable phone or email link.', 'Has clickable phone/email.');
  add(q('form').length === 0, 'No enquiry/contact form.', 'Has a form.');
  add(ctas.length === 0, 'No clear call-to-action buttons found.', `Calls to action: ${[...new Set(ctas)].slice(0, 5).join(', ')}`);
  add(copyrightYear && copyrightYear < new Date().getFullYear() - 1, `Copyright year is ${copyrightYear} — site may be outdated.`, null);
  add(res.ms > 3000, `Slow server response (${(res.ms / 1000).toFixed(1)}s to load the HTML).`, null);
  add(res.bytes > 1_500_000, `Very large HTML (${Math.round(res.bytes / 1024)} KB).`, null);
  add(!TRUST_WORDS.test(bodyText), 'Few trust signals found (reviews, FAQ, policies).', null);
  add(/<table[^>]*width=|<font |<center>|<marquee/i.test(html), 'Uses very old HTML (tables/font tags) — dated design likely.', null);

  return {
    url: String(url),
    final_url: res.finalUrl,
    reachable: true,
    http_status: res.status,
    response_ms: res.ms,
    html_kb: Math.round(res.bytes / 1024),
    https: finalUrl.protocol === 'https:',
    redirects: res.redirects,
    title: text(root.querySelector('title')) || null,
    meta_description: meta('description'),
    robots: meta('robots'),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
    viewport: Boolean(root.querySelector('meta[name="viewport"]')),
    open_graph: Boolean(meta('og:title')),
    language: root.querySelector('html')?.getAttribute('lang') || null,
    headings,
    heading_outline: headingOutline,
    images: { total: imgs.length, missing_alt: imgsNoAlt.length, lazy_loaded: lazy, modern_format: modernFormats },
    links: { internal: internal.size, external_domains: external.size, sample_internal: [...internal].slice(0, 15) },
    forms: q('form').length,
    calls_to_action: [...new Set(ctas)].slice(0, 10),
    contact_links: { phone: [...tel].slice(0, 5), email: [...mailto].slice(0, 5) },
    social_links: [...social].slice(0, 10),
    copyright_year: copyrightYear,
    technology: tech,
    scripts: scripts.length,
    nav_items: q('nav a').map(text).filter(Boolean).slice(0, 15),
    text_sample: bodyText.slice(0, 1500),
    issues,
    strengths: good,
  };
}

export async function checkLinks(url, max = 25) {
  const page = await safeFetch(url);
  if (page.error) return { url, error: page.error };
  const base = new URL(page.finalUrl);
  const root = parse(page.body || '');
  const hrefs = new Set();
  for (const a of root.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href') || '';
    if (!h || /^(#|mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(h)) continue;
    try {
      const abs = new URL(h, base);
      if (abs.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '')) hrefs.add(abs.href.split('#')[0]);
    } catch { /* skip */ }
  }
  const list = [...hrefs].slice(0, Math.min(max, 50));
  const results = [];
  for (let i = 0; i < list.length; i += 5) {
    const batch = await Promise.all(list.slice(i, i + 5).map(async (h) => {
      let r = await safeFetch(h, { method: 'HEAD', timeoutMs: 10000 });
      if (!r.error && (r.status === 405 || r.status === 403)) r = await safeFetch(h, { timeoutMs: 10000, maxBytes: 200_000 });
      return { url: h, status: r.status || null, error: r.error || null };
    }));
    results.push(...batch);
  }
  const broken = results.filter((r) => r.error || r.status >= 400);
  return { page: page.finalUrl, checked: results.length, total_found: hrefs.size, broken };
}

export async function pageSpeed(w, url, strategy = 'mobile') {
  const u = normalizeUrl(url);
  const key = readSecrets(w).PAGESPEED_API_KEY;
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', u.href);
  api.searchParams.set('strategy', strategy === 'desktop' ? 'desktop' : 'mobile');
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) api.searchParams.append('category', c);
  if (key) api.searchParams.set('key', key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  let res;
  try {
    res = await fetch(api, { signal: ctrl.signal });
  } catch (e) {
    return { url: u.href, available: false, error: e.name === 'AbortError' ? 'PageSpeed Insights timed out' : e.message };
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    return {
      url: u.href,
      available: false,
      error: res.status === 429 ? 'PageSpeed Insights daily limit reached' : msg,
      hint: res.status === 429 && !key ? 'Add a free PAGESPEED_API_KEY to .prospect/secrets.env for a higher limit.' : undefined,
    };
  }
  const cats = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};
  const score = (c) => (cats[c]?.score == null ? null : Math.round(cats[c].score * 100));
  const field = data.loadingExperience?.metrics || {};
  const fv = (k) => (field[k] ? { p75: field[k].percentile, rating: field[k].category } : null);
  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === 'opportunity' && a.score !== null && a.score < 0.9)
    .sort((a, b) => (b.details?.overallSavingsMs || 0) - (a.details?.overallSavingsMs || 0))
    .slice(0, 6)
    .map((a) => `${a.title}${a.details?.overallSavingsMs ? ` (~${Math.round(a.details.overallSavingsMs)} ms)` : ''}`);
  return {
    url: u.href,
    strategy,
    available: true,
    scores: { performance: score('performance'), accessibility: score('accessibility'), best_practices: score('best-practices'), seo: score('seo') },
    lab: {
      lcp: audits['largest-contentful-paint']?.displayValue || null,
      cls: audits['cumulative-layout-shift']?.displayValue || null,
      tbt: audits['total-blocking-time']?.displayValue || null,
      fcp: audits['first-contentful-paint']?.displayValue || null,
      speed_index: audits['speed-index']?.displayValue || null,
    },
    field_data: Object.keys(field).length
      ? { lcp: fv('LARGEST_CONTENTFUL_PAINT_MS'), inp: fv('INTERACTION_TO_NEXT_PAINT'), cls: fv('CUMULATIVE_LAYOUT_SHIFT_SCORE') }
      : 'Not enough real-user data for this site',
    top_opportunities: opportunities,
  };
}
