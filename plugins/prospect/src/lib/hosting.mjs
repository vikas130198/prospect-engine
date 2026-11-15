// Engine 6 hosting adapters: Cloudflare Pages (recommended) and Netlify. Both use browser login via their CLIs.
import crypto from 'node:crypto';
import path from 'node:path';
import { exists, run, UserError } from './util.mjs';

export const PROVIDERS = {
  cloudflare: { label: 'Cloudflare Pages', package: 'wrangler', version: '^4', bin: ['wrangler', 'bin', 'wrangler.js'], domain: 'pages.dev' },
  netlify: { label: 'Netlify', package: 'netlify-cli', version: '^27', bin: ['netlify-cli', 'bin', 'run.js'], domain: 'netlify.app' },
};

export function providerInfo(provider) {
  const p = PROVIDERS[provider];
  if (!p) throw new UserError('No hosting provider is configured.', 'Run /prospect:setup and choose Cloudflare Pages or Netlify.');
  return p;
}

export function cliPath(w, provider) {
  return path.join(w.builder, 'node_modules', ...providerInfo(provider).bin);
}

export function cliInstalled(w, provider) {
  return exists(cliPath(w, provider));
}

/** Command the user (or Claude via Bash) runs to log in through the browser. */
export function loginCommand(w, provider) {
  return `node "${cliPath(w, provider)}" login`;
}

function env(cfg) {
  return {
    CI: 'true',
    WRANGLER_SEND_METRICS: 'false',
    NETLIFY_TELEMETRY_DISABLED: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    ...(cfg.hosting.account_id ? { CLOUDFLARE_ACCOUNT_ID: cfg.hosting.account_id } : {}),
  };
}

async function cli(w, cfg, args, opts = {}) {
  const provider = cfg.hosting.provider;
  if (!cliInstalled(w, provider)) throw new UserError(`${providerInfo(provider).label} tools are not installed.`, 'Run /prospect:setup → Install components.');
  return run(process.execPath, [cliPath(w, provider), ...args], { cwd: w.root, env: env(cfg), timeoutMs: opts.timeoutMs || 5 * 60_000 });
}

const clean = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '').trim();

export async function hostStatus(w, cfg) {
  const provider = cfg.hosting.provider;
  if (!provider) return { configured: false };
  if (!cliInstalled(w, provider)) return { configured: true, provider, installed: false };
  if (provider === 'cloudflare') {
    const r = await cli(w, cfg, ['whoami'], { timeoutMs: 60000 });
    const out = clean(r.stdout + r.stderr);
    const logged = /logged in|associated with the email/i.test(out) && !/not authenticated/i.test(out);
    const accounts = [...new Set([...out.matchAll(/\b([a-f0-9]{32})\b/g)].map((m) => m[1]))];
    return { configured: true, provider, installed: true, logged_in: logged, accounts, email: (out.match(/email\s+([^\s]+@[^\s.]+\.[^\s]+?)\.?\s/i) || [])[1] || null };
  }
  const r = await cli(w, cfg, ['api', 'getCurrentUser'], { timeoutMs: 60000 });
  let user = null;
  try {
    user = JSON.parse(r.stdout);
  } catch { /* not logged in */ }
  return { configured: true, provider, installed: true, logged_in: Boolean(user?.email || user?.id), email: user?.email || null };
}

export async function createProject(w, cfg, name) {
  const provider = cfg.hosting.provider;
  name = String(name).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  if (!name) throw new UserError('Please choose a project name (letters, numbers and dashes).');
  if (provider === 'cloudflare') {
    const r = await cli(w, cfg, ['pages', 'project', 'create', name, '--production-branch', 'main']);
    const out = clean(r.stdout + r.stderr);
    if (r.code !== 0 && !/already exists/i.test(out)) {
      if (/more than one account/i.test(out)) throw new UserError('Your Cloudflare login has more than one account.', 'Tell Claude which account ID to use (shown by /prospect:doctor) so it can be saved as hosting.account_id.');
      if (/not authenticated|login/i.test(out)) throw new UserError('You are not logged in to Cloudflare.', `Run: ${loginCommand(w, provider)}`);
      throw new UserError(`Cloudflare could not create the project: ${out.split('\n').slice(-3).join(' ')}`);
    }
    const list = clean((await cli(w, cfg, ['pages', 'project', 'list'])).stdout);
    const line = list.split('\n').find((l) => l.includes(name)) || '';
    const domain = (line.match(/([a-z0-9-]+\.pages\.dev)/) || [])[1] || `${name}.pages.dev`;
    return { project: name, site_id: null, default_url: `https://${domain}` };
  }
  for (let i = 0; i < 3; i++) {
    const tryName = i === 0 ? name : `${name}-${crypto.randomBytes(2).toString('hex')}`;
    const r = await cli(w, cfg, ['api', 'createSite', '--data', JSON.stringify({ body: { name: tryName } })]);
    let data = null;
    try {
      data = JSON.parse(r.stdout);
    } catch { /* error text */ }
    if (data?.id) return { project: data.name, site_id: data.id, default_url: data.ssl_url || `https://${data.name}.netlify.app` };
    const out = clean(r.stdout + r.stderr);
    if (/not logged in|unauthori[sz]ed|401/i.test(out)) throw new UserError('You are not logged in to Netlify.', `Run: ${loginCommand(w, provider)}`);
    if (!/422|taken|must be unique/i.test(out)) throw new UserError(`Netlify could not create the site: ${out.split('\n').slice(-3).join(' ')}`);
  }
  throw new UserError('That Netlify site name is taken.', 'Choose a different project name.');
}

export async function setCustomDomain(w, cfg, domain) {
  if (cfg.hosting.provider === 'netlify') {
    const r = await cli(w, cfg, ['api', 'updateSite', '--data', JSON.stringify({ site_id: cfg.hosting.site_id, body: { custom_domain: domain } })]);
    if (r.code !== 0) throw new UserError(`Netlify could not add ${domain}: ${clean(r.stderr || r.stdout).slice(-300)}`);
    return { automatic: true, cname_target: `${cfg.hosting.project}.netlify.app` };
  }
  return {
    automatic: false,
    cname_target: (cfg.hosting.default_url || `https://${cfg.hosting.project}.pages.dev`).replace(/^https:\/\//, ''),
    steps: [
      'Open dash.cloudflare.com → Workers & Pages → select your prototypes project.',
      'Open the "Custom domains" tab → "Set up a custom domain".',
      `Enter ${domain} and continue.`,
      'Cloudflare will show a CNAME record. Add it at the company that manages your domain DNS.',
      'Wait until the domain shows "Active" (usually minutes, sometimes a few hours).',
    ],
  };
}

export async function deploySite(w, cfg) {
  const provider = cfg.hosting.provider;
  providerInfo(provider);
  if (!cfg.hosting.project) throw new UserError('No hosting project has been created yet.', 'Run /prospect:setup → Hosting.');
  if (provider === 'cloudflare') {
    const r = await cli(w, cfg, ['pages', 'deploy', w.site, '--project-name', cfg.hosting.project, '--branch', 'main', '--commit-dirty=true'], { timeoutMs: 10 * 60_000 });
    const out = clean(r.stdout + r.stderr);
    if (r.code !== 0) {
      if (/not authenticated|login/i.test(out)) throw new UserError('Your Cloudflare login has expired.', `Run: ${loginCommand(w, provider)}`);
      throw new UserError(`Cloudflare upload failed: ${out.split('\n').slice(-4).join(' ').slice(0, 400)}`);
    }
    return { provider, reference: (out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/) || [])[0] || null, log_tail: out.split('\n').slice(-3).join(' ') };
  }
  const r = await cli(w, cfg, ['deploy', '--prod', '--dir', w.site, '--site', cfg.hosting.site_id, '--json'], { timeoutMs: 10 * 60_000 });
  let data = null;
  try {
    data = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  } catch { /* error */ }
  if (r.code !== 0 || !data) {
    const out = clean(r.stderr || r.stdout);
    if (/not logged in|unauthori[sz]ed/i.test(out)) throw new UserError('Your Netlify login has expired.', `Run: ${loginCommand(w, provider)}`);
    if (/credit|usage|limit/i.test(out)) throw new UserError('Netlify refused the deploy because your plan limit was reached.', 'Wait for the monthly reset, or switch to Cloudflare Pages in /prospect:setup.');
    throw new UserError(`Netlify upload failed: ${out.slice(-400)}`);
  }
  return { provider, reference: data.deploy_id || data.deploy_url || null, log_tail: data.deploy_url || '' };
}
