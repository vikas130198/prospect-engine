// Prospect Engine MCP server: fast, structured tools Claude uses for every engine.
// Long-running jobs (install, build, QA, deploy) live in cli.mjs and are run through Bash.
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { auditWebsite, checkLinks, pageSpeed } from './lib/audit.mjs';
import { configProblems, initWorkspace, loadConfig, secretStatus, updateConfig } from './lib/config.mjs';
import { extractContacts } from './lib/contacts.mjs';
import { listLayouts, loadThemes, SECTION_TYPES } from './lib/content-check.mjs';
import { prototypeOverview } from './lib/deploy.mjs';
import { recordDraft, saveEmail } from './lib/email.mjs';
import { instagramLookup } from './lib/instagram.mjs';
import {
  addSuppression, allLeads, CONTACT_TYPES, compactLead, computeScore, createLead, decideLead, getLead, logActivity, mergeContacts,
  nextStage, readActivity, reportPath, requireApproved, requireStageDone, resetFrom, saveLead, saveReport, setStage, STAGE_LABELS,
  STAGES, STAGE_STATES, updateLead, WEBSITE_STATUSES, MANUAL_STATUSES,
} from './lib/leads.mjs';
import { CLI_PATH, findWorkspace, PLUGIN_ROOT, requireWorkspace } from './lib/paths.mjs';
import { checkContent, createPrototype, newVersion, restoreVersion } from './lib/prototype.mjs';
import { addReference, listReferences, REFERENCE_CATEGORIES, removeReference, scanReferences, updateReference, ensureReferenceFolders } from './lib/references.mjs';
import { formatError, exists, truncate } from './lib/util.mjs';

const server = new McpServer({ name: 'prospect', version: '1.0.0' });

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: formatError(e) }] });

function tool(name, description, shape, handler) {
  server.registerTool(name, { description, inputSchema: shape }, async (args) => {
    try {
      return ok(await handler(args || {}));
    } catch (e) {
      return fail(e);
    }
  });
}

const leadId = z.string().describe('Lead id, e.g. "the-coffee-house" (see list_leads)');
const md = z.string().describe('Markdown report shown to the user and saved in the lead folder');

// ---------------- workspace & settings ----------------

tool('workspace_info', 'Locations of the plugin, CLI and workspace, plus configuration status. Call first in every command.', {}, async () => {
  const root = findWorkspace();
  const base = { plugin_root: PLUGIN_ROOT, cli: `node "${CLI_PATH}"`, node: process.execPath, cwd: process.cwd(), workspace: root };
  if (!root) return { ...base, initialized: false, next: 'Run /prospect:setup to create a workspace in this folder.' };
  const w = requireWorkspace();
  const cfg = loadConfig(w);
  return { ...base, initialized: true, config: cfg, problems: configProblems(cfg), secrets_set: secretStatus(w), builder_installed: exists(path.join(w.builder, 'node_modules', 'vite')) };
});

tool('init_workspace', 'Create a Prospect Engine workspace in the given folder (default: current folder). Safe to run again.', {
  folder: z.string().optional().describe('Absolute folder path; defaults to the current folder'),
  agency: z.object({ name: z.string().optional(), contact_name: z.string().optional(), role: z.string().optional(), website: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), signature: z.string().optional() }).optional(),
}, async ({ folder, agency }) => {
  const r = initWorkspace(folder || process.cwd(), { agency });
  process.env.PROSPECT_WORKSPACE = r.workspace;
  ensureReferenceFolders(requireWorkspace());
  return r;
});

tool('update_settings', 'Update non-secret settings (agency profile, hosting, email method, mode, limits, prototype expiry). Secrets go in .prospect/secrets.env, never here.', {
  patch: z.record(z.any()).describe('Partial settings object, e.g. {"mode":"lite"} or {"agency":{"name":"…"}}'),
}, async ({ patch }) => {
  const s = JSON.stringify(patch);
  if (/password|token|secret|api[_-]?key/i.test(s)) throw new Error('Secrets must not be stored in settings. Ask the user to put them in .prospect/secrets.env.');
  const cfg = updateConfig(requireWorkspace(), patch);
  return { saved: true, config: cfg, problems: configProblems(cfg) };
});

// ---------------- leads ----------------

tool('create_lead', 'Engine 1 start: register a business from its Instagram profile URL. Rejects duplicates and do-not-contact entries.', {
  instagram_url: z.string(),
  notes: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  facts: z.record(z.any()).optional().describe('Facts the user states directly (treated as verified, e.g. {"phone":"…"})'),
}, async (a) => {
  const lead = createLead(requireWorkspace(), a);
  return { created: true, ...compactLead(lead), folder: path.join(requireWorkspace().leads, lead.id) };
});

tool('list_leads', 'List leads with filters. Returns compact rows.', {
  status: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low', 'Reject']).optional(),
  search: z.string().optional(),
  include_archived: z.boolean().optional(),
  sort: z.enum(['updated', 'score', 'created', 'name']).optional(),
  limit: z.number().int().optional(),
}, async ({ status, priority, search, include_archived, sort = 'updated', limit = 50 }) => {
  let leads = allLeads(requireWorkspace()).filter((l) => include_archived || !l.archived);
  if (status) leads = leads.filter((l) => l.status.toLowerCase() === status.toLowerCase());
  if (priority) leads = leads.filter((l) => (l.priority_override || l.priority) === priority);
  if (search) {
    const s = search.toLowerCase();
    leads = leads.filter((l) => [l.business_name, l.id, l.instagram_username, l.industry, l.location, l.notes, ...(l.tags || [])].join(' ').toLowerCase().includes(s));
  }
  const key = { updated: (l) => l.updated_at, created: (l) => l.created_at, score: (l) => String(l.opportunity_score ?? -1).padStart(4, '0'), name: (l) => (l.business_name || l.id).toLowerCase() }[sort];
  leads.sort((a, b) => (sort === 'name' ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))));
  return { count: leads.length, leads: leads.slice(0, limit).map(compactLead) };
});

tool('get_lead', 'Full details of one lead: stages, outputs, next step. Use "sections" to limit size.', {
  lead_id: leadId,
  sections: z.array(z.enum(['research', 'website', 'competitors', 'score', 'design', 'prototype', 'deployment', 'contacts', 'email', 'draft', 'stages', 'activity'])).optional(),
}, async ({ lead_id, sections }) => {
  const w = requireWorkspace();
  const l = getLead(w, lead_id);
  const ns = nextStage(l);
  const base = {
    ...compactLead(l),
    industry: l.industry,
    location: l.location,
    notes: l.notes,
    tags: l.tags,
    facts: l.facts,
    approved: l.approved,
    rejected: l.rejected,
    next_stage: ns ? { stage: ns, label: STAGE_LABELS[ns], status: l.stages[ns].status, error: l.stages[ns].error, attempts: l.stages[ns].attempts } : null,
    folder: path.join(w.leads, lead_id),
  };
  const want = sections || ['stages', 'score', 'website', 'design', 'prototype', 'deployment', 'contacts', 'email', 'draft'];
  for (const s of want) {
    if (s === 'stages') base.stages = Object.fromEntries(STAGES.map((st) => [st, { status: l.stages[st].status, attempts: l.stages[st].attempts, error: l.stages[st].error }]));
    else if (s === 'activity') base.activity = readActivity(w, lead_id, 30);
    else base[s] = l[s];
  }
  return base;
});

tool('update_lead', `Edit business info, notes, tags, facts, manual status (${MANUAL_STATUSES.join(', ')}) or priority override.`, {
  lead_id: leadId,
  patch: z.object({
    business_name: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    facts: z.record(z.any()).optional(),
    priority_override: z.enum(['High', 'Medium', 'Low', 'Reject']).nullable().optional(),
    manual_status: z.enum(MANUAL_STATUSES).nullable().optional(),
    archived: z.boolean().optional(),
  }),
}, async ({ lead_id, patch }) => compactLead(updateLead(requireWorkspace(), lead_id, patch)));

tool('set_stage', `Record a workflow stage state. States: ${STAGE_STATES.join(', ')}. Only mark COMPLETED after the stage output is saved.`, {
  lead_id: leadId,
  stage: z.enum(STAGES),
  status: z.enum(STAGE_STATES),
  error: z.string().optional(),
  note: z.string().optional(),
}, async ({ lead_id, stage, status, error, note }) => {
  const w = requireWorkspace();
  const l = getLead(w, lead_id);
  if (status === 'COMPLETED') {
    const needs = { research: l.research, website_audit: l.website, competitors: l.competitors_saved_at, scoring: l.score, design: l.design, contacts: l.contacts_saved_at, email: l.email, draft: l.draft }[stage];
    if (['research', 'website_audit', 'competitors', 'scoring', 'design', 'contacts', 'email', 'draft'].includes(stage) && !needs) {
      throw new Error(`Cannot mark "${STAGE_LABELS[stage]}" completed: its output has not been saved yet. Use the matching save_* tool.`);
    }
    if (['prototype', 'qa', 'deploy', 'approval'].includes(stage)) throw new Error(`"${STAGE_LABELS[stage]}" is completed automatically by its own tool.`);
  }
  const updated = setStage(w, l, stage, status, { error: error || null, note: note ?? null });
  return { stage, status, lead_status: updated.status, next_stage: nextStage(updated) };
});

tool('reset_stage', 'Re-run a stage: resets it and all later stages to NOT_STARTED (previous outputs and prototype versions are kept).', {
  lead_id: leadId,
  stage: z.enum(STAGES.filter((s) => s !== 'approval')),
}, async ({ lead_id, stage }) => {
  const w = requireWorkspace();
  const l = resetFrom(w, getLead(w, lead_id), stage);
  return { reset_from: stage, next_stage: nextStage(l) };
});

tool('suppress_contact', 'Add an email, domain (@example.com) or Instagram username to the do-not-contact list.', {
  value: z.string(),
  reason: z.string().optional(),
}, async ({ value, reason }) => ({ entries: addSuppression(requireWorkspace(), value, reason) }));

// ---------------- Engine 1: Instagram research ----------------

tool('instagram_lookup', 'Official Instagram Graph API (Business Discovery) lookup. Only works if configured and the account is Business/Creator. Never scrapes.', {
  username: z.string(),
}, async ({ username }) => instagramLookup(requireWorkspace(), username.replace(/^@/, '')));

tool('save_research', 'Save the Business Understanding Report (Engine 1). Marks research COMPLETED and waits for the user approval.', {
  lead_id: leadId,
  business_name: z.string(),
  industry: z.string().optional(),
  location: z.string().optional(),
  website_found: z.string().nullable().optional().describe('Website link found on Instagram/search, if any (unverified until the audit)'),
  data: z.object({
    instagram: z.record(z.object({ value: z.any(), status: z.enum(['verified', 'ai_analysis', 'assumption', 'unknown']), source: z.string().optional() })).describe('e.g. {"followers":{"value":1240,"status":"verified","source":"Instagram API"}}'),
    business: z.record(z.object({ value: z.any(), status: z.enum(['verified', 'ai_analysis', 'assumption', 'unknown']), source: z.string().optional() })),
    website_hypothesis: z.string(),
    missing: z.array(z.string()),
    sources: z.array(z.string()),
  }),
  report_markdown: md,
}, async ({ lead_id, business_name, industry, location, website_found, data, report_markdown }) => {
  const w = requireWorkspace();
  const l = getLead(w, lead_id);
  for (const group of ['instagram', 'business']) {
    for (const [k, v] of Object.entries(data[group])) {
      if (v.status === 'verified' && !v.source) throw new Error(`"${group}.${k}" is marked verified but has no source. Add the source or mark it ai_analysis/assumption/unknown.`);
    }
  }
  l.business_name = business_name;
  if (industry) l.industry = industry;
  if (location) l.location = location;
  l.research = { ...data, website_found: website_found || null, saved_at: new Date().toISOString() };
  saveLead(w, l);
  const file = saveReport(w, lead_id, 'research.md', report_markdown);
  setStage(w, l, 'research', 'COMPLETED');
  setStage(w, getLead(w, lead_id), 'approval', 'WAITING_FOR_APPROVAL');
  return { saved: file, status: 'Awaiting Approval', next: `Show the report and ask the user to review it. They continue with /prospect:approve ${lead_id} (or reject).` };
});

tool('decide_lead', 'Human approval gate. ONLY call after the user explicitly said to proceed (or reject) for this lead in this conversation.', {
  lead_id: leadId,
  decision: z.enum(['approve', 'reject']),
  user_words: z.string().describe("The user's own words that gave the decision, quoted"),
  note: z.string().optional(),
}, async ({ lead_id, decision, user_words, note }) => {
  const l = decideLead(requireWorkspace(), lead_id, decision, [note, `User said: "${user_words}"`].filter(Boolean).join(' — '));
  return { ...compactLead(l), decision };
});

// ---------------- Engine 2: website investigation ----------------

tool('audit_website', 'Technical audit of a public website (HTTPS, mobile tag, metadata, headings, images, CTAs, contact links, tech, outdated signals). Private/internal addresses are refused.', {
  url: z.string(),
}, async ({ url }) => {
  const r = await auditWebsite(url);
  if (r.text_sample) r.text_sample = truncate(r.text_sample, 1200);
  return r;
});

tool('pagespeed', 'Google PageSpeed Insights (Lighthouse + Core Web Vitals field data) for a public URL. Takes 20–60 seconds.', {
  url: z.string(),
  strategy: z.enum(['mobile', 'desktop']).optional(),
}, async ({ url, strategy }) => pageSpeed(requireWorkspace(), url, strategy || 'mobile'));

tool('check_links', 'Check internal links on a page for broken ones (max 50).', {
  url: z.string(),
  max: z.number().int().optional(),
}, async ({ url, max }) => checkLinks(url, max || 25));

tool('save_website_audit', `Save Engine 2 website investigation. website_status: ${Object.entries(WEBSITE_STATUSES).map(([k, v]) => `${k}=${v}`).join(', ')}.`, {
  lead_id: leadId,
  official_website: z.string().nullable().describe('Verified official website URL, or null if none was verified'),
  verification: z.string().describe('How you confirmed the site belongs to this business (or why none was accepted)'),
  website_status: z.enum(['A', 'B', 'C', 'D', 'E']),
  scores: z.object({ performance: z.number().nullable().optional(), mobile: z.number().nullable().optional(), seo: z.number().nullable().optional(), design: z.number().nullable().optional() }).optional(),
  weaknesses: z.array(z.string()),
  strengths: z.array(z.string()).optional(),
  opportunities: z.array(z.string()),
  recommended_website_type: z.string(),
  suggested_sections: z.array(z.string()),
  suggested_features: z.array(z.string()).optional(),
  approach_reasons: z.array(z.string()).describe('Genuine, evidence-based reasons to approach this business'),
  other_profiles: z.array(z.string()).optional().describe('Directory listings, Google Business Profile, other social links found'),
  report_markdown: md,
}, async (a) => {
  const w = requireWorkspace();
  const l = getLead(w, a.lead_id);
  requireApproved(l);
  l.website = {
    official_url: a.official_website,
    verification: a.verification,
    status: a.website_status,
    status_label: WEBSITE_STATUSES[a.website_status],
    scores: a.scores || {},
    weaknesses: a.weaknesses,
    strengths: a.strengths || [],
    opportunities: a.opportunities,
    recommended_website_type: a.recommended_website_type,
    suggested_sections: a.suggested_sections,
    suggested_features: a.suggested_features || [],
    approach_reasons: a.approach_reasons,
    other_profiles: a.other_profiles || [],
    saved_at: new Date().toISOString(),
  };
  saveLead(w, l);
  saveReport(w, a.lead_id, 'audit.md', a.report_markdown);
  setStage(w, l, 'website_audit', 'COMPLETED');
  return { saved: true, website_status: l.website.status_label };
});

tool('save_competitors', 'Save competitor research (inspiration and positioning only — never copy).', {
  lead_id: leadId,
  competitors: z.array(z.object({ name: z.string(), website_url: z.string().nullable().optional(), source_url: z.string(), observations: z.string() })),
  report_markdown: md,
}, async ({ lead_id, competitors, report_markdown }) => {
  const w = requireWorkspace();
  const l = getLead(w, lead_id);
  requireApproved(l);
  requireStageDone(l, 'website_audit');
  l.competitors = competitors;
  l.competitors_saved_at = new Date().toISOString();
  saveLead(w, l);
  saveReport(w, lead_id, 'competitors.md', report_markdown);
  setStage(w, l, 'competitors', 'COMPLETED');
  return { saved: competitors.length };
});

tool('save_score', 'Save the transparent opportunity score. Each factor needs score + reason. Weights: business_activity 10, audience_visibility 10, website_opportunity 25, growth_potential 20, contact_availability 15, business_fit 20.', {
  lead_id: leadId,
  factors: z.record(z.object({ score: z.number(), reason: z.string() })),
  report_markdown: md,
}, async ({ lead_id, factors, report_markdown }) => {
  const w = requireWorkspace();
  const l = getLead(w, lead_id);
  requireApproved(l);
  const score = computeScore(factors);
  l.score = { ...score, saved_at: new Date().toISOString() };
  l.opportunity_score = score.total;
  l.priority = score.priority;
  saveLead(w, l);
  saveReport(w, lead_id, 'scoring.md', report_markdown);
  setStage(w, l, 'scoring', 'COMPLETED');
  return { total: score.total, priority: score.priority, note: score.priority === 'Reject' ? 'Below 40: recommend rejecting or manual review. Ask the user before continuing.' : 'Scores are prioritisation indicators, not predictions.' };
});

// ---------------- Engine 3: references & design ----------------

tool('design_catalog', 'Available industry layouts, theme presets, section types and the user\'s design references.', {
  category: z.enum(REFERENCE_CATEGORIES).optional(),
}, async ({ category }) => {
  const w = requireWorkspace();
  const themes = loadThemes();
  return {
    layouts: listLayouts().map((l) => ({ name: l.name, label: l.label, default_theme: l.default_theme, sections: l.sections.map((s) => s.type + (s.optional ? '?' : '')).join(' → ') })),
    themes: Object.fromEntries(Object.entries(themes.themes).map(([k, v]) => [k, `${v.label} (${v.fonts.heading} / ${v.fonts.body}${v.dark ? ', dark' : ''})`])),
    fonts: Object.keys(themes.fonts),
    section_types: Object.keys(SECTION_TYPES),
    references: listReferences(w, { category }).map((r) => ({ id: r.id, name: r.name, category: r.category, url: r.url, tags: r.tags, favourite: r.favourite, description: truncate(r.description, 300), style: r.style, images: r.images })),
  };
});

tool('manage_reference', 'Add, update, remove or scan design references in the user\'s references/ folder.', {
  action: z.enum(['add', 'update', 'remove', 'scan', 'list']),
  id: z.string().optional(),
  name: z.string().optional(),
  category: z.enum(REFERENCE_CATEGORIES).optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  style: z.record(z.any()).optional().describe('Observed style: layout, colours, typography, navigation, conversion structure'),
  image_paths: z.array(z.string()).optional().describe('Absolute paths of screenshots to copy into the library'),
  favourite: z.boolean().optional(),
  delete_files: z.boolean().optional(),
}, async (a) => {
  const w = requireWorkspace();
  if (a.action === 'add') return addReference(w, a);
  if (a.action === 'update') return updateReference(w, a.id, a);
  if (a.action === 'remove') return removeReference(w, a.id, { deleteFiles: a.delete_files });
  if (a.action === 'scan') return scanReferences(w);
  return listReferences(w, { category: a.category });
});

tool('save_design', 'Save the design selection (Engine 3): layout, theme, references used and why. The user may override it.', {
  lead_id: leadId,
  layout: z.string(),
  theme: z.string(),
  theme_colors: z.record(z.string()).optional().describe('Optional brand colour overrides, e.g. {"primary":"#aa3355"} (hex). Keep contrast readable.'),
  sections: z.array(z.union([z.string(), z.object({ type: z.string(), variant: z.string().optional(), id: z.string().optional() })])).optional().describe('Section order; defaults to the layout'),
  reference_ids: z.array(z.string()).optional(),
  reason: z.string(),
  plan_markdown: md,
}, async (a) => {
  const w = requireWorkspace();
  const l = getLead(w, a.lead_id);
  requireApproved(l);
  const themes = loadThemes().themes;
  if (!themes[a.theme]) throw new Error(`Unknown theme "${a.theme}". Options: ${Object.keys(themes).join(', ')}`);
  if (!listLayouts().some((x) => x.name === a.layout)) throw new Error(`Unknown layout "${a.layout}".`);
  for (const [k, v] of Object.entries(a.theme_colors || {})) if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`Colour ${k} must be a 6-digit hex value.`);
  l.design = { layout: a.layout, theme: a.theme, theme_colors: a.theme_colors || null, sections: a.sections || null, reference_ids: a.reference_ids || [], reason: a.reason, saved_at: new Date().toISOString() };
  saveLead(w, l);
  saveReport(w, a.lead_id, 'design-plan.md', a.plan_markdown);
  setStage(w, l, 'design', 'COMPLETED');
  logActivity(w, a.lead_id, 'design', `Design: ${a.layout} / ${a.theme}`);
  return { saved: true, layout: a.layout, theme: a.theme };
});

// ---------------- Engine 4: prototype ----------------

tool('create_prototype', 'Create a new prototype version from the saved design: allocates the client code and writes a content.json skeleton with [[placeholders]] for you to fill.', {
  lead_id: leadId,
}, async ({ lead_id }) => {
  const r = createPrototype(requireWorkspace(), lead_id);
  return { ...r, next: 'Edit content_file with verified, business-specific content (see the prototype-content skill). Then validate_prototype, then build with the CLI.' };
});

tool('new_prototype_version', 'Copy the current (or a given) version to a new version before making changes — never overwrite a working prototype.', {
  lead_id: leadId,
  from_version: z.number().int().optional(),
  note: z.string().optional(),
}, async ({ lead_id, from_version, note }) => newVersion(requireWorkspace(), lead_id, { from: from_version, note }));

tool('restore_prototype_version', 'Make an earlier version the current one again.', {
  lead_id: leadId,
  version: z.number().int(),
}, async ({ lead_id, version }) => restoreVersion(requireWorkspace(), lead_id, version));

tool('validate_prototype', 'Check the current content.json: schema, navigation, and the accuracy rules (no unverified phones/emails, no fake reviews/stats/prices). Run before every build.', {
  lead_id: leadId,
}, async ({ lead_id }) => {
  const r = checkContent(requireWorkspace(), lead_id);
  return { ...r, placeholders_count: r.placeholders.length, placeholders: r.placeholders.slice(0, 30), ready_to_build: r.errors.length === 0 };
});

tool('list_prototypes', 'All prototypes with live status, links, expiry and QA state.', {}, async () => prototypeOverview(requireWorkspace()));

// ---------------- Engine 7: contacts ----------------

tool('extract_contacts', 'Find publicly listed contact details on a website (home + contact/about pages). Returns candidates with source URLs to confirm.', {
  url: z.string(),
}, async ({ url }) => extractContacts(url));

tool('save_contacts', `Save confirmed public business contacts. types: ${CONTACT_TYPES.join(', ')}. Every entry needs source_url. WhatsApp stays "unknown" without a public wa.me link.`, {
  lead_id: leadId,
  contacts: z.array(z.object({
    type: z.enum(CONTACT_TYPES),
    value: z.string(),
    label: z.string().optional(),
    source_url: z.string(),
    evidence: z.string().optional(),
    verification: z.enum(['verified', 'likely', 'unverified', 'unknown']).optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
  })),
  report_markdown: md,
  complete: z.boolean().optional().describe('true when contact research is finished (marks the stage COMPLETED)'),
}, async ({ lead_id, contacts, report_markdown, complete = true }) => {
  const w = requireWorkspace();
  const l = getLead(w, lead_id);
  requireApproved(l);
  l.contacts = mergeContacts(l.contacts || [], contacts);
  l.contacts_saved_at = new Date().toISOString();
  saveLead(w, l);
  saveReport(w, lead_id, 'contacts.md', report_markdown);
  if (complete) setStage(w, l, 'contacts', 'COMPLETED');
  const emails = l.contacts.filter((c) => c.type === 'email');
  return { saved: l.contacts.length, emails: emails.map((e) => `${e.value} (${e.verification}, ${e.confidence})`), note: emails.length ? null : 'No public email found — the email stage cannot create a draft. Ask the user how they want to reach this business.' };
});

// ---------------- Engine 8: email ----------------

tool('save_email', 'Validate and save the personalised outreach email (recipient must be a saved public contact; must include the prototype link; checked for spammy/misleading phrasing). Does NOT send anything.', {
  lead_id: leadId,
  to: z.string(),
  subject: z.string(),
  body: z.string().describe('Plain-text email body'),
  confirm_warnings: z.boolean().optional().describe('Set true only after the user accepted the listed warnings'),
}, async (a) => saveEmail(requireWorkspace(), a.lead_id, a));

tool('record_gmail_draft', 'After the Gmail connector confirmed a draft was created, record its id/link. Never call without a real draft id.', {
  lead_id: leadId,
  draft_id: z.string(),
  message_id: z.string().optional(),
  link: z.string().optional(),
  verified: z.boolean().optional(),
}, async (a) => recordDraft(requireWorkspace(), a.lead_id, { provider: 'gmail', ...a }));

tool('final_summary', 'Everything needed for the final "EMAIL READY IN DRAFTS" notification.', {
  lead_id: leadId,
}, async ({ lead_id }) => {
  const w = requireWorkspace();
  const l = getLead(w, lead_id);
  return {
    business: l.business_name,
    recipient: l.email?.to || null,
    subject: l.email?.subject || null,
    prototype: l.deployment?.active ? l.deployment.url : null,
    expires: l.deployment?.expires_at?.slice(0, 10) || null,
    draft_status: l.draft?.status || 'not saved',
    draft_provider: l.draft?.provider || null,
    open_draft: l.draft?.link || (l.draft?.provider === 'imap' ? `Open the "${l.draft.mailbox}" folder in your email app` : null),
    reports: ['research.md', 'audit.md', 'competitors.md', 'scoring.md', 'design-plan.md', 'contacts.md', 'email.md'].map((f) => reportPath(w, lead_id, f)).filter(exists),
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
