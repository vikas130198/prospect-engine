#!/usr/bin/env node
// Prospect Engine command-line tool for long-running jobs (install, build, QA, deploy).
// Prints a JSON result on stdout; progress goes to stderr. Used by the plugin's slash commands.
import path from 'node:path';
import { initWorkspace, loadConfig, updateConfig } from './lib/config.mjs';
import { dashboardMetrics, renderDashboard } from './lib/dashboard.mjs';
import { deletePrototype, deployLead, deploymentLogs, extend, prototypeOverview, setActive, setProtected, syncHosting } from './lib/deploy.mjs';
import { saveDraftImap, testImap } from './lib/email.mjs';
import { createProject, hostStatus, loginCommand, setCustomDomain } from './lib/hosting.mjs';
import { getLead, compactLead } from './lib/leads.mjs';
import { CLI_PATH, PLUGIN_ROOT, findWorkspace, requireWorkspace, workspacePaths } from './lib/paths.mjs';
import { buildPrototype } from './lib/prototype.mjs';
import { runQA } from './lib/qa.mjs';
import { doctor, installComponents } from './lib/setup.mjs';
import { formatError, openInBrowser, UserError } from './lib/util.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const pos = argv.slice(1).filter((a) => !a.startsWith('--'));
const flagValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const progress = (s) => process.stderr.write(s);

const HELP = `Prospect Engine CLI

  paths                         show plugin + workspace locations
  init [folder]                 create a workspace (default: current folder)
  install [--host cloudflare|netlify] [--no-lighthouse]
  doctor [--quick]              health check of every component
  host-status                   check hosting login
  host-login                    print the browser-login command for your host
  host-create <name>            create the prototypes project/site
  host-domain <domain>          connect a custom domain like prototype.example.com
  host-test                     upload the site and confirm the address works
  build <lead>                  production build of the current prototype version
  qa <lead> [--no-lighthouse]   run automated tests (5 viewports, functional, SEO)
  deploy <lead> [--protect]     deploy the QA-passed build
  disable|enable <lead>         switch a live prototype off / on
  extend <lead> <days>          extend expiry
  protect <lead> on|off         password protection (password in .prospect/secrets.env)
  delete <lead> [--purge]       remove prototype from hosting (and optionally its source)
  sync                          re-upload all live prototypes (applies expiry)
  prototypes                    list prototypes
  deployments <lead>            deployment history
  draft-imap <lead> [--force]   save the prepared email to your IMAP Drafts folder
  imap-test                     test the mailbox connection
  dashboard [--no-open]         generate and open the HTML dashboard
  status <lead>                 compact lead summary
`;

async function main() {
  if (!cmd || cmd === 'help' || flags.has('--help')) {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === 'paths') {
    const root = findWorkspace();
    return out({ plugin_root: PLUGIN_ROOT, cli: CLI_PATH, node: process.execPath, workspace: root, cwd: process.cwd() });
  }
  if (cmd === 'init') {
    return out(initWorkspace(pos[0] ? path.resolve(pos[0]) : process.cwd()));
  }
  const w = requireWorkspace();
  switch (cmd) {
    case 'install':
      return out(await installComponents(w, { host: flagValue('--host'), lighthouse: !flags.has('--no-lighthouse'), log: progress }));
    case 'doctor':
      return out(await doctor(w, { quick: flags.has('--quick') }));
    case 'host-status':
      return out(await hostStatus(w, loadConfig(w)));
    case 'host-login': {
      const cfg = loadConfig(w);
      if (!cfg.hosting.provider) throw new UserError('Choose a hosting provider first.');
      return out({ command: loginCommand(w, cfg.hosting.provider), note: 'Running this opens your browser. Log in and click Allow/Authorize, then come back.' });
    }
    case 'host-create': {
      const cfg = loadConfig(w);
      const r = await createProject(w, cfg, pos[0] || cfg.hosting.project || `${cfg.agency.name || 'agency'}-prototypes`);
      const updated = updateConfig(w, { hosting: { project: r.project, site_id: r.site_id, default_url: r.default_url, base_url: cfg.hosting.custom_domain ? `https://${cfg.hosting.custom_domain}` : r.default_url } });
      return out({ ...r, base_url: updated.hosting.base_url });
    }
    case 'host-domain': {
      const domain = String(pos[0] || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new UserError('Please give a domain like prototype.youragency.com');
      const cfg = loadConfig(w);
      const r = await setCustomDomain(w, cfg, domain);
      updateConfig(w, { hosting: { custom_domain: domain } });
      return out({ domain, ...r, dns_record: { type: 'CNAME', name: domain.split('.')[0], value: r.cname_target }, next: 'After the DNS record is added and SSL is active, run: host-test --use-domain' });
    }
    case 'host-test': {
      let cfg = loadConfig(w);
      if (flags.has('--use-domain') && cfg.hosting.custom_domain) cfg = updateConfig(w, { hosting: { base_url: `https://${cfg.hosting.custom_domain}` } });
      if (!cfg.hosting.base_url && cfg.hosting.default_url) cfg = updateConfig(w, { hosting: { base_url: cfg.hosting.default_url } });
      progress('Uploading site…\n');
      const sync = await syncHosting(w);
      let ok = false;
      let detail = '';
      for (let i = 0; i < 8 && !ok; i++) {
        try {
          const r = await fetch(cfg.hosting.base_url + '/', { signal: AbortSignal.timeout(12000) });
          const body = await r.text();
          const robots = await fetch(cfg.hosting.base_url + '/robots.txt', { signal: AbortSignal.timeout(12000) }).then((x) => x.text()).catch(() => '');
          ok = r.ok && body.includes('prospect-root');
          detail = `HTTP ${r.status}; noindex header: ${/noindex/i.test(r.headers.get('x-robots-tag') || '')}; robots.txt blocks crawlers: ${/Disallow: \//.test(robots)}`;
        } catch (e) {
          detail = e.cause?.code || e.message;
        }
        if (!ok) await new Promise((r) => setTimeout(r, 5000));
      }
      return out({ ok, base_url: cfg.hosting.base_url, detail, live_prototypes: sync.live.length, hint: ok ? null : 'If you just connected a custom domain, DNS and SSL can take a while. Try again later.' });
    }
    case 'build':
      need(pos[0], 'lead id');
      progress(`Building ${pos[0]}…\n`);
      return out(await buildPrototype(w, pos[0]));
    case 'qa':
      need(pos[0], 'lead id');
      progress(`Testing ${pos[0]} on 5 screen sizes…\n`);
      return out(await runQA(w, pos[0], { skipLighthouse: flags.has('--no-lighthouse') }));
    case 'deploy':
      need(pos[0], 'lead id');
      progress(`Deploying ${pos[0]}…\n`);
      return out(await deployLead(w, pos[0], { protect: flags.has('--protect') }));
    case 'disable':
      need(pos[0], 'lead id');
      return out(await setActive(w, pos[0], false, flagValue('--reason')));
    case 'enable':
      need(pos[0], 'lead id');
      return out(await setActive(w, pos[0], true));
    case 'extend':
      need(pos[0], 'lead id');
      return out(await extend(w, pos[0], pos[1] || loadConfig(w).prototype.expiry_days));
    case 'protect':
      need(pos[0], 'lead id');
      return out(await setProtected(w, pos[0], pos[1] !== 'off'));
    case 'delete':
      need(pos[0], 'lead id');
      return out(await deletePrototype(w, pos[0], { purgeSource: flags.has('--purge') }));
    case 'sync':
      return out(await syncHosting(w));
    case 'prototypes':
      return out(prototypeOverview(w));
    case 'deployments':
      need(pos[0], 'lead id');
      return out(deploymentLogs(w, pos[0]));
    case 'draft-imap':
      need(pos[0], 'lead id');
      return out(await saveDraftImap(w, pos[0], { force: flags.has('--force') }));
    case 'imap-test':
      return out(await testImap(w));
    case 'dashboard': {
      const r = renderDashboard(w);
      const opened = flags.has('--no-open') ? false : openInBrowser(r.file);
      return out({ file: r.file, opened, metrics: r.metrics });
    }
    case 'metrics':
      return out(dashboardMetrics(w));
    case 'status':
      need(pos[0], 'lead id');
      return out(compactLead(getLead(w, pos[0])));
    default:
      throw new UserError(`Unknown command "${cmd}".`, 'Run with "help" to see commands.');
  }
}

function need(v, what) {
  if (!v) throw new UserError(`Missing ${what}.`);
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ ok: false, error: formatError(e) }, null, 2) + '\n');
  if (!(e instanceof UserError)) process.stderr.write((e?.stack || String(e)) + '\n');
  process.exitCode = 1;
});

export { workspacePaths };
