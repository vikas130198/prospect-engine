// Engine 8: personalised email validation and DRAFT-ONLY saving. Nothing here can send email.
import crypto from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { loadConfig, readSecrets } from './config.mjs';
import { getLead, isSuppressed, logActivity, requireApproved, requireStageDone, saveLead, saveReport, setStage } from './leads.mjs';
import { now, UserError } from './util.mjs';

const SPAMMY = /\b(act now|limited time|urgent|guarantee[ds]?|100\s?%|risk[- ]free|no obligation whatsoever|double your|triple your|skyrocket|explode your|#1|best price|cheapest|click here|dear sir\/madam|dear business owner|congratulations|winner|free money)\b/gi;

export function checkEmail(lead, cfg, { to, subject, body }) {
  const errors = [];
  const warnings = [];
  if (!to) errors.push('No recipient.');
  const emails = (lead.contacts || []).filter((c) => c.type === 'email');
  const match = emails.find((c) => c.normalized === String(to || '').trim().toLowerCase());
  if (to && !match) errors.push(`${to} is not one of the publicly sourced emails saved for this lead. Save it with its source first.`);
  if (match && match.verification === 'unverified' && match.confidence === 'low') warnings.push('This email address has low confidence — double-check it before sending.');
  if (!subject || subject.trim().length < 6) errors.push('Subject is missing or too short.');
  else if (subject.length > 90) warnings.push('Subject is long; keep it under ~60 characters.');
  if (!body || body.trim().length < 200) errors.push('Email body is too short to be personal and useful.');
  const url = lead.deployment?.url;
  if (!url) errors.push('The prototype is not deployed yet, so there is no link to include.');
  else if (body && !body.includes(url)) errors.push(`The email must include the prototype link: ${url}`);
  if (body && !/\b(not interested|no longer|opt[- ]?out|unsubscribe|won't contact|will not contact|not contact you again|let me know if you'd prefer not|reply ['"]?no['"]?)\b/i.test(body)) {
    warnings.push('Add a simple, polite opt-out line (e.g. "If you\'d rather not hear from me, just reply and I won\'t follow up").');
  }
  if (cfg.agency.name && body && !body.includes(cfg.agency.name)) warnings.push(`Mention your agency name (${cfg.agency.name}) so the sender identity is clear.`);
  const spam = [...new Set([...(subject + ' ' + body).matchAll(SPAMMY)].map((m) => m[0].toLowerCase()))];
  if (spam.length) warnings.push(`Remove salesy / spam-trigger phrases: ${spam.join(', ')}.`);
  const words = (body || '').split(/\s+/).filter(Boolean).length;
  if (words > 260) warnings.push(`Email is ${words} words; aim for 120–220.`);
  if (/\[\[|\{\{|<insert|lorem ipsum|\bTODO\b/i.test(subject + body)) errors.push('The email still contains placeholder text.');
  return { errors, warnings, words };
}

export function saveEmail(w, leadId, { to, subject, body, confirm_warnings = false }) {
  const lead = getLead(w, leadId);
  requireApproved(lead);
  requireStageDone(lead, 'deploy');
  const cfg = loadConfig(w);
  const sup = isSuppressed(w, [to, lead.instagram_username, '@' + lead.instagram_username, to && '@' + String(to).split('@')[1]]);
  if (sup) throw new UserError(`${sup} is on your do-not-contact list, so no email will be prepared.`);
  const check = checkEmail(lead, cfg, { to, subject, body });
  if (check.errors.length) return { saved: false, errors: check.errors, warnings: check.warnings };
  if (check.warnings.length && !confirm_warnings) return { saved: false, needs_review: true, warnings: check.warnings, hint: 'Fix the warnings, or call again with confirm_warnings: true if they are acceptable.' };
  lead.email = { to: String(to).trim(), subject: subject.trim(), body: body.trim(), saved_at: now(), warnings: check.warnings, words: check.words };
  saveLead(w, lead);
  saveReport(w, leadId, 'email.md', `# Email draft — ${lead.business_name || leadId}\n\n**To:** ${lead.email.to}\n**Subject:** ${lead.email.subject}\n\n---\n\n${lead.email.body}\n`);
  setStage(w, getLead(w, leadId), 'email', 'COMPLETED');
  logActivity(w, leadId, 'email_written', `Email prepared for ${lead.email.to}`);
  return { saved: true, to: lead.email.to, subject: lead.email.subject, words: check.words, warnings: check.warnings };
}

function encodeHeader(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function buildMime({ fromName, fromAddress, to, subject, body }) {
  const domain = (fromAddress.split('@')[1] || 'localhost').replace(/[^a-z0-9.-]/gi, '');
  const id = `<${crypto.randomUUID()}@${domain}>`;
  const b64 = Buffer.from(body.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  const raw = [
    `From: ${fromName ? `${encodeHeader(fromName)} ` : ''}<${fromAddress}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64,
    '',
  ].join('\r\n');
  return { raw, messageId: id };
}

function requireDraftable(w, leadId, { force }) {
  const lead = getLead(w, leadId);
  requireApproved(lead);
  if (!lead.email) throw new UserError('No email has been prepared yet.', 'Write and save the email first.');
  if (lead.draft?.status === 'saved' && !force) {
    throw new UserError('A draft for this lead already exists in your mailbox.', 'Open your Drafts folder. To save another copy anyway, ask Claude to save it again with force.');
  }
  const sup = isSuppressed(w, [lead.email.to]);
  if (sup) throw new UserError(`${sup} is on your do-not-contact list.`);
  return lead;
}

/** Save the prepared email into the IMAP Drafts folder. Uses APPEND only — there is no send capability. */
export async function saveDraftImap(w, leadId, { force = false } = {}) {
  const lead = requireDraftable(w, leadId, { force });
  const cfg = loadConfig(w);
  const im = cfg.email.imap;
  const pass = readSecrets(w).IMAP_PASSWORD;
  if (cfg.email.method !== 'imap') throw new UserError('Email drafts are set to Gmail, not IMAP.', 'Use the Gmail connector, or change the method in /prospect:setup.');
  if (!im.host || !im.user) throw new UserError('IMAP server details are missing.', 'Run /prospect:setup → Email.');
  if (!pass) throw new UserError('Your mailbox password is not set.', 'Open .prospect/secrets.env, fill in IMAP_PASSWORD=..., save it, then try again.');
  const from = cfg.email.from_address || im.user;
  const { raw, messageId } = buildMime({ fromName: cfg.email.from_name || cfg.agency.contact_name, fromAddress: from, to: lead.email.to, subject: lead.email.subject, body: lead.email.body });
  const client = new ImapFlow({ host: im.host, port: Number(im.port) || 993, secure: im.secure !== false, auth: { user: im.user, pass }, logger: false, socketTimeout: 30000 });
  setStage(w, lead, 'draft', 'RUNNING');
  try {
    await client.connect();
    const boxes = await client.list();
    const drafts = boxes.find((b) => b.specialUse === '\\Drafts') || boxes.find((b) => /^(inbox[./])?drafts?$/i.test(b.path)) || boxes.find((b) => /draft/i.test(b.path));
    if (!drafts) throw new UserError('Could not find a Drafts folder in your mailbox.');
    const res = await client.append(drafts.path, raw, ['\\Draft', '\\Seen']);
    let verified = false;
    const lock = await client.getMailboxLock(drafts.path);
    try {
      const found = await client.search({ header: { 'message-id': messageId } });
      verified = Array.isArray(found) && found.length > 0;
    } finally {
      lock.release();
    }
    await client.logout();
    const l = getLead(w, leadId);
    l.draft = { provider: 'imap', mailbox: drafts.path, draft_id: res?.uid ? String(res.uid) : messageId, message_id: messageId, status: verified ? 'saved' : 'unverified', created_at: now(), link: null };
    saveLead(w, l);
    setStage(w, l, 'draft', verified ? 'COMPLETED' : 'REQUIRES_MANUAL_REVIEW', verified ? {} : { error: 'Draft appended but could not be found again' });
    logActivity(w, leadId, 'draft_saved', `Draft saved to ${drafts.path} for ${lead.email.to}`);
    return { ok: verified, mailbox: drafts.path, message_id: messageId, to: lead.email.to, subject: lead.email.subject };
  } catch (e) {
    await client.logout().catch(() => {});
    const auth = /auth|login|credentials|AUTHENTICATIONFAILED/i.test(e.message || '') || e.authenticationFailed;
    const l = getLead(w, leadId);
    setStage(w, l, 'draft', 'FAILED', { error: auth ? 'Mailbox login failed' : e.message });
    if (e instanceof UserError) throw e;
    if (auth) throw new UserError('Your mailbox rejected the login.', 'Check IMAP_PASSWORD in .prospect/secrets.env. Many providers need an "app password". Then run /prospect:doctor.');
    throw new UserError(`Could not save the draft: ${e.message}`, 'Check the IMAP server and port in /prospect:setup, then try again.');
  }
}

/** Record a draft created through the Gmail connector (Claude calls this right after create_draft succeeds). */
export function recordDraft(w, leadId, { provider, draft_id, message_id, link, verified }) {
  const lead = getLead(w, leadId);
  if (!lead.email) throw new UserError('No email has been prepared for this lead.');
  if (!draft_id) throw new UserError('draft_id is required — only record a draft after the mailbox confirmed it was created.');
  lead.draft = {
    provider: provider || 'gmail',
    draft_id: String(draft_id),
    message_id: message_id || null,
    link: link || (provider === 'gmail' || !provider ? `https://mail.google.com/mail/u/0/#drafts` : null),
    status: verified === false ? 'unverified' : 'saved',
    created_at: now(),
  };
  saveLead(w, lead);
  setStage(w, lead, 'draft', verified === false ? 'REQUIRES_MANUAL_REVIEW' : 'COMPLETED');
  logActivity(w, leadId, 'draft_saved', `Draft recorded (${lead.draft.provider}) for ${lead.email.to}`);
  return { ok: true, ...lead.draft, to: lead.email.to, subject: lead.email.subject, prototype: lead.deployment?.url };
}

export async function testImap(w) {
  const cfg = loadConfig(w);
  const im = cfg.email.imap;
  const pass = readSecrets(w).IMAP_PASSWORD;
  if (!im.host || !im.user || !pass) return { ok: false, error: !pass ? 'IMAP_PASSWORD missing in .prospect/secrets.env' : 'IMAP host/user missing' };
  const client = new ImapFlow({ host: im.host, port: Number(im.port) || 993, secure: im.secure !== false, auth: { user: im.user, pass }, logger: false, socketTimeout: 20000 });
  try {
    await client.connect();
    const boxes = await client.list();
    const drafts = boxes.find((b) => b.specialUse === '\\Drafts') || boxes.find((b) => /draft/i.test(b.path));
    await client.logout();
    return { ok: Boolean(drafts), drafts_folder: drafts?.path || null, error: drafts ? null : 'No Drafts folder found' };
  } catch (e) {
    await client.logout().catch(() => {});
    return { ok: false, error: /auth/i.test(e.message || '') || e.authenticationFailed ? 'Login rejected — check the password (an app password may be required).' : e.message };
  }
}
