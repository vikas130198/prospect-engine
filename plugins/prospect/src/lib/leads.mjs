// Lead records, workflow stages, activity history, scoring, contacts, suppression.
import fs from 'node:fs';
import path from 'node:path';
import { leadDir } from './paths.mjs';
import { appendLine, exists, now, readJSON, UserError, writeJSON, writeText } from './util.mjs';

export const STAGES = [
  'research', // Engine 1: Instagram & business understanding
  'approval', // Human gate: Proceed & Continue
  'website_audit', // Engine 2: discovery + audit
  'competitors', // Engine 2: competitor research
  'scoring', // Engine 2: opportunity score
  'design', // Engine 3: reference + design selection
  'prototype', // Engine 4: generate prototype
  'qa', // Engine 5: build + automated testing
  'deploy', // Engine 6: hosting
  'contacts', // Engine 7: public contact research
  'email', // Engine 8: personalised email
  'draft', // Engine 8: saved in Drafts
];

export const STAGE_LABELS = {
  research: 'Instagram & business research',
  approval: 'Your approval',
  website_audit: 'Website investigation',
  competitors: 'Competitor research',
  scoring: 'Opportunity score',
  design: 'Design selection',
  prototype: 'Prototype generation',
  qa: 'Testing & QA',
  deploy: 'Deployment',
  contacts: 'Contact research',
  email: 'Email writing',
  draft: 'Saved to Drafts',
};

export const STAGE_STATES = ['NOT_STARTED', 'QUEUED', 'RUNNING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED', 'REQUIRES_MANUAL_REVIEW', 'SKIPPED'];

export const MANUAL_STATUSES = ['Contacted', 'Responded', 'Meeting Scheduled', 'Converted', 'Lost'];

export const WEBSITE_STATUSES = {
  A: 'No Website',
  B: 'Poor Website',
  C: 'Average Website',
  D: 'Good Website',
  E: 'No Clear Opportunity',
};

export const SCORE_FACTORS = {
  business_activity: { max: 10, label: 'Business activity' },
  audience_visibility: { max: 10, label: 'Audience and visibility' },
  website_opportunity: { max: 25, label: 'Website quality opportunity' },
  growth_potential: { max: 20, label: 'Business growth potential' },
  contact_availability: { max: 15, label: 'Contact availability' },
  business_fit: { max: 20, label: 'Business fit for your agency' },
};

export const CONTACT_TYPES = ['email', 'phone', 'whatsapp', 'contact_page', 'address', 'person', 'website', 'social', 'booking_link', 'other'];

const RESERVED_IG_PATHS = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct', 'tv', 'about', 'developer', 'legal', 'web']);

export function parseInstagram(input) {
  let s = String(input || '').trim();
  if (!s) throw new UserError('Please provide an Instagram profile URL.', 'Example: https://instagram.com/somebusiness');
  let username;
  if (/^@?[A-Za-z0-9._]{1,30}$/.test(s)) {
    username = s.replace(/^@/, '');
  } else {
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    let u;
    try {
      u = new URL(s);
    } catch {
      throw new UserError(`"${input}" is not a valid Instagram URL.`, 'Example: https://instagram.com/somebusiness');
    }
    if (!/(^|\.)instagram\.com$/i.test(u.hostname) && !/(^|\.)instagr\.am$/i.test(u.hostname)) {
      throw new UserError(`"${u.hostname}" is not an Instagram address.`, 'Paste the profile link from instagram.com.');
    }
    const first = u.pathname.split('/').filter(Boolean)[0];
    if (!first) throw new UserError('That Instagram link has no profile name in it.', 'Example: https://instagram.com/somebusiness');
    if (RESERVED_IG_PATHS.has(first.toLowerCase())) {
      throw new UserError('That looks like a post or page link, not a profile.', 'Open the business profile and copy its URL (instagram.com/<username>).');
    }
    username = first;
  }
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username) || /^\.|\.$|\.\./.test(username)) {
    throw new UserError(`"${username}" is not a valid Instagram username.`);
  }
  username = username.toLowerCase();
  return { username, url: `https://www.instagram.com/${username}/`, id: username.replace(/\./g, '-').replace(/^_+/, '') || 'lead' };
}

function emptyStages() {
  const s = {};
  for (const st of STAGES) s[st] = { status: 'NOT_STARTED', attempts: 0, updated_at: null, error: null, note: null };
  return s;
}

const leadFile = (w, id) => path.join(leadDir(w, id), 'lead.json');
const activityFile = (w, id) => path.join(leadDir(w, id), 'activity.jsonl');

export function logActivity(w, leadId, event_type, description, metadata) {
  appendLine(activityFile(w, leadId), { at: now(), event_type, description, ...(metadata ? { metadata } : {}) });
}

export function readActivity(w, leadId, limit = 50) {
  const f = activityFile(w, leadId);
  if (!exists(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return { raw: l };
    }
  });
}

export function getLead(w, id) {
  const f = leadFile(w, id);
  if (!exists(f)) throw new UserError(`No lead called "${id}".`, 'Use /prospect:list to see your leads.');
  return readJSON(f);
}

export function saveLead(w, lead) {
  lead.updated_at = now();
  lead.status = computeStatus(lead);
  writeJSON(leadFile(w, lead.id), lead);
  return lead;
}

export function listLeadIds(w) {
  if (!exists(w.leads)) return [];
  return fs.readdirSync(w.leads).filter((d) => exists(path.join(w.leads, d, 'lead.json')));
}

export function allLeads(w) {
  return listLeadIds(w).map((id) => {
    try {
      return readJSON(path.join(w.leads, id, 'lead.json'));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// ---------- suppression list ----------

export function suppressionEntries(w) {
  return readJSON(w.suppression, { entries: [] }).entries;
}

export function isSuppressed(w, values) {
  const list = suppressionEntries(w).map((e) => e.value.toLowerCase());
  return values.filter(Boolean).map((v) => String(v).toLowerCase()).find((v) => list.includes(v) || list.some((s) => s.startsWith('@') && v.endsWith(s))) || null;
}

export function addSuppression(w, value, reason) {
  const data = readJSON(w.suppression, { entries: [] });
  const v = String(value || '').trim().toLowerCase();
  if (!v) throw new UserError('Nothing to add to the do-not-contact list.');
  if (!data.entries.some((e) => e.value === v)) data.entries.push({ value: v, reason: reason || '', added_at: now() });
  writeJSON(w.suppression, data);
  return data.entries.length;
}

// ---------- create / update ----------

export function createLead(w, { instagram_url, notes, industry, location, facts }) {
  const ig = parseInstagram(instagram_url);
  const suppressed = isSuppressed(w, [ig.username, '@' + ig.username]);
  if (suppressed) {
    throw new UserError(`@${ig.username} is on your do-not-contact list.`, 'Remove it from .prospect/suppression.json if this was a mistake.');
  }
  const dup = allLeads(w).find((l) => l.instagram_username === ig.username);
  if (dup) {
    throw new UserError(
      `@${ig.username} is already in your leads (id "${dup.id}", status ${dup.status}).`,
      `Use /prospect:open ${dup.id} to view it or /prospect:resume ${dup.id} to continue.`,
    );
  }
  let id = ig.id;
  let n = 2;
  while (exists(path.join(w.leads, id))) id = `${ig.id}-${n++}`;
  const lead = {
    schema: 1,
    id,
    instagram_username: ig.username,
    instagram_url: ig.url,
    business_name: null,
    industry: industry || null,
    location: location || null,
    notes: notes || '',
    tags: [],
    facts: facts && typeof facts === 'object' ? facts : {},
    status: 'New',
    manual_status: null,
    priority: null,
    priority_override: null,
    opportunity_score: null,
    approved: false,
    approved_at: null,
    rejected: false,
    rejected_reason: null,
    archived: false,
    stages: emptyStages(),
    research: null,
    website: null,
    competitors: [],
    score: null,
    design: null,
    prototype: null,
    deployment: null,
    deployments: [],
    contacts: [],
    email: null,
    draft: null,
    created_at: now(),
    updated_at: now(),
  };
  saveLead(w, lead);
  logActivity(w, id, 'lead_created', `Lead created from ${ig.url}`);
  return lead;
}

const EDITABLE = ['business_name', 'industry', 'location', 'notes', 'tags', 'facts', 'priority_override', 'manual_status', 'archived'];

export function updateLead(w, id, patch) {
  const lead = getLead(w, id);
  for (const [k, v] of Object.entries(patch || {})) {
    if (!EDITABLE.includes(k)) throw new UserError(`"${k}" cannot be edited directly.`, `Editable fields: ${EDITABLE.join(', ')}.`);
    if (k === 'manual_status' && v !== null && !MANUAL_STATUSES.includes(v)) {
      throw new UserError(`"${v}" is not a manual status.`, `Use one of: ${MANUAL_STATUSES.join(', ')} (or null to clear).`);
    }
    if (k === 'priority_override' && v !== null && !['High', 'Medium', 'Low', 'Reject'].includes(v)) {
      throw new UserError('priority_override must be High, Medium, Low, Reject or null.');
    }
    if (k === 'facts') lead.facts = { ...lead.facts, ...v };
    else lead[k] = v;
  }
  saveLead(w, lead);
  logActivity(w, id, 'lead_updated', `Updated: ${Object.keys(patch).join(', ')}`);
  return lead;
}

// ---------- stages ----------

export function stageIndex(stage) {
  const i = STAGES.indexOf(stage);
  if (i < 0) throw new UserError(`Unknown stage "${stage}".`, `Stages: ${STAGES.join(', ')}.`);
  return i;
}

export function requireApproved(lead) {
  if (lead.rejected) throw new UserError(`${lead.business_name || lead.id} was rejected.`, 'Create a new decision with /prospect:approve if you changed your mind.');
  if (!lead.approved) {
    throw new UserError(
      `${lead.business_name || lead.id} has not been approved yet.`,
      `Review the research report, then run /prospect:approve ${lead.id}.`,
    );
  }
}

export function requireStageDone(lead, stage) {
  const st = lead.stages[stage]?.status;
  if (st !== 'COMPLETED' && st !== 'SKIPPED') {
    throw new UserError(`The "${STAGE_LABELS[stage]}" stage must be completed first (it is ${st}).`, `Run /prospect:resume ${lead.id}.`);
  }
}

export function setStage(w, lead, stage, status, { error = null, note = null, countAttempt = false } = {}) {
  stageIndex(stage);
  if (!STAGE_STATES.includes(status)) throw new UserError(`Unknown stage status "${status}".`);
  if (stageIndex(stage) > stageIndex('approval') && ['RUNNING', 'COMPLETED'].includes(status)) requireApproved(lead);
  const s = lead.stages[stage];
  const prev = s.status;
  s.status = status;
  s.updated_at = now();
  s.error = error;
  if (note !== null) s.note = note;
  if (countAttempt || (status === 'RUNNING' && prev !== 'RUNNING')) s.attempts += 1;
  saveLead(w, lead);
  logActivity(w, lead.id, 'stage', `${STAGE_LABELS[stage]}: ${prev} → ${status}${error ? ` (${error})` : ''}`);
  return lead;
}

/** Reset a stage and every later stage that depends on it (keeps outputs on disk). */
export function resetFrom(w, lead, stage) {
  const i = stageIndex(stage);
  for (const st of STAGES.slice(i)) {
    if (st === 'approval') continue;
    lead.stages[st] = { ...lead.stages[st], status: 'NOT_STARTED', error: null, updated_at: now() };
  }
  saveLead(w, lead);
  logActivity(w, lead.id, 'stage_reset', `Reset stages from ${STAGE_LABELS[stage]} onward`);
  return lead;
}

export function nextStage(lead) {
  if (lead.rejected) return null;
  for (const st of STAGES) {
    const s = lead.stages[st].status;
    if (s !== 'COMPLETED' && s !== 'SKIPPED') return st;
  }
  return null;
}

export function computeStatus(lead) {
  if (lead.manual_status) return lead.manual_status;
  if (lead.rejected) return 'Rejected';
  const st = nextStage(lead);
  if (!st) return 'Email Ready';
  const s = lead.stages[st].status;
  switch (st) {
    case 'research':
      return s === 'NOT_STARTED' ? 'New' : 'Researching';
    case 'approval':
      return 'Awaiting Approval';
    case 'website_audit':
    case 'competitors':
    case 'scoring':
      return 'Website Investigation';
    case 'design':
      return 'Qualified';
    case 'prototype':
      return 'Prototype Generation';
    case 'qa':
      return 'Testing';
    case 'deploy':
      return 'Deployment';
    case 'contacts':
      return 'Contact Research';
    default:
      return 'Email Drafting';
  }
}

export function decideLead(w, id, decision, note) {
  const lead = getLead(w, id);
  const rs = lead.stages.research.status;
  if (decision === 'approve') {
    if (rs !== 'COMPLETED') throw new UserError('Research is not finished yet, so there is nothing to approve.', `Run /prospect:resume ${id}.`);
    lead.approved = true;
    lead.approved_at = now();
    lead.rejected = false;
    lead.rejected_reason = null;
    lead.stages.approval = { ...lead.stages.approval, status: 'COMPLETED', updated_at: now(), note: note || null };
    saveLead(w, lead);
    logActivity(w, id, 'approved', `Approved to continue${note ? `: ${note}` : ''}`);
  } else if (decision === 'reject') {
    lead.rejected = true;
    lead.approved = false;
    lead.rejected_reason = note || null;
    lead.stages.approval = { ...lead.stages.approval, status: 'CANCELLED', updated_at: now(), note: note || null };
    saveLead(w, lead);
    logActivity(w, id, 'rejected', `Rejected${note ? `: ${note}` : ''}`);
  } else {
    throw new UserError('decision must be "approve" or "reject".');
  }
  return lead;
}

// ---------- reports ----------

const REPORTS = ['research.md', 'audit.md', 'competitors.md', 'scoring.md', 'design-plan.md', 'contacts.md', 'email.md'];

export function saveReport(w, id, name, markdown) {
  if (!REPORTS.includes(name)) throw new UserError(`Unknown report "${name}".`);
  const file = path.join(leadDir(w, id), name);
  writeText(file, String(markdown || '').trim() + '\n');
  return file;
}

export function reportPath(w, id, name) {
  return path.join(leadDir(w, id), name);
}

// ---------- scoring ----------

export function computeScore(factors) {
  const out = {};
  let total = 0;
  for (const [key, def] of Object.entries(SCORE_FACTORS)) {
    const f = factors?.[key];
    if (!f || typeof f.score !== 'number') throw new UserError(`Missing score for "${def.label}" (${key}).`);
    if (f.score < 0 || f.score > def.max) throw new UserError(`${def.label} must be between 0 and ${def.max} (got ${f.score}).`);
    if (!f.reason || String(f.reason).trim().length < 8) throw new UserError(`Please give a short explanation for "${def.label}".`);
    out[key] = { score: Math.round(f.score * 10) / 10, max: def.max, label: def.label, reason: String(f.reason).trim() };
    total += f.score;
  }
  total = Math.round(total);
  const priority = total >= 80 ? 'High' : total >= 60 ? 'Medium' : total >= 40 ? 'Low' : 'Reject';
  return { factors: out, total, priority };
}

// ---------- contacts ----------

export function normalizeContactValue(type, value) {
  const v = String(value || '').trim();
  if (type === 'email') return v.toLowerCase();
  if (type === 'phone' || type === 'whatsapp') return v.replace(/[^\d+]/g, '');
  return v;
}

export function mergeContacts(existing, incoming) {
  const out = [...existing];
  for (const c of incoming) {
    if (!CONTACT_TYPES.includes(c.type)) throw new UserError(`Unknown contact type "${c.type}".`, `Use one of: ${CONTACT_TYPES.join(', ')}.`);
    if (!c.value || !String(c.value).trim()) throw new UserError('A contact entry has no value.');
    if (!c.source_url || !/^https?:\/\//i.test(c.source_url)) {
      throw new UserError(`Contact "${c.value}" has no source URL.`, 'Every contact must say where it was found publicly. Never guess contact details.');
    }
    const verification = c.verification || 'unverified';
    if (!['verified', 'likely', 'unverified', 'unknown'].includes(verification)) throw new UserError(`Bad verification "${verification}".`);
    if (c.type === 'whatsapp' && verification === 'verified' && !/wa\.me|whatsapp\.com/i.test(c.evidence || c.source_url)) {
      throw new UserError('WhatsApp can only be marked verified with a public wa.me / WhatsApp link as evidence.', 'Mark it "unknown" instead.');
    }
    const norm = normalizeContactValue(c.type, c.value);
    const found = out.find((e) => e.type === c.type && e.normalized === norm);
    const rec = {
      type: c.type,
      value: String(c.value).trim(),
      normalized: norm,
      label: c.label || null,
      source_url: c.source_url,
      evidence: c.evidence || null,
      verification,
      confidence: ['high', 'medium', 'low'].includes(c.confidence) ? c.confidence : 'medium',
      discovered_at: found?.discovered_at || now(),
    };
    if (found) Object.assign(found, rec);
    else out.push(rec);
  }
  return out;
}

export function compactLead(lead) {
  return {
    id: lead.id,
    business_name: lead.business_name,
    instagram: lead.instagram_url,
    status: lead.status,
    priority: lead.priority_override || lead.priority,
    score: lead.opportunity_score,
    website_status: lead.website?.status_label || null,
    client_code: lead.prototype?.code || null,
    preview_url: lead.deployment?.active ? lead.deployment.url : null,
    draft: lead.draft?.status || null,
    next_stage: nextStage(lead),
    updated_at: lead.updated_at,
  };
}
