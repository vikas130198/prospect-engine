// Engine 5: automated testing of a built prototype with a real browser (Playwright) and optional Lighthouse.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadConfig } from './config.mjs';
import { getLead, logActivity, requireApproved, saveLead, setStage } from './leads.mjs';
import { currentVersion, distDir } from './prototype.mjs';
import { leadDir } from './paths.mjs';
import { dirSize, ensureDir, exists, now, removeDir, run, UserError, writeJSON, writeText } from './util.mjs';

export const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'desktop-1366', width: 1366, height: 768, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain' };

/** Serve dist at /client/<code>/ exactly like production. */
function serve(dir, code) {
  const prefix = `/client/${code}/`;
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === `/client/${code}`) {
      res.writeHead(301, { location: prefix });
      return res.end();
    }
    if (!p.startsWith(prefix)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    let rel = p.slice(prefix.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(dir, rel);
    if (!file.startsWith(path.resolve(dir) + path.sep) && file !== path.resolve(dir)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'x-robots-tag': 'noindex, nofollow' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}${prefix}` })));
}

function chromeCandidates() {
  const c = [];
  if (process.env.CHROME_PATH) c.push(process.env.CHROME_PATH);
  if (process.platform === 'win32') {
    for (const base of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      c.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      c.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge');
  }
  return c;
}

export function findChrome() {
  return chromeCandidates().find(exists) || null;
}

export function loadPlaywright(w) {
  try {
    const req = createRequire(path.join(w.builder, 'package.json'));
    return req('playwright-core');
  } catch {
    throw new UserError('The testing browser components are not installed.', 'Run /prospect:setup and choose "Install components".');
  }
}

// Runs inside the page: collects layout / SEO / accessibility facts.
function pageProbe() {
  const vw = document.documentElement.clientWidth;
  const out = { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, overflowing: [], smallText: 0, smallTargets: [], images: [], headings: [], anchors: [], linksNoHref: 0, externalNoRel: 0 };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.visibility === 'hidden') continue;
    if (r.right > vw + 1 && out.overflowing.length < 6) {
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/(hidden|clip|auto|scroll)/.test(ps.overflowX)) {
          if (p.getBoundingClientRect().right <= vw + 1) clipped = true;
          break;
        }
      }
      if (!clipped) out.overflowing.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''} (right edge ${Math.round(r.right)}px > ${vw}px)`);
    }
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 12) out.smallText++;
  }
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // visually hidden (e.g. skip links)
    if ((r.height < 32 || r.width < 32) && out.smallTargets.length < 8 && !el.closest('p, li, dd, footer p')) out.smallTargets.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const img of document.images) {
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    out.images.push({
      src: img.currentSrc || img.src,
      alt: img.getAttribute('alt'),
      complete: img.complete,
      natural: [img.naturalWidth, img.naturalHeight],
      rendered: [Math.round(r.width), Math.round(r.height)],
      fit: cs.objectFit,
      sameOrigin: (img.currentSrc || img.src).startsWith(location.origin),
    });
  }
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) out.headings.push({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 60) });
  for (const a of document.querySelectorAll('a')) {
    const href = a.getAttribute('href');
    if (href === null) {
      out.linksNoHref++;
      continue;
    }
    if (href.startsWith('#') && href.length > 1) out.anchors.push({ href, exists: Boolean(document.getElementById(href.slice(1))), text: a.textContent.trim().slice(0, 30) });
    if (/^https?:/.test(href) && !href.startsWith(location.origin) && a.target === '_blank' && !/noopener/.test(a.rel)) out.externalNoRel++;
  }
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute('content') || null;
  out.title = document.title;
  out.description = meta('description');
  out.robots = meta('robots');
  out.lang = document.documentElement.lang;
  out.ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || null;
  out.code = document.querySelector('[data-prospect-code]')?.getAttribute('data-prospect-code') || null;
  out.hasDemoForm = Boolean(document.querySelector('[data-demo-form]'));
  out.hasMobileMenuButton = Boolean(document.querySelector('button[aria-controls="mobile-menu"]'));
  return out;
}

async function testViewport(browser, url, vp, shotDir, origin) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failed = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 300)));
  // Browsers probe /favicon.ico at the site root on their own; that is not part of the prototype.
  const browserProbe = (u) => /\/favicon\.ico(\?|$)/.test(u);
  page.on('requestfailed', (r) => {
    if (!browserProbe(r.url())) failed.push({ url: r.url(), error: r.failure()?.errorText, sameOrigin: r.url().startsWith(origin) });
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !browserProbe(r.url())) failed.push({ url: r.url(), error: `HTTP ${r.status()}`, sameOrigin: r.url().startsWith(origin) });
  });
  const critical = [];
  const warnings = [];
  const passed = [];
  let resp;
  try {
    resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    try {
      resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      warnings.push('Page never became fully network-idle (an external resource kept loading).');
    } catch (e2) {
      critical.push(`Page failed to load: ${e2.message.split('\n')[0]}`);
      await ctx.close();
      return { viewport: vp.name, critical, warnings, passed };
    }
  }
  if (!resp || resp.status() !== 200) critical.push(`Page returned HTTP ${resp?.status()}.`);
  await page.waitForTimeout(400);
  const p = await page.evaluate(pageProbe);

  if (!p.code) critical.push('The React app did not render (no content found) — check for JavaScript errors.');
  else passed.push('App rendered');
  if (p.scrollWidth > p.clientWidth + 1) critical.push(`Horizontal scrolling: page is ${p.scrollWidth}px wide on a ${p.clientWidth}px screen. Culprits: ${p.overflowing.join('; ') || 'unknown'}`);
  else passed.push('No horizontal overflow');
  const broken = p.images.filter((i) => i.complete && i.natural[0] === 0);
  if (broken.length) (broken.some((b) => b.sameOrigin) ? critical : warnings).push(`Images failed to load: ${broken.map((b) => b.src).slice(0, 5).join(', ')}`);
  else if (p.images.length) passed.push(`${p.images.length} images load`);
  for (const i of p.images) {
    if (i.natural[0] && i.rendered[0] && !['cover', 'contain', 'scale-down'].includes(i.fit)) {
      const nr = i.natural[0] / i.natural[1];
      const rr = i.rendered[0] / i.rendered[1];
      if (Math.abs(nr - rr) / nr > 0.06) warnings.push(`Image looks stretched (${i.src.split('/').pop()}).`);
    }
  }
  if (p.smallText > 3) warnings.push(`${p.smallText} pieces of text are smaller than 12px.`);
  if (vp.mobile && p.smallTargets.length) warnings.push(`Small tap targets on mobile: ${p.smallTargets.slice(0, 4).join('; ')}`);
  const pageErr = pageErrors.length ? pageErrors : [];
  // A bare "404" console message carries no URL; it is only an error if a real prototype file failed.
  const consoleErr = consoleErrors
    .filter((e) => !(/status of 404/.test(e) && !failed.some((f) => f.sameOrigin)))
    .filter((e) => !/fonts\.(googleapis|gstatic)|favicon|ERR_BLOCKED_BY_CLIENT|maps\.google|google\.com\/maps/i.test(e));
  if (pageErr.length) critical.push(`JavaScript errors: ${pageErr.slice(0, 3).join(' | ')}`);
  if (consoleErr.length) critical.push(`Console errors: ${consoleErr.slice(0, 3).join(' | ')}`);
  if (!pageErr.length && !consoleErr.length) passed.push('No JavaScript errors');
  const localFail = failed.filter((f) => f.sameOrigin);
  if (localFail.length) critical.push(`Missing files: ${localFail.slice(0, 5).map((f) => `${f.url.replace(origin, '')} (${f.error})`).join(', ')}`);
  const extFail = failed.filter((f) => !f.sameOrigin && !/google\.com\/maps|maps\.google/.test(f.url));
  if (extFail.length) warnings.push(`External resources failed: ${extFail.slice(0, 3).map((f) => new URL(f.url).hostname).join(', ')}`);

  // Functional: mobile menu.
  if (vp.width < 1024 && p.hasMobileMenuButton) {
    try {
      await page.click('button[aria-controls="mobile-menu"]');
      await page.waitForSelector('#mobile-menu', { state: 'visible', timeout: 3000 });
      const firstLink = page.locator('#mobile-menu a[href^="#"]').first();
      if (await firstLink.count()) {
        await firstLink.click();
        await page.waitForTimeout(300);
        if (await page.locator('#mobile-menu').isVisible()) warnings.push('Mobile menu stays open after choosing a link.');
      }
      passed.push('Mobile menu opens');
    } catch {
      critical.push('Mobile menu button does not open the menu.');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // Functional: demo form validation + confirmation (desktop + one mobile).
  if (p.hasDemoForm && ['mobile-375', 'desktop-1366'].includes(vp.name)) {
    try {
      const form = page.locator('[data-demo-form]');
      await form.locator('button[type="submit"]').click();
      await page.waitForTimeout(200);
      const errs = await page.locator('[data-field-error]').count();
      if (!errs) critical.push('Form accepted an empty submission (required-field validation missing).');
      const inputs = form.locator('input, textarea, select');
      const n = await inputs.count();
      for (let i = 0; i < n; i++) {
        const el = inputs.nth(i);
        const tag = await el.evaluate((e) => e.tagName.toLowerCase());
        const type = (await el.getAttribute('type')) || '';
        if (tag === 'select') {
          const opts = await el.locator('option:not([disabled])').count();
          if (opts) await el.selectOption({ index: 1 });
        } else if (type === 'email') await el.fill('preview.test@example.com');
        else if (type === 'tel') await el.fill('+10000000000');
        else if (type === 'date') await el.fill('2030-01-15');
        else if (type === 'number') await el.fill('2');
        else await el.fill('Preview test message');
      }
      await form.locator('button[type="submit"]').click();
      await page.waitForSelector('[data-demo-success]', { timeout: 3000 });
      passed.push('Form validates and shows the preview confirmation');
    } catch (e) {
      critical.push(`Form test failed: ${e.message.split('\n')[0]}`);
    }
  }

  ensureDir(shotDir);
  const shot = path.join(shotDir, `${vp.name}.jpg`);
  try {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot, fullPage: true, type: 'jpeg', quality: 70 });
  } catch {
    warnings.push('Could not save a screenshot.');
  }
  await ctx.close();
  return { viewport: vp.name, critical, warnings, passed, probe: p, screenshot: shot };
}

/**
 * Animations ON (the other viewports run with reduced motion): scroll the whole page like a visitor and make sure
 * every animated element ends up visible, nothing overflows sideways and no script errors occur.
 */
async function testMotion(browser, url, vp, shotDir) {
  const name = `motion-${vp.name}`;
  const critical = [];
  const warnings = [];
  const passed = [];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|favicon|maps\.google|google\.com\/maps|status of 404/i.test(m.text())) errors.push(m.text().slice(0, 300));
  });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(2600); // opening curtain + hero entrance
    ensureDir(shotDir);
    await page.screenshot({ path: path.join(shotDir, `${name}-hero.jpg`), type: 'jpeg', quality: 70 });
    const info = await page.evaluate(() => ({ motion: document.documentElement.classList.contains('motion'), preset: document.querySelector('[data-motion-preset]')?.getAttribute('data-motion-preset') || null, curtain: Boolean(document.querySelector('.intro-curtain')) }));
    if (info.curtain) critical.push('The opening curtain is still covering the page after 2.6 seconds.');
    if (!info.motion) warnings.push('Animations did not switch on (motion class missing).');
    else passed.push(`Animations run (${info.preset || 'default'} preset)`);
    const step = Math.round(vp.height * 0.55);
    let y = 0;
    for (let i = 0; i < 80; i++) {
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      if (y >= h) break;
      y += step;
      await page.mouse.wheel(0, step).catch(() => {});
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(1600);
    const r = await page.evaluate(() => {
      const label = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 40)}"`;
      const stuck = [...document.querySelectorAll('[data-reveal]')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (!e.classList.contains('is-in') || Number(getComputedStyle(e).opacity) < 0.5);
      });
      return { stuck: stuck.slice(0, 6).map(label), stuckCount: stuck.length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    if (r.stuckCount) critical.push(`${r.stuckCount} animated elements never became visible after scrolling: ${r.stuck.join('; ')}`);
    else passed.push('All scroll animations reveal their content');
    if (r.sw > r.cw + 1) critical.push(`With animations on, the page scrolls sideways (${r.sw}px wide on a ${r.cw}px screen).`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.4));
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(shotDir, `${name}-scrolled.jpg`), type: 'jpeg', quality: 70 });
  } catch (e) {
    warnings.push(`Animation test could not finish: ${e.message.split('\n')[0]}`);
  }
  if (errors.length) critical.push(`JavaScript errors with animations on: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
  await ctx.close();
  return { viewport: name, critical, warnings, passed, screenshot: path.join(shotDir, `${name}-hero.jpg`) };
}

function seoChecks(p) {
  const critical = [];
  const warnings = [];
  const passed = [];
  if (!p.title) critical.push('Page title is missing.');
  else passed.push('Title present');
  if (!p.description) critical.push('Meta description is missing.');
  else passed.push('Meta description present');
  if (!/noindex/i.test(p.robots || '')) critical.push('The preview is missing its "noindex" directive — it could appear in Google.');
  else passed.push('Preview is marked noindex');
  const h1 = p.headings.filter((h) => h.level === 1).length;
  if (h1 !== 1) critical.push(`Page should have exactly one H1 heading (found ${h1}).`);
  else passed.push('Exactly one H1');
  let prev = 1;
  for (const h of p.headings) {
    if (h.level > prev + 1) {
      warnings.push(`Heading level jumps from H${prev} to H${h.level} ("${h.text}").`);
      break;
    }
    prev = h.level;
  }
  const noAlt = p.images.filter((i) => i.alt === null);
  if (noAlt.length) critical.push(`${noAlt.length} images have no alt attribute.`);
  else if (p.images.length) passed.push('All images have alt attributes');
  const badAnchors = p.anchors.filter((a) => !a.exists);
  if (badAnchors.length) critical.push(`Links point to sections that do not exist: ${[...new Set(badAnchors.map((a) => a.href))].join(', ')}`);
  else passed.push('All internal links work');
  if (p.linksNoHref) warnings.push(`${p.linksNoHref} links have no href (not crawlable or keyboard-accessible).`);
  if (p.externalNoRel) warnings.push(`${p.externalNoRel} external links open in a new tab without rel="noopener".`);
  if (!p.lang) warnings.push('The page has no language attribute.');
  if (!p.ogTitle) warnings.push('No Open Graph title (link previews will be plain).');
  return { critical, warnings, passed };
}

async function lighthouse(w, url, chrome) {
  let cli;
  try {
    cli = createRequire(path.join(w.builder, 'package.json')).resolve('lighthouse/cli/index.js');
  } catch {
    return { available: false, reason: 'Lighthouse is not installed (optional). Install it with /prospect:setup → Install components.' };
  }
  const out = path.join(w.internal, 'lighthouse-tmp.json');
  const res = await run(process.execPath, [cli, url, '--quiet', '--output=json', `--output-path=${out}`, '--only-categories=performance,accessibility,best-practices,seo', '--form-factor=mobile', '--screenEmulation.mobile', `--chrome-flags=--headless=new --no-first-run`], {
    env: { CHROME_PATH: chrome },
    timeoutMs: 180000,
  }).catch((e) => ({ code: 1, stderr: e.message }));
  if (res.code !== 0 || !exists(out)) return { available: false, reason: `Lighthouse could not run: ${(res.stderr || '').split('\n').slice(-3).join(' ').slice(0, 300)}` };
  const data = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(out, { force: true });
  const s = (k) => (data.categories?.[k]?.score == null ? null : Math.round(data.categories[k].score * 100));
  return {
    available: true,
    scores: { performance: s('performance'), accessibility: s('accessibility'), best_practices: s('best-practices'), seo: s('seo') },
    lcp: data.audits?.['largest-contentful-paint']?.displayValue,
    cls: data.audits?.['cumulative-layout-shift']?.displayValue,
    tbt: data.audits?.['total-blocking-time']?.displayValue,
    note: 'Local test run; SEO score is lower on purpose because previews are noindex.',
  };
}

export async function runQA(w, leadId, { skipLighthouse = false } = {}) {
  const lead = getLead(w, leadId);
  requireApproved(lead);
  const { code, v, meta } = currentVersion(lead);
  if (meta?.build?.status !== 'passed') throw new UserError(`Version v${v} has not been built successfully yet.`, `Run the build first (node cli.mjs build ${leadId}).`);
  const dir = distDir(w, code, v);
  if (!exists(path.join(dir, 'index.html'))) throw new UserError('The built files are missing.', 'Rebuild the prototype.');
  const cfg = loadConfig(w);
  const maxRuns = 1 + (cfg.limits[cfg.mode]?.fix_attempts ?? 2);
  setStage(w, lead, 'qa', 'RUNNING');
  const attempt = getLead(w, leadId).stages.qa.attempts;

  const pw = loadPlaywright(w);
  const chrome = findChrome();
  let browser;
  try {
    browser = await pw.chromium.launch(chrome ? { executablePath: chrome, headless: true } : { headless: true });
  } catch (e) {
    const l = getLead(w, leadId);
    setStage(w, l, 'qa', 'FAILED', { error: 'Browser could not start' });
    throw new UserError(`Could not start a browser for testing: ${e.message.split('\n')[0]}`, 'Install Google Chrome (or Microsoft Edge), then run /prospect:doctor.');
  }
  const { server, url } = await serve(dir, code);
  const origin = new URL(url).origin;
  const reportDir = path.join(leadDir(w, leadId), 'qa', `v${v}`);
  removeDir(reportDir);
  ensureDir(reportDir);
  const results = [];
  try {
    for (const vp of VIEWPORTS) results.push(await testViewport(browser, url, vp, path.join(reportDir, 'screenshots'), origin));
    for (const vp of VIEWPORTS.filter((x) => ['mobile-390', 'desktop-1440'].includes(x.name))) results.push(await testMotion(browser, url, vp, path.join(reportDir, 'screenshots')));
  } finally {
    await browser.close().catch(() => {});
  }
  const seo = results[3]?.probe ? seoChecks(results[3].probe) : { critical: ['Page could not be analysed.'], warnings: [], passed: [] };
  const lh = skipLighthouse || !chrome ? { available: false, reason: skipLighthouse ? 'Skipped' : 'No Chrome found for Lighthouse' } : await lighthouse(w, url, chrome);
  server.close();

  const size = dirSize(dir);
  const assetWarnings = [];
  for (const f of size.files) {
    if (/\.(jpe?g|png|webp|avif|gif)$/i.test(f.file) && f.size > 400_000) assetWarnings.push(`Large image ${f.file} (${Math.round(f.size / 1024)} KB) — compress it.`);
    if (/\.js$/.test(f.file) && f.size > 450_000) assetWarnings.push(`Large JavaScript bundle ${f.file} (${Math.round(f.size / 1024)} KB).`);
  }
  if (size.total > 6_000_000) assetWarnings.push(`Prototype is ${Math.round(size.total / 1024 / 1024)} MB in total — reduce image sizes.`);
  const lhWarnings = [];
  if (lh.available) {
    if (lh.scores.accessibility != null && lh.scores.accessibility < 85) lhWarnings.push(`Lighthouse accessibility score is ${lh.scores.accessibility}.`);
    if (lh.scores.performance != null && lh.scores.performance < 60) lhWarnings.push(`Lighthouse performance score is ${lh.scores.performance}.`);
  }

  const critical = [];
  const warnings = new Set();
  const passed = new Set();
  for (const r of results) {
    for (const c of r.critical) critical.push(`[${r.viewport}] ${c}`);
    for (const x of r.warnings) warnings.add(`[${r.viewport}] ${x}`);
    for (const x of r.passed) passed.add(x);
  }
  critical.push(...seo.critical.map((x) => `[seo] ${x}`));
  seo.warnings.forEach((x) => warnings.add(`[seo] ${x}`));
  seo.passed.forEach((x) => passed.add(x));
  assetWarnings.forEach((x) => warnings.add(`[assets] ${x}`));
  lhWarnings.forEach((x) => warnings.add(`[lighthouse] ${x}`));

  const status = critical.length ? 'failed' : 'passed';
  const report = {
    lead_id: leadId,
    client_code: code,
    version: v,
    build_hash: meta.build.hash,
    tested_at: now(),
    browser: chrome ? path.basename(chrome) : 'bundled chromium',
    viewports: [...VIEWPORTS.map((x) => `${x.width}px`), 'animations on: 390px + 1440px'],
    attempt,
    status,
    critical,
    warnings: [...warnings],
    passed: [...passed],
    lighthouse: lh,
    total_kb: Math.round(size.total / 1024),
    screenshots: results.map((r) => r.screenshot).filter(Boolean),
  };
  writeJSON(path.join(reportDir, 'report.json'), report);
  writeText(path.join(reportDir, 'report.md'), [
    `# QA report — ${lead.business_name || leadId} (${code} v${v})`,
    '',
    `- Tested: ${report.tested_at} with ${report.browser}`,
    `- Viewports: ${report.viewports.join(', ')}`,
    `- Attempt: ${attempt} of ${maxRuns}`,
    `- **Result: ${status.toUpperCase()}**`,
    '',
    '## Critical (block deployment)',
    ...(critical.length ? critical.map((c) => `- ❌ ${c}`) : ['- None']),
    '',
    '## Warnings',
    ...(report.warnings.length ? report.warnings.map((c) => `- ⚠️ ${c}`) : ['- None']),
    '',
    '## Passed',
    ...report.passed.map((c) => `- ✅ ${c}`),
    '',
    '## Lighthouse (mobile, local)',
    lh.available ? `Performance ${lh.scores.performance} · Accessibility ${lh.scores.accessibility} · Best practices ${lh.scores.best_practices} · SEO ${lh.scores.seo} (noindex lowers SEO on purpose)` : `Not run: ${lh.reason}`,
    '',
    '## Screenshots',
    ...report.screenshots.map((s) => `- ${path.relative(leadDir(w, leadId), s).replace(/\\/g, '/')}`),
  ].join('\n') + '\n');

  const l = getLead(w, leadId);
  l.prototype.versions[v].qa = { status, at: report.tested_at, build_hash: meta.build.hash, critical: critical.length, warnings: report.warnings.length, report: path.join(reportDir, 'report.md') };
  saveLead(w, l);
  if (status === 'passed') setStage(w, l, 'qa', 'COMPLETED', { note: `Passed on attempt ${attempt}` });
  else if (attempt >= maxRuns) setStage(w, l, 'qa', 'REQUIRES_MANUAL_REVIEW', { error: `${critical.length} critical problems after ${attempt} attempts` });
  else setStage(w, l, 'qa', 'FAILED', { error: `${critical.length} critical problems` });
  logActivity(w, leadId, 'qa', `QA ${status} for ${code} v${v} (${critical.length} critical, ${report.warnings.length} warnings)`);

  return {
    status,
    version: v,
    attempt,
    attempts_allowed: maxRuns,
    repairs_left: Math.max(0, maxRuns - attempt),
    critical,
    warnings: report.warnings.slice(0, 15),
    passed_count: report.passed.length,
    lighthouse: lh.available ? lh.scores : lh.reason,
    report: path.join(reportDir, 'report.md'),
    screenshots_folder: path.join(reportDir, 'screenshots'),
  };
}
