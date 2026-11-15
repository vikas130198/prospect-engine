// Workspace configuration (non-secret) and secrets file handling.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, workspacePaths } from './paths.mjs';
import { deepMerge, ensureDir, exists, readJSON, UserError, writeJSON, writeText } from './util.mjs';

export const DEFAULT_CONFIG = {
  schema: 1,
  agency: {
    name: '',
    contact_name: '',
    role: '',
    website: '',
    email: '',
    phone: '',
    signature: '',
  },
  hosting: {
    provider: null, // "cloudflare" | "netlify"
    project: null, // Cloudflare Pages project name or Netlify site name
    site_id: null, // Netlify site id
    account_id: null, // Cloudflare account id (only when the login has several accounts)
    default_url: null, // e.g. https://agency-prototypes.pages.dev
    custom_domain: null, // e.g. prototype.youragency.com
    base_url: null, // e.g. https://prototype.youragency.com
  },
  email: {
    method: null, // "gmail" | "imap"
    from_name: '',
    from_address: '',
    imap: { host: '', port: 993, secure: true, user: '' },
  },
  mode: 'lite', // "lite" | "full"
  limits: {
    lite: { competitors: 3, fix_attempts: 2, pages: 1 },
    full: { competitors: 5, fix_attempts: 3, pages: 1 },
  },
  prototype: { expiry_days: 30, reminder_days: 5 },
  integrations: { meta_graph_version: 'v23.0' },
};

const TOP_LEVEL_KEYS = Object.keys(DEFAULT_CONFIG);

export function loadConfig(w) {
  return deepMerge(DEFAULT_CONFIG, readJSON(w.config, {}));
}

export function saveConfig(w, cfg) {
  writeJSON(w.config, cfg);
}

export function updateConfig(w, patch) {
  for (const k of Object.keys(patch || {})) {
    if (!TOP_LEVEL_KEYS.includes(k)) throw new UserError(`Unknown setting "${k}".`, `Valid sections: ${TOP_LEVEL_KEYS.join(', ')}.`);
  }
  if (patch.mode && !['lite', 'full'].includes(patch.mode)) throw new UserError('mode must be "lite" or "full".');
  if (patch.hosting?.provider && !['cloudflare', 'netlify'].includes(patch.hosting.provider)) {
    throw new UserError('hosting.provider must be "cloudflare" or "netlify".');
  }
  if (patch.email?.method && !['gmail', 'imap'].includes(patch.email.method)) throw new UserError('email.method must be "gmail" or "imap".');
  if (patch.hosting?.base_url) patch.hosting.base_url = String(patch.hosting.base_url).replace(/\/+$/, '');
  const cfg = deepMerge(loadConfig(w), patch);
  saveConfig(w, cfg);
  return cfg;
}

const SECRET_TEMPLATE = `# NexDev Prospect Engine — private settings
# This file stays on your computer. Claude never reads it.
# Fill in only what you use, save the file, then run /prospect:doctor.

# Business email password (only if you chose IMAP drafts instead of Gmail).
# Many providers need an "app password" instead of your normal password.
IMAP_PASSWORD=

# Optional: Google PageSpeed Insights API key (works without one, but with lower limits).
PAGESPEED_API_KEY=

# Optional: official Instagram Graph API (Business Discovery) access.
# Requires your own Instagram Business account connected to a Facebook Page and a Meta app.
META_ACCESS_TOKEN=
META_IG_USER_ID=

# Optional: passwords for protected prototypes, one line per client code, for example:
# PROTOTYPE_PASSWORD_AB7K29X2=choose-a-password
`;

export function initWorkspace(root, { agency } = {}) {
  root = path.resolve(root);
  const w = workspacePaths(root);
  const created = !exists(w.config);
  if (created) {
    saveConfig(w, deepMerge(DEFAULT_CONFIG, agency ? { agency } : {}));
  } else if (agency) {
    updateConfig(w, { agency });
  }
  for (const d of [w.internal, w.locks, w.references, w.leads, w.prototypes]) ensureDir(d);
  if (!exists(w.secrets)) writeText(w.secrets, SECRET_TEMPLATE);
  const gi = path.join(root, '.gitignore');
  if (!exists(gi)) writeText(gi, '.prospect/secrets.env\n.prospect/builder/node_modules/\n.prospect/locks/\nsite/\n');
  if (!exists(w.referencesIndex)) writeJSON(w.referencesIndex, { references: [] });
  if (!exists(w.suppression)) writeJSON(w.suppression, { entries: [] });
  return { workspace: root, created, config_file: path.join(root, CONFIG_FILE), secrets_file: w.secrets };
}

/** Read secrets. Values are only used inside the plugin and never returned to Claude. */
export function readSecrets(w) {
  if (!exists(w.secrets)) return {};
  const out = {};
  for (const line of fs.readFileSync(w.secrets, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) out[m[1]] = v;
  }
  return out;
}

export function secretStatus(w) {
  const s = readSecrets(w);
  return {
    IMAP_PASSWORD: Boolean(s.IMAP_PASSWORD),
    PAGESPEED_API_KEY: Boolean(s.PAGESPEED_API_KEY),
    META_ACCESS_TOKEN: Boolean(s.META_ACCESS_TOKEN),
    META_IG_USER_ID: Boolean(s.META_IG_USER_ID),
    prototype_passwords: Object.keys(s).filter((k) => k.startsWith('PROTOTYPE_PASSWORD_')).map((k) => k.slice('PROTOTYPE_PASSWORD_'.length)),
  };
}

export function configProblems(cfg) {
  const problems = [];
  if (!cfg.agency.name) problems.push('Agency name is not set.');
  if (!cfg.agency.contact_name) problems.push('Your name (sender) is not set.');
  if (!cfg.hosting.provider) problems.push('Hosting provider is not chosen.');
  else if (!cfg.hosting.project) problems.push('Hosting project/site is not created yet.');
  if (!cfg.hosting.base_url) problems.push('Prototype base URL is not known yet.');
  if (!cfg.email.method) problems.push('Email draft method (Gmail or IMAP) is not chosen.');
  if (cfg.email.method === 'imap' && (!cfg.email.imap.host || !cfg.email.imap.user)) problems.push('IMAP server or username is missing.');
  return problems;
}
