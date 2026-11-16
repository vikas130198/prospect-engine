// Unit tests for the engine's core rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInstagram, computeScore, mergeContacts } from '../plugins/prospect/src/lib/leads.mjs';
import { generateCode } from '../plugins/prospect/src/lib/codes.mjs';
import { validateContent, skeletonContent, motionProblems } from '../plugins/prospect/src/lib/content-check.mjs';
import { syncInbox, libraryStatus, saveAnalysis, updateEntry, listLibrary } from '../plugins/prospect/src/lib/design-library.mjs';
import { workspacePaths } from '../plugins/prospect/src/lib/paths.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkEmail } from '../plugins/prospect/src/lib/email.mjs';
import { assertPublicHost, normalizeUrl } from '../plugins/prospect/src/lib/net.mjs';

test('parseInstagram accepts common profile formats', () => {
  for (const s of ['https://www.instagram.com/the.coffee_house/', 'instagram.com/the.coffee_house?igsh=abc', '@the.coffee_house', 'the.coffee_house', 'http://instagram.com/The.Coffee_House']) {
    const r = parseInstagram(s);
    assert.equal(r.username, 'the.coffee_house');
    assert.equal(r.id, 'the-coffee_house');
  }
});

test('parseInstagram rejects posts, reels, other sites and bad names', () => {
  for (const s of ['https://instagram.com/p/C1x2/', 'https://www.instagram.com/reel/abc/', 'https://facebook.com/x', 'https://instagram.com/', 'bad..name', '']) {
    assert.throws(() => parseInstagram(s));
  }
});

const fullFactors = (o = {}) => ({
  business_activity: { score: 8, reason: 'Posts weekly' },
  audience_visibility: { score: 7, reason: 'Good local reach' },
  website_opportunity: { score: 22, reason: 'No website' },
  growth_potential: { score: 16, reason: 'Online orders possible' },
  contact_availability: { score: 12, reason: 'Public email found' },
  business_fit: { score: 17, reason: 'Good fit' },
  ...o,
});

test('computeScore totals, classifies and validates', () => {
  assert.deepEqual([computeScore(fullFactors()).total, computeScore(fullFactors()).priority], [82, 'High']);
  assert.equal(computeScore(fullFactors({ website_opportunity: { score: 2, reason: 'Site is already strong' } })).priority, 'Medium');
  assert.equal(computeScore(fullFactors({ website_opportunity: { score: 0, reason: 'Strong site' }, business_fit: { score: 2, reason: 'Big brand' }, growth_potential: { score: 3, reason: 'Limited growth potential' } })).priority, 'Reject');
  assert.throws(() => computeScore(fullFactors({ website_opportunity: { score: 30, reason: 'too high value' } })));
  assert.throws(() => computeScore(fullFactors({ business_fit: { score: 10, reason: '' } })));
  const { business_fit, ...missing } = fullFactors();
  assert.throws(() => computeScore(missing));
});

test('client codes are 8 unambiguous characters and do not repeat', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const c = generateCode();
    assert.match(c, /^[A-HJ-KM-NP-Z2-9]{8}$/);
    assert.ok(!/[01OIL]/.test(c));
    seen.add(c);
  }
  assert.equal(seen.size, 5000);
});

function content(mutator) {
  const c = skeletonContent({ layout: 'restaurant', theme: 'warm-bistro', business_name: 'Test Cafe', agency: { name: 'Studio' }, sections: ['hero', 'about', 'contact'] });
  c.meta = { title: 'Test Cafe — coffee in town', description: 'A friendly neighbourhood cafe serving coffee and bakes every day of the week.', lang: 'en' };
  c.sections[0].heading = 'Great coffee';
  c.sections[1].heading = 'About';
  c.sections[1].body = ['We serve coffee.'];
  mutator?.(c);
  return c;
}
const lead = { contacts: [{ type: 'phone', value: '+44 1273 555 0100', normalized: '+4412735550100' }, { type: 'email', value: 'hello@testcafe.co.uk', normalized: 'hello@testcafe.co.uk' }], facts: { hours: 'Mon–Fri 8–5' }, research: {} };

test('valid content with placeholders passes and lists placeholders', () => {
  const r = validateContent(content(), lead);
  assert.deepEqual(r.errors, []);
  assert.ok(r.placeholders.length > 0);
});

test('fabricated phone and email are rejected; verified ones are allowed', () => {
  let r = validateContent(content((c) => { c.sections[2].info.phone = '+44 1273 999 1234'; }), lead);
  assert.ok(r.errors.some((e) => /phone/.test(e)));
  r = validateContent(content((c) => { c.sections[2].info.email = 'owner@gmail.com'; }), lead);
  assert.ok(r.errors.some((e) => /email/.test(e)));
  r = validateContent(content((c) => { c.sections[2].info.phone = '01273 555 0100'; c.sections[2].info.email = 'hello@testcafe.co.uk'; }), lead);
  assert.deepEqual(r.errors, []);
});

test('prices and year ranges are not mistaken for phone numbers', () => {
  const r = validateContent(content((c) => { c.sections[1].body = ['Open since 2019 – 2024 renovations', 'Cakes from ₹1200 - 2500 (to be confirmed)']; }), lead);
  assert.ok(!r.errors.some((e) => /phone/.test(e)), r.errors.join('\n'));
});

test('fake reviews, unsourced stats and unsourced prices are rejected', () => {
  let r = validateContent(content((c) => c.sections.splice(2, 0, { type: 'testimonials', id: 'reviews', items: [{ quote: 'Amazing!', author: 'Sam' }] })), lead);
  assert.ok(r.errors.some((e) => /testimonials/.test(e)));
  r = validateContent(content((c) => c.sections.splice(2, 0, { type: 'stats', id: 'stats', items: [{ value: '500+', label: 'Happy customers' }] })), lead);
  assert.ok(r.errors.some((e) => /statistic/.test(e)));
  r = validateContent(content((c) => c.sections.splice(2, 0, { type: 'menu', id: 'menu', heading: 'Menu', categories: [{ name: 'Coffee', items: [{ name: 'Latte', price: '£3.50' }] }] })), lead);
  assert.ok(r.errors.some((e) => /price/.test(e)));
  r = validateContent(content((c) => c.sections.splice(2, 0, { type: 'menu', id: 'menu', heading: 'Menu', price_source: 'https://testcafe.co.uk/menu', categories: [{ name: 'Coffee', items: [{ name: 'Latte', price: '£3.50' }] }] })), lead);
  assert.ok(!r.errors.some((e) => /price/.test(e)));
});

test('structure errors: missing hero, broken nav link, unknown theme, duplicate ids', () => {
  assert.ok(validateContent(content((c) => c.sections.shift()), lead).errors.some((e) => /hero/.test(e)));
  assert.ok(validateContent(content((c) => c.nav.links.push({ label: 'Gallery', href: '#gallery' })), lead).errors.some((e) => /does not exist/.test(e)));
  assert.ok(validateContent(content((c) => { c.theme.preset = 'neon-pink'; }), lead).errors.some((e) => /theme/.test(e)));
  assert.ok(validateContent(content((c) => { c.sections[1].id = 'home'; }), lead).errors.some((e) => /duplicate/.test(e)));
});

test('unverified marketing claims raise warnings', () => {
  const r = validateContent(content((c) => { c.sections[0].subheading = 'Award-winning cafe with 10+ years of experience'; }), lead);
  assert.ok(r.warnings.some((w) => /award/i.test(w)));
});

test('email checks: recipient must be a sourced contact, link required, opt-out advised', () => {
  const l = { contacts: [{ type: 'email', normalized: 'hello@testcafe.co.uk', verification: 'verified', confidence: 'high' }], deployment: { url: 'https://p.example.com/client/ABCDEFGH/' } };
  const cfg = { agency: { name: 'Studio' } };
  const body = `Hi Test Cafe team,\n\nI'm Alex from Studio. I noticed your weekend bakes sell out fast on Instagram, but there is no website where people can see the menu.\n\nI made a free concept of what a site could look like:\nhttps://p.example.com/client/ABCDEFGH/\n\nHappy to walk you through it. If this isn't useful, just let me know and I won't follow up.\n\nAlex, Studio`;
  assert.deepEqual(checkEmail(l, cfg, { to: 'hello@testcafe.co.uk', subject: 'A website concept for Test Cafe', body }).errors, []);
  assert.ok(checkEmail(l, cfg, { to: 'guess@testcafe.co.uk', subject: 'A website concept for Test Cafe', body }).errors.length);
  assert.ok(checkEmail(l, cfg, { to: 'hello@testcafe.co.uk', subject: 'A website concept', body: body.replace('https://p.example.com/client/ABCDEFGH/', '') }).errors.some((e) => /link/.test(e)));
  assert.ok(checkEmail(l, cfg, { to: 'hello@testcafe.co.uk', subject: 'Act now — guaranteed results', body: body.replace("If this isn't useful, just let me know and I won't follow up.", '') }).warnings.length >= 2);
});

test('contacts need sources; WhatsApp needs public link evidence to be verified', () => {
  assert.throws(() => mergeContacts([], [{ type: 'email', value: 'a@b.com' }]));
  assert.throws(() => mergeContacts([], [{ type: 'whatsapp', value: '+441234567890', source_url: 'https://site.com/contact', verification: 'verified' }]));
  const ok = mergeContacts([], [{ type: 'whatsapp', value: '+441234567890', source_url: 'https://site.com/contact', evidence: 'https://wa.me/441234567890', verification: 'verified' }]);
  assert.equal(ok.length, 1);
  const merged = mergeContacts(ok, [{ type: 'whatsapp', value: '+44 1234 567890', source_url: 'https://site.com/', evidence: 'https://wa.me/441234567890', verification: 'verified' }]);
  assert.equal(merged.length, 1);
});

test('SSRF protection refuses private and local addresses', async () => {
  for (const u of ['http://localhost:3000', 'http://127.0.0.1', 'http://10.0.0.5', 'http://192.168.1.1', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/']) {
    await assert.rejects(assertPublicHost(normalizeUrl(u)), u);
  }
  assert.throws(() => normalizeUrl('file:///etc/passwd'));
  assert.throws(() => normalizeUrl('https://user:pass@example.com'));
});

import { extractFrom } from '../plugins/prospect/src/lib/contacts.mjs';
test('contact extraction finds real contacts and ignores code samples and look-alike domains', () => {
  const html = `<body><p>Call us: +44 1273 555 0100</p><p>Phone (01273) 555-0101</p>
  <a href="mailto:hello@testcafe.co.uk">Email</a><a href="https://wa.me/441273555010">WhatsApp</a>
  <a href="https://www.instagram.com/testcafe/">IG</a><a href="http://twistedmatrix.com/">Twisted</a>
  <pre>for i in range(1000) 0 1 1 2 3 5 8</pre><p>Contact a+b 2019 2020 2021 2022</p>
  <p>Write to info [at] testcafe [dot] co [dot] uk</p></body>`;
  const found = extractFrom('https://testcafe.co.uk/contact', html).found;
  const has = (type, v) => found.some((c) => c.type === type && c.value.replace(/\s/g, '').includes(v));
  assert.ok(has('phone', '+4412735550100'));
  assert.ok(has('phone', '(01273)555-0101'));
  assert.ok(has('email', 'hello@testcafe.co.uk'));
  assert.ok(has('whatsapp', '+441273555010'));
  assert.ok(has('social', 'instagram.com/testcafe'));
  assert.ok(!found.some((c) => /twistedmatrix/.test(c.value)), 'look-alike domain is not social');
  assert.ok(!found.some((c) => c.type === 'phone' && /1000|2019/.test(c.value)), 'code samples and years are not phones');
});

test('motion settings are validated against the template presets', () => {
  assert.deepEqual(motionProblems({ preset: 'cinematic', hero_effect: 'parallax' }).errors, []);
  assert.match(motionProblems({ preset: 'disco' }).errors[0], /Unknown motion preset/);
  assert.match(motionProblems({ preset: 'elegant', cursor: 'yes' }).errors[0], /true or false/);
  assert.match(motionProblems({ preset: 'elegant', reveal: 'explode' }).errors[0], /one of/);
  assert.ok(motionProblems(undefined).warnings.length);
  const sk = skeletonContent({ layout: 'fine-dining', business_name: 'X' });
  assert.equal(sk.motion.preset, 'cinematic');
  const sk2 = skeletonContent({ layout: 'restaurant', business_name: 'X', sections: ['hero', 'marquee', 'contact'], motion: { preset: 'bold' } });
  assert.equal(sk2.motion.preset, 'bold');
  assert.ok(sk2.sections.some((x) => x.type === 'marquee'));
});

test('section variants and marquee are validated', () => {
  const c = skeletonContent({ layout: 'restaurant', business_name: 'Cafe', sections: ['hero', { type: 'gallery', variant: 'carousel' }, 'marquee', 'contact'] });
  c.sections[2].items = ['Coffee', 42];
  const r = validateContent(c, { contacts: [], facts: {} });
  assert.ok(r.errors.some((e) => /variant must be one of/.test(e)));
  assert.ok(r.errors.some((e) => /items must be short text/.test(e)));
});

test('design library indexes inbox files once and tracks analysis', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-lib-'));
  const w = workspacePaths(root);
  fs.mkdirSync(path.join(root, 'design-library', 'inbox'), { recursive: true });
  fs.writeFileSync(path.join(root, 'design-library', 'inbox', 'Dark Hero.mp4'), 'fake');
  fs.writeFileSync(path.join(root, 'design-library', 'inbox', 'shot.png'), 'fake');
  fs.writeFileSync(path.join(root, 'design-library', 'inbox', 'notes.txt'), 'ignored');
  const idx = syncInbox(w);
  assert.equal(idx.entries.length, 2);
  let st = libraryStatus(w);
  assert.deepEqual(st.needs_frames, ['dark-hero']);
  assert.equal(st.needs_analysis[0].id, 'shot');
  syncInbox(w);
  assert.equal(libraryStatus(w).total, 2, 'no duplicates on rescan');
  const mapping = { motion: { preset: 'tech' } };
  saveAnalysis(w, 'shot', { title: 'Grid tech', summary: 's', style_keywords: [], mood: ['modern'], layout_patterns: [], motion: {}, suits: ['modern B2B'], template_mapping: mapping });
  assert.equal(listLibrary(w)[0].title, 'Grid tech');
  assert.throws(() => saveAnalysis(w, 'dark-hero', { title: 'x' }), /not ready/);
  updateEntry(w, 'shot', { remove: true });
  syncInbox(w);
  assert.equal(libraryStatus(w).total, 1, 'removed file stays removed');
  fs.rmSync(path.join(root, 'design-library', 'inbox', 'Dark Hero.mp4'));
  syncInbox(w);
  assert.deepEqual(libraryStatus(w).missing, ['dark-hero']);
  fs.rmSync(root, { recursive: true, force: true });
});
