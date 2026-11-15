// Engine 6: assemble the static site of all live prototypes, upload, verify, manage expiry/disable/delete.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { markCodeDeleted } from './codes.mjs';
import { loadConfig, readSecrets } from './config.mjs';
import { deploySite } from './hosting.mjs';
import { allLeads, getLead, logActivity, requireApproved, saveLead, setStage } from './leads.mjs';
import { currentVersion, distDir } from './prototype.mjs';
import { copyDir, ensureDir, exists, now, removeDir, UserError, withLock, writeText } from './util.mjs';

const ROOT_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="prospect-root" content="1"><title>Preview</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#444;background:#fafafa}</style></head><body><p>Nothing to see here.</p></body></html>\n`;
const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Not available</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#444;background:#fafafa;text-align:center}</style></head><body><div><h1>This preview is not available</h1><p>It may have expired or been switched off. Please contact the person who sent you the link.</p></div></body></html>\n`;
const HEADERS = `/*
  X-Robots-Tag: noindex, nofollow, noarchive
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/client/:code/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

function gateSource(protectedMap, kind) {
  const body = `const PROTECTED = ${JSON.stringify(protectedMap)};
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function allowed(request) {
  const m = new URL(request.url).pathname.match(/^\\/client\\/([A-Z0-9]+)(\\/|$)/);
  if (!m || !PROTECTED[m[1]]) return true;
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = atob(auth.slice(6)); } catch { return false; }
  const pass = decoded.slice(decoded.indexOf(':') + 1);
  return (await sha256(m[1] + ':' + pass)) === PROTECTED[m[1]];
}
const denied = () => new Response('This preview is password protected.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Preview", charset="UTF-8"', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } });
`;
  if (kind === 'cloudflare') return `${body}export async function onRequest(ctx) {\n  return (await allowed(ctx.request)) ? ctx.next() : denied();\n}\n`;
  return `${body}export default async (request, context) => ((await allowed(request)) ? context.next() : denied());\nexport const config = { path: '/client/*' };\n`;
}

const isExpired = (d) => d?.expires_at && new Date(d.expires_at) < new Date();

/** Rebuild the local site/ folder from every active, unexpired deployment record. */
function assembleSite(w, cfg, { include } = {}) {
  removeDir(w.site);
  ensureDir(path.join(w.site, 'client'));
  writeText(path.join(w.site, 'index.html'), ROOT_HTML);
  writeText(path.join(w.site, '404.html'), NOT_FOUND);
  writeText(path.join(w.site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeText(path.join(w.site, '_headers'), HEADERS);
  const secrets = readSecrets(w);
  const protectedMap = {};
  const live = [];
  const expired = [];
  for (const lead of allLeads(w)) {
    let d = lead.deployment;
    if (include && lead.id === include.lead_id) d = include.deployment;
    if (!d?.active) continue;
    if (isExpired(d)) {
      expired.push(lead.id);
      continue;
    }
    const src = distDir(w, d.code, d.version);
    if (!exists(path.join(src, 'index.html'))) continue;
    copyDir(src, path.join(w.site, 'client', d.code));
    live.push(d.code);
    if (d.protected) {
      const pass = secrets[`PROTOTYPE_PASSWORD_${d.code}`];
      if (!pass) throw new UserError(`Prototype ${d.code} is marked password-protected but has no password.`, `Add PROTOTYPE_PASSWORD_${d.code}=... to .prospect/secrets.env, then try again.`);
      protectedMap[d.code] = crypto.createHash('sha256').update(`${d.code}:${pass}`).digest('hex');
    }
  }
  // Password gate (edge function) only when needed; otherwise the site stays purely static.
  const cfFn = path.join(w.root, 'functions');
  const nfFn = path.join(w.root, 'netlify', 'edge-functions');
  removeDir(cfFn);
  removeDir(path.join(nfFn, 'prototype-gate.js'));
  if (Object.keys(protectedMap).length) {
    if (cfg.hosting.provider === 'cloudflare') writeText(path.join(cfFn, '_middleware.js'), gateSource(protectedMap, 'cloudflare'));
    else writeText(path.join(nfFn, 'prototype-gate.js'), gateSource(protectedMap, 'netlify'));
  }
  return { live, expired, protected: Object.keys(protectedMap) };
}

async function verifyLive(url, code, { auth, attempts = 8 } = {}) {
  let last = '';
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: auth ? { authorization: 'Basic ' + Buffer.from(`preview:${auth}`).toString('base64') } : {}, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      const robots = res.headers.get('x-robots-tag') || '';
      if (res.status === 200 && body.includes(`/client/${code}/assets/`)) {
        return { ok: true, status: 200, noindex_header: /noindex/i.test(robots), noindex_meta: /name="robots" content="noindex/i.test(body) };
      }
      last = `HTTP ${res.status}${res.status === 200 ? ' but the page content is not this prototype yet' : ''}`;
    } catch (e) {
      last = e.cause?.code || e.message;
    }
    await new Promise((r) => setTimeout(r, 4000 + i * 2000));
  }
  return { ok: false, error: last };
}

async function uploadAndVerify(w, cfg, check) {
  const up = await deploySite(w, cfg);
  const results = [];
  for (const c of check) results.push({ code: c.code, ...(await verifyLive(c.url, c.code, { auth: c.auth })) });
  return { upload: up, results };
}

export function previewUrl(cfg, code) {
  if (!cfg.hosting.base_url) throw new UserError('The prototype address is not known yet.', 'Finish the hosting step in /prospect:setup.');
  return `${cfg.hosting.base_url}/client/${code}/`;
}

export async function deployLead(w, leadId, { protect = false } = {}) {
  return withLock(path.join(w.locks, 'deploy.lock'), async () => {
    const cfg = loadConfig(w);
    const lead = getLead(w, leadId);
    requireApproved(lead);
    const { code, v, meta } = currentVersion(lead);
    // Mandatory QA gate: the exact build that passed QA is the only thing that can be deployed.
    if (meta?.build?.status !== 'passed') throw new UserError(`v${v} has not been built.`, 'Build and test the prototype first.');
    if (meta?.qa?.status !== 'passed') throw new UserError(`v${v} has not passed QA, so it cannot be deployed.`, 'Run QA and fix any critical problems first.');
    if (meta.qa.build_hash !== meta.build.hash) throw new UserError('The prototype changed after it passed QA.', 'Run QA again on the latest build.');
    if (lead.stages.qa.status !== 'COMPLETED') throw new UserError('The QA stage is not marked complete.', 'Run QA again.');
    const url = previewUrl(cfg, code);
    const prev = lead.deployment;
    const keepExpiry = prev?.expires_at && !isExpired(prev);
    const deployment = {
      code,
      version: v,
      build_hash: meta.build.hash,
      url,
      provider: cfg.hosting.provider,
      active: true,
      protected: protect || Boolean(prev?.protected),
      deployed_at: now(),
      expires_at: keepExpiry ? prev.expires_at : new Date(Date.now() + cfg.prototype.expiry_days * 86400000).toISOString(),
      disabled_reason: null,
    };
    setStage(w, lead, 'deploy', 'RUNNING');
    let site;
    try {
      site = assembleSite(w, cfg, { include: { lead_id: leadId, deployment } });
    } catch (e) {
      setStage(w, getLead(w, leadId), 'deploy', 'FAILED', { error: e.message });
      throw e;
    }
    let res;
    try {
      res = await uploadAndVerify(w, cfg, [{ code, url, auth: deployment.protected ? readSecrets(w)[`PROTOTYPE_PASSWORD_${code}`] : null }]);
    } catch (e) {
      setStage(w, getLead(w, leadId), 'deploy', 'FAILED', { error: e.message });
      throw e;
    }
    const check = res.results[0];
    const l = getLead(w, leadId);
    l.deployments = [...(l.deployments || []), { ...deployment, reference: res.upload.reference, verified: check.ok, error: check.error || null }];
    if (!check.ok) {
      saveLead(w, l);
      setStage(w, l, 'deploy', 'FAILED', { error: `Uploaded, but ${url} could not be verified: ${check.error}` });
      return { ok: false, url, error: check.error, hint: cfg.hosting.custom_domain ? 'If you just added your custom domain, DNS/SSL may still be activating. Try again in a few minutes.' : 'Try again in a minute. If it keeps failing, run /prospect:doctor.' };
    }
    l.deployment = { ...deployment, reference: res.upload.reference, verified_at: now() };
    saveLead(w, l);
    setStage(w, l, 'deploy', 'COMPLETED', { note: url });
    logActivity(w, leadId, 'deployed', `Deployed ${code} v${v} to ${url}`);
    return { ok: true, url, version: v, expires_at: deployment.expires_at, protected: deployment.protected, noindex_header: check.noindex_header, other_live_prototypes: site.live.length - 1, expired_removed: site.expired };
  });
}

/** Re-sync hosting after disable/enable/delete/expiry changes. */
export async function syncHosting(w) {
  return withLock(path.join(w.locks, 'deploy.lock'), async () => {
    const cfg = loadConfig(w);
    const site = assembleSite(w, cfg);
    for (const id of site.expired) {
      const l = getLead(w, id);
      if (l.deployment?.active) {
        l.deployment.active = false;
        l.deployment.disabled_reason = 'expired';
        saveLead(w, l);
        logActivity(w, id, 'expired', `Prototype ${l.deployment.code} expired and was switched off`);
      }
    }
    const up = await deploySite(w, cfg);
    return { live: site.live, expired_switched_off: site.expired, protected: site.protected, reference: up.reference };
  });
}

function requireDeployment(lead) {
  if (!lead.deployment) throw new UserError(`${lead.business_name || lead.id} has never been deployed.`);
  return lead.deployment;
}

export async function setActive(w, leadId, active, reason) {
  const lead = getLead(w, leadId);
  const d = requireDeployment(lead);
  if (active && isExpired(d)) throw new UserError('This prototype has expired.', `Extend it first: /prospect:prototypes extend ${leadId} 30`);
  if (active && d.deleted_at) throw new UserError('This prototype was deleted and its link cannot be reused.');
  d.active = active;
  d.disabled_reason = active ? null : reason || 'disabled by user';
  saveLead(w, lead);
  logActivity(w, leadId, active ? 'enabled' : 'disabled', `Prototype ${d.code} ${active ? 'enabled' : 'disabled'}`);
  const sync = await syncHosting(w);
  return { code: d.code, url: d.url, active, live_prototypes: sync.live.length };
}

export async function extend(w, leadId, days) {
  const lead = getLead(w, leadId);
  const d = requireDeployment(lead);
  const n = Number(days);
  if (!Number.isFinite(n) || n < 1 || n > 365) throw new UserError('Days must be between 1 and 365.');
  const base = isExpired(d) ? Date.now() : new Date(d.expires_at).getTime();
  d.expires_at = new Date(base + n * 86400000).toISOString();
  saveLead(w, lead);
  logActivity(w, leadId, 'extended', `Expiry extended by ${n} days to ${d.expires_at.slice(0, 10)}`);
  return { code: d.code, expires_at: d.expires_at, note: d.active ? 'Still live.' : 'Still switched off — enable it to make it live again.' };
}

export async function setProtected(w, leadId, on) {
  const lead = getLead(w, leadId);
  const d = requireDeployment(lead);
  if (on && !readSecrets(w)[`PROTOTYPE_PASSWORD_${d.code}`]) {
    throw new UserError(`No password set for ${d.code}.`, `Open .prospect/secrets.env, add a line PROTOTYPE_PASSWORD_${d.code}=your-password, save it, then try again.`);
  }
  d.protected = Boolean(on);
  saveLead(w, lead);
  logActivity(w, leadId, 'protection', `Password protection ${on ? 'on' : 'off'} for ${d.code}`);
  const sync = await syncHosting(w);
  return { code: d.code, protected: d.protected, live_prototypes: sync.live.length, username_hint: 'Any username works; only the password is checked.' };
}

export async function deletePrototype(w, leadId, { purgeSource = false } = {}) {
  const lead = getLead(w, leadId);
  const code = lead.prototype?.code;
  if (!code) throw new UserError('This lead has no prototype.');
  if (lead.deployment) {
    lead.deployment.active = false;
    lead.deployment.deleted_at = now();
    lead.deployment.disabled_reason = 'deleted';
  }
  lead.prototype.deleted_at = now();
  saveLead(w, lead);
  markCodeDeleted(w, code);
  if (purgeSource) removeDir(path.join(w.prototypes, code));
  logActivity(w, leadId, 'deleted', `Prototype ${code} deleted${purgeSource ? ' (source removed)' : ' (source kept)'}`);
  let sync = null;
  try {
    sync = await syncHosting(w);
  } catch (e) {
    return { code, removed_from_hosting: false, error: e.message, hint: 'Run /prospect:prototypes sync once hosting works again.' };
  }
  return { code, removed_from_hosting: true, live_prototypes: sync.live.length, source_kept: !purgeSource };
}

export function prototypeOverview(w) {
  const cfg = loadConfig(w);
  const soon = Date.now() + cfg.prototype.reminder_days * 86400000;
  return allLeads(w)
    .filter((l) => l.prototype?.code)
    .map((l) => {
      const d = l.deployment;
      const exp = d?.expires_at ? new Date(d.expires_at).getTime() : null;
      return {
        lead_id: l.id,
        business: l.business_name,
        code: l.prototype.code,
        current_version: l.prototype.current_version,
        versions: Object.keys(l.prototype.versions).length,
        qa: l.prototype.versions[l.prototype.current_version]?.qa?.status || 'not tested',
        live: Boolean(d?.active && !isExpired(d)),
        deployed_version: d?.version || null,
        url: d?.url || null,
        protected: Boolean(d?.protected),
        expires: d?.expires_at?.slice(0, 10) || null,
        expiring_soon: Boolean(d?.active && exp && exp < soon && exp > Date.now()),
        status: l.prototype.deleted_at ? 'deleted' : !d ? 'not deployed' : d.active ? (isExpired(d) ? 'expired' : 'live') : d.disabled_reason || 'disabled',
      };
    });
}

export function deploymentLogs(w, leadId) {
  const lead = getLead(w, leadId);
  return { current: lead.deployment, history: lead.deployments || [] };
}

export function siteFolderStats(w) {
  if (!exists(path.join(w.site, 'client'))) return { prototypes: 0 };
  return { prototypes: fs.readdirSync(path.join(w.site, 'client')).length };
}
