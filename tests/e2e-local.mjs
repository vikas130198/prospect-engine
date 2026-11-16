// End-to-end test of the local pipeline through the real MCP server + CLI.
// Usage: node tests/e2e-local.mjs <workspace-with-installed-builder>
// Covers: lead → research → approval gate → audit → competitors → score → design → prototype → validate → build → QA,
// plus negative checks (duplicates, unapproved work, fabricated contacts, deploy-before-QA, email-before-deploy).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins', 'prospect');
const ws = path.resolve(process.argv[2] || 'D:/tmp/pe-ws');
const cli = path.join(plugin, 'dist', 'cli.mjs');

const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(plugin, 'dist', 'server.mjs')], cwd: ws, env: { ...process.env, PROSPECT_WORKSPACE: ws } });
const client = new Client({ name: 'e2e', version: '1.0.0' });
await client.connect(transport);

let step = 0;
async function call(name, args = {}, { expectError = false } = {}) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text || '';
  const label = `${++step}. ${name}${expectError ? ' (expect refusal)' : ''}`;
  if (expectError) {
    assert.ok(r.isError, `${label}: should have been refused but got ${text.slice(0, 200)}`);
    console.log(`✅ ${label}: ${text.split('\n')[0].slice(0, 110)}`);
    return text;
  }
  assert.ok(!r.isError, `${label} failed: ${text}`);
  console.log(`✅ ${label}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function runCli(...args) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: ws, encoding: 'utf8', timeout: 15 * 60_000 });
  const data = JSON.parse(r.stdout);
  console.log(`✅ ${++step}. cli ${args.join(' ')} → ${JSON.stringify(data).slice(0, 160)}`);
  return data;
}

const tools = await client.listTools();
console.log(`MCP server exposes ${tools.tools.length} tools`);
assert.ok(tools.tools.length >= 25);

const info = await call('workspace_info');
assert.equal(info.initialized, true);

// Clean previous run of this test lead.
fs.rmSync(path.join(ws, 'leads', 'harbour-lane-bakery'), { recursive: true, force: true });

const lead = await call('create_lead', { instagram_url: 'https://www.instagram.com/harbour.lane.bakery/?hl=en', notes: 'Found via local food hashtag', location: 'Brighton, UK' });
assert.equal(lead.id, 'harbour-lane-bakery');
await call('create_lead', { instagram_url: '@harbour.lane.bakery' }, { expectError: true });
await call('create_lead', { instagram_url: 'https://instagram.com/p/Cxyz123/' }, { expectError: true });
await call('save_website_audit', { lead_id: lead.id, official_website: null, verification: 'x', website_status: 'A', weaknesses: [], opportunities: [], recommended_website_type: 'x', suggested_sections: [], approach_reasons: [], report_markdown: 'x' }, { expectError: true });

await call('save_research', {
  lead_id: lead.id,
  business_name: 'Harbour Lane Bakery',
  industry: 'Bakery',
  location: 'Brighton, UK',
  website_found: null,
  data: {
    instagram: {
      followers: { value: null, status: 'unknown' },
      bio: { value: 'Sourdough & pastries baked daily', status: 'verified', source: 'User screenshot' },
    },
    business: {
      products: { value: 'Sourdough, croissants, celebration cakes', status: 'verified', source: 'User screenshot of posts' },
      audience: { value: 'Local residents and weekend visitors', status: 'ai_analysis' },
    },
    website_hypothesis: 'No website linked in bio; orders appear to be taken by DM.',
    missing: ['Follower count', 'Opening hours', 'Phone number'],
    sources: ['User-provided screenshot'],
  },
  report_markdown: '# Harbour Lane Bakery\n\nTest report.',
});
await call('set_stage', { lead_id: lead.id, stage: 'website_audit', status: 'RUNNING' }, { expectError: true });
await call('decide_lead', { lead_id: lead.id, decision: 'approve', user_words: 'proceed' });

await call('save_website_audit', {
  lead_id: lead.id,
  official_website: null,
  verification: 'No website in bio; search found only a directory listing with no site.',
  website_status: 'A',
  weaknesses: ['No website', 'Orders only through Instagram DMs'],
  opportunities: ['Online menu', 'Pre-order enquiry form', 'Google visibility'],
  recommended_website_type: 'Single-page bakery site with menu and pre-order enquiry',
  suggested_sections: ['hero', 'about', 'menu', 'features', 'faq', 'contact'],
  approach_reasons: ['Active posting but no place to see the menu or order outside Instagram'],
  report_markdown: '# Website audit\n\nNo website.',
});
await call('save_competitors', { lead_id: lead.id, competitors: [{ name: 'Example Bakehouse', website_url: 'https://example.org', source_url: 'https://example.org', observations: 'Clear menu and pre-order form.' }], report_markdown: '# Competitors' });
await call('save_score', { lead_id: lead.id, factors: { business_activity: { score: 11, reason: 'too high' } }, report_markdown: 'x' }, { expectError: true });
const score = await call('save_score', {
  lead_id: lead.id,
  factors: {
    business_activity: { score: 8, reason: 'Posts several times a week' },
    audience_visibility: { score: 6, reason: 'Follower count unknown; good local engagement in screenshots' },
    website_opportunity: { score: 24, reason: 'No website at all' },
    growth_potential: { score: 15, reason: 'Pre-orders and cakes could grow online' },
    contact_availability: { score: 8, reason: 'Instagram only so far' },
    business_fit: { score: 17, reason: 'Classic small-business landing page' },
  },
  report_markdown: '# Score',
});
assert.equal(score.total, 78);
assert.equal(score.priority, 'Medium');

const catalog = await call('design_catalog');
assert.ok(catalog.layouts.length >= 10 && Object.keys(catalog.themes).length >= 10);
assert.ok(catalog.motion_presets.cinematic && catalog.design_library);
const badMotion = await call('save_design', { lead_id: lead.id, layout: 'restaurant', theme: 'warm-bistro', motion: { preset: 'disco' }, reason: 'x', plan_markdown: 'x' }, { expectError: true });
assert.match(String(badMotion), /Unknown motion preset/);
const design = await call('save_design', { lead_id: lead.id, layout: 'restaurant', theme: 'warm-bistro', motion: { preset: 'cinematic', hero_effect: 'aurora' }, sections: ['hero', 'about', 'marquee', 'menu', 'features', { type: 'process', variant: 'stack' }, 'faq', 'contact'], reason: 'Warm artisan bakery feel', plan_markdown: '# Design plan' });
assert.equal(design.motion.preset, 'cinematic');
const proto = await call('create_prototype', { lead_id: lead.id });
assert.match(proto.code, /^[A-HJ-NP-Z2-9]{8}$/);

// Skeleton must not be buildable until placeholders in required fields are replaced.
const skeleton = await call('validate_prototype', { lead_id: lead.id });
assert.ok(skeleton.placeholders_count > 0);

// Fill in content like the prototype-builder agent would — first with a fabricated phone number.
const content = JSON.parse(fs.readFileSync(proto.content_file, 'utf8'));
content.meta = { title: 'Harbour Lane Bakery — Sourdough & pastries in Brighton', description: 'Sourdough, croissants and celebration cakes baked daily in Brighton. See the menu and send a pre-order enquiry.', lang: 'en' };
content.business.tagline = 'Sourdough & pastries baked daily';
const S = Object.fromEntries(content.sections.map((s) => [s.type, s]));
Object.assign(S.hero, { variant: 'split', eyebrow: 'Brighton bakery', heading: 'Sourdough and pastries, baked fresh every morning', subheading: 'See what is coming out of the oven and send a pre-order enquiry for cakes and bakes.', primary_cta: { label: 'See the menu', href: '#menu' }, secondary_cta: { label: 'Pre-order enquiry', href: '#contact' }, icon: 'chef-hat', visual_label: 'Baked daily in small batches', badges: ['Baked daily', 'Celebration cakes'] });
Object.assign(S.about, { heading: 'A small bakery with big flavour', body: ['Harbour Lane Bakery bakes sourdough, croissants and celebration cakes.', '[[Add the bakery story once confirmed with the owner]]'], highlights: [{ icon: 'leaf', title: 'Slow-fermented sourdough', text: 'Baked in small batches.' }] });
Object.assign(S.menu, { heading: 'From the oven', categories: [{ name: 'Bread', items: [{ name: 'Country sourdough', description: 'Crisp crust, open crumb.' }] }, { name: 'Pastries', items: [{ name: 'Butter croissant', description: 'Flaky and golden.' }] }], note: 'Prices to be confirmed with the bakery.' });
Object.assign(S.features, { heading: 'Why locals love it', items: [{ icon: 'clock', title: 'Fresh every morning', text: 'Bakes come out early.' }, { icon: 'gift', title: 'Celebration cakes', text: 'Made to order.' }, { icon: 'heart', title: 'Made by hand', text: 'Small-batch baking.' }] });
Object.assign(S.marquee, { items: ['Sourdough', 'Croissants', 'Celebration cakes', 'Baked daily'], icon: 'chef-hat' });
Object.assign(S.process, { heading: 'How pre-orders work', steps: [{ title: 'Send an enquiry', text: 'Tell the bakery what you need.' }, { title: 'Confirm', text: 'They confirm the details.' }, { title: 'Collect', text: 'Pick it up fresh.' }] });
assert.equal(content.motion.preset, 'cinematic');
Object.assign(S.faq, { items: [{ q: 'Can I pre-order a cake?', a: 'Send an enquiry with the date and the bakery will confirm.' }] });
Object.assign(S.contact, { heading: 'Order or say hello', intro: 'Send a pre-order enquiry.', info: { phone: '01273 555 0199', address: '[[Add address]]', email: '', whatsapp: '', hours: [] } });
fs.writeFileSync(proto.content_file, JSON.stringify(content, null, 2));
const bad = await call('validate_prototype', { lead_id: lead.id });
assert.equal(bad.ready_to_build, false);
assert.ok(bad.errors.some((e) => /not in the verified contacts/.test(e)), 'fabricated phone must be rejected');
console.log(`   ↳ fabricated phone rejected: "${bad.errors.find((e) => /phone/.test(e))}"`);
const badBuild = runCli('build', lead.id);
assert.equal(badBuild.ok, false);

// Fix: use a placeholder instead.
S.contact.info.phone = '[[Add phone number]]';
fs.writeFileSync(proto.content_file, JSON.stringify(content, null, 2));
const good = await call('validate_prototype', { lead_id: lead.id });
assert.equal(good.ready_to_build, true, JSON.stringify(good.errors));

const deployEarly = runCli('deploy', lead.id);
assert.equal(deployEarly.ok, false);
assert.match(deployEarly.error, /not been built|not passed QA/);

const build = runCli('build', lead.id);
assert.equal(build.ok, true, JSON.stringify(build));

const deployBeforeQa = runCli('deploy', lead.id);
assert.match(deployBeforeQa.error, /not passed QA/);

const qa = runCli('qa', lead.id);
console.log(`   ↳ QA ${qa.status}: ${qa.critical.length} critical, ${qa.warnings.length} warnings, lighthouse ${JSON.stringify(qa.lighthouse)}`);
for (const c of qa.critical) console.log(`     ❌ ${c}`);
for (const wrn of qa.warnings.slice(0, 8)) console.log(`     ⚠️  ${wrn}`);
assert.equal(qa.status, 'passed');
assert.ok(fs.existsSync(path.join(qa.screenshots_folder, 'mobile-375.jpg')));
assert.ok(fs.existsSync(path.join(qa.screenshots_folder, 'motion-desktop-1440-hero.jpg')), 'animation pass screenshot');

await call('save_email', { lead_id: lead.id, to: 'owner@example.com', subject: 'Hello', body: 'x'.repeat(250) }, { expectError: true });

const summary = await call('get_lead', { lead_id: lead.id, sections: ['stages'] });
console.log('Stages:', Object.entries(summary.stages).map(([k, v]) => `${k}=${v.status}`).join(' '));
assert.equal(summary.stages.qa.status, 'COMPLETED');
assert.equal(summary.next_stage.stage, 'deploy');

const dash = runCli('dashboard', '--no-open');
assert.ok(fs.existsSync(dash.file));
await client.close();
console.log('\nAll local end-to-end checks passed.');
