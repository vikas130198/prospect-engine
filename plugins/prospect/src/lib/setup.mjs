// First-time installation of local components + the health check used by /prospect:doctor.
import fs from 'node:fs';
import path from 'node:path';
import { configProblems, loadConfig, secretStatus } from './config.mjs';
import { cliInstalled, hostStatus, PROVIDERS } from './hosting.mjs';
import { testImap } from './email.mjs';
import { prototypeOverview } from './deploy.mjs';
import { builderInstalled, syncBuilder } from './prototype.mjs';
import { findChrome } from './qa.mjs';
import { TEMPLATES } from './paths.mjs';
import { copyDir, exists, readJSON, removeDir, run, runNpm, UserError, withLock, writeJSON } from './util.mjs';

export async function installComponents(w, { host, lighthouse = true, log = () => {} } = {}) {
  return withLock(path.join(w.locks, 'builder.lock'), async () => {
    const cfg = loadConfig(w);
    const provider = host || cfg.hosting.provider;
    syncBuilder(w);
    const pkgFile = path.join(w.builder, 'package.json');
    const pkg = readJSON(pkgFile);
    pkg.devDependencies = pkg.devDependencies || {};
    if (provider) {
      const p = PROVIDERS[provider];
      if (!p) throw new UserError(`Unknown hosting provider "${provider}".`);
      pkg.devDependencies[p.package] = p.version;
    }
    if (lighthouse) pkg.devDependencies.lighthouse = '^12';
    writeJSON(pkgFile, pkg);
    log('Installing website builder, testing browser driver' + (provider ? `, ${PROVIDERS[provider].label} tools` : '') + (lighthouse ? ', Lighthouse' : '') + ' — this can take a few minutes…\n');
    const res = await runNpm(['install', '--no-audit', '--no-fund', '--loglevel=error', '--no-update-notifier'], { cwd: w.builder, timeoutMs: 20 * 60_000, onOutput: (s) => log(s) });
    if (res.code !== 0) {
      const tail = (res.stderr || res.stdout).split(/\r?\n/).filter(Boolean).slice(-8).join('\n');
      throw new UserError(`Installing components failed:\n${tail}`, 'Check your internet connection and try again. Behind a company proxy? Configure npm proxy settings first.');
    }
    if (!builderInstalled(w)) throw new UserError('Install finished but the builder is still missing.', 'Run the install again.');

    // Smoke test: build the bundled sample site to prove the toolchain works on this computer.
    log('Running a test build…\n');
    const site = path.join(w.builder, 'src', 'site');
    removeDir(site);
    copyDir(path.join(TEMPLATES, 'builder', 'src', 'site'), site);
    const out = path.join(w.internal, 'builder-test');
    removeDir(out);
    const b = await run(process.execPath, [path.join(w.builder, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--base', '/client/TEST0000/', '--outDir', out, '--emptyOutDir'], { cwd: w.builder, env: { PROSPECT_CODE: 'TEST0000', FORCE_COLOR: '0' }, timeoutMs: 5 * 60_000 });
    const ok = b.code === 0 && exists(path.join(out, 'index.html'));
    removeDir(out);
    if (!ok) throw new UserError(`The test build failed:\n${(b.stderr || b.stdout).split('\n').slice(-10).join('\n')}`);
    return {
      ok: true,
      builder: w.builder,
      host_tools: provider ? cliInstalled(w, provider) : null,
      lighthouse,
      browser_for_testing: findChrome() || 'No Chrome/Edge found — install Google Chrome',
    };
  });
}

export async function doctor(w, { quick = false } = {}) {
  const checks = [];
  const add = (name, ok, detail, fix) => checks.push({ check: name, ok: ok === true ? 'ok' : ok === false ? 'fail' : 'warn', detail, ...(fix ? { fix } : {}) });
  const [major, minor] = process.versions.node.split('.').map(Number);
  const nodeOk = major > 22 || (major === 22 && minor >= 13);
  add('Node.js', nodeOk, `v${process.versions.node}`, nodeOk ? null : 'Install Node.js 22.13 or newer (the LTS version from nodejs.org)');
  const cfg = loadConfig(w);
  const problems = configProblems(cfg);
  add('Agency profile', Boolean(cfg.agency.name && cfg.agency.contact_name), cfg.agency.name ? `${cfg.agency.name} (${cfg.agency.contact_name || 'no sender name'})` : 'not set', cfg.agency.name ? null : 'Run /prospect:setup → Agency profile');
  add('Website builder', builderInstalled(w), builderInstalled(w) ? 'installed' : 'not installed', builderInstalled(w) ? null : 'Run /prospect:setup → Install components');
  let pw = false;
  try {
    pw = exists(path.join(w.builder, 'node_modules', 'playwright-core', 'package.json'));
  } catch { /* no */ }
  const chrome = findChrome();
  add('Testing browser', Boolean(pw && chrome), chrome ? `${path.basename(chrome)}${pw ? '' : ' (driver missing)'}` : 'Chrome/Edge not found', chrome ? (pw ? null : 'Run /prospect:setup → Install components') : 'Install Google Chrome from google.com/chrome');
  add('Lighthouse (optional)', exists(path.join(w.builder, 'node_modules', 'lighthouse', 'package.json')) ? true : null, exists(path.join(w.builder, 'node_modules', 'lighthouse')) ? 'installed' : 'not installed — QA still runs without it');

  if (!cfg.hosting.provider) add('Hosting', false, 'not chosen', 'Run /prospect:setup → Hosting');
  else {
    const label = PROVIDERS[cfg.hosting.provider].label;
    if (!cliInstalled(w, cfg.hosting.provider)) add('Hosting', false, `${label} tools not installed`, 'Run /prospect:setup → Install components');
    else if (!quick) {
      const st = await hostStatus(w, cfg).catch((e) => ({ error: e.message }));
      if (st.error) add('Hosting login', false, st.error);
      else add('Hosting login', st.logged_in, st.logged_in ? `${label}${st.email ? ` as ${st.email}` : ''}${st.accounts?.length > 1 ? ` (${st.accounts.length} accounts${cfg.hosting.account_id ? ', one selected' : ' — choose one'})` : ''}` : 'not logged in', st.logged_in ? null : 'Run /prospect:setup → Hosting → log in');
      if (st.accounts?.length > 1 && !cfg.hosting.account_id) add('Cloudflare account', false, `Several accounts: ${st.accounts.join(', ')}`, 'Ask Claude to save the one to use as hosting.account_id');
    }
    add('Hosting project', Boolean(cfg.hosting.project), cfg.hosting.project || 'not created', cfg.hosting.project ? null : 'Run /prospect:setup → Hosting');
    if (cfg.hosting.base_url && !quick) {
      try {
        const r = await fetch(cfg.hosting.base_url + '/', { signal: AbortSignal.timeout(12000) });
        const body = await r.text();
        add('Prototype address', r.ok ? (body.includes('prospect-root') ? true : null) : false, `${cfg.hosting.base_url} → HTTP ${r.status}${r.ok && !body.includes('prospect-root') ? ' (reachable; nothing deployed yet)' : ''}`, r.ok ? null : 'If you just added a custom domain, wait for DNS/SSL. Otherwise run the hosting test in /prospect:setup.');
      } catch (e) {
        add('Prototype address', false, `${cfg.hosting.base_url} unreachable (${e.cause?.code || e.message})`, cfg.hosting.custom_domain ? 'Check the CNAME record for your custom domain, then wait for DNS to update.' : 'Run the hosting test in /prospect:setup.');
      }
    }
  }

  if (!cfg.email.method) add('Email drafts', false, 'not chosen', 'Run /prospect:setup → Email');
  else if (cfg.email.method === 'gmail') add('Email drafts', null, 'Gmail connector — Claude checks the connector is available when saving drafts', 'If drafts fail: claude.ai → Settings → Connectors → Gmail → Connect, then restart Claude Code');
  else if (!quick) {
    const t = await testImap(w);
    add('Email drafts (IMAP)', t.ok, t.ok ? `${cfg.email.imap.user} → ${t.drafts_folder}` : t.error, t.ok ? null : 'Check .prospect/secrets.env (IMAP_PASSWORD) and the server settings in /prospect:setup');
  }
  const sec = secretStatus(w);
  add('Private settings file', exists(w.secrets), exists(w.secrets) ? '.prospect/secrets.env present (contents never shown)' : 'missing', exists(w.secrets) ? null : 'Run /prospect:setup to recreate it');
  add('Instagram API (optional)', sec.META_ACCESS_TOKEN && sec.META_IG_USER_ID ? true : null, sec.META_ACCESS_TOKEN && sec.META_IG_USER_ID ? 'configured' : 'not configured — research uses public sources and screenshots');
  add('PageSpeed key (optional)', sec.PAGESPEED_API_KEY ? true : null, sec.PAGESPEED_API_KEY ? 'configured' : 'not set — works with lower daily limits');
  const gi = path.join(w.root, '.gitignore');
  if (exists(path.join(w.root, '.git'))) add('Secrets kept out of git', exists(gi) && fs.readFileSync(gi, 'utf8').includes('secrets.env'), '.gitignore', 'Add .prospect/secrets.env to .gitignore');

  const protos = prototypeOverview(w);
  const soon = protos.filter((p) => p.expiring_soon);
  if (soon.length) add('Prototypes expiring soon', null, soon.map((p) => `${p.business || p.lead_id} (${p.code}) on ${p.expires}`).join('; '), 'Extend with /prospect:prototypes extend <lead> 30');
  return { ready: !checks.some((c) => c.ok === 'fail'), problems, checks };
}
