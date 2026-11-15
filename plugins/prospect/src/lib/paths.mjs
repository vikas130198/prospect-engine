// Locations of the plugin itself and of the user's workspace.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exists, UserError } from './util.mjs';

// The plugin root is the nearest parent folder containing .claude-plugin/ (works from dist/ bundles and from src/).
function pluginRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (exists(path.join(dir, '.claude-plugin'))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}
export const PLUGIN_ROOT = pluginRoot();
export const TEMPLATES = path.join(PLUGIN_ROOT, 'templates');
export const CLI_PATH = path.join(PLUGIN_ROOT, 'dist', 'cli.mjs');

export const CONFIG_FILE = 'prospect.config.json';

export function findWorkspace(start = process.env.PROSPECT_WORKSPACE || process.env.CLAUDE_PROJECT_DIR || process.cwd()) {
  let dir = path.resolve(start);
  for (let i = 0; i < 25; i++) {
    if (exists(path.join(dir, CONFIG_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function workspacePaths(root) {
  const internal = path.join(root, '.prospect');
  return {
    root,
    config: path.join(root, CONFIG_FILE),
    internal,
    secrets: path.join(internal, 'secrets.env'),
    codes: path.join(internal, 'codes.json'),
    suppression: path.join(internal, 'suppression.json'),
    locks: path.join(internal, 'locks'),
    builder: path.join(internal, 'builder'),
    usage: path.join(internal, 'usage.jsonl'),
    references: path.join(root, 'references'),
    referencesIndex: path.join(root, 'references', 'references.json'),
    leads: path.join(root, 'leads'),
    prototypes: path.join(root, 'prototypes'),
    site: path.join(root, 'site'),
    dashboard: path.join(root, 'dashboard.html'),
  };
}

export function requireWorkspace() {
  const root = findWorkspace();
  if (!root) {
    throw new UserError(
      'No Prospect Engine workspace was found in this folder.',
      'Start Claude Code inside your workspace folder (for example NexDev-Prospects), or run /prospect:setup to create one here.',
    );
  }
  return workspacePaths(root);
}

const LEAD_ID = /^[a-z0-9][a-z0-9_-]{0,59}$/;

export function leadDir(w, leadId) {
  if (!LEAD_ID.test(String(leadId || ''))) throw new UserError(`"${leadId}" is not a valid lead id.`, 'Use /prospect:list to see lead ids.');
  return path.join(w.leads, leadId);
}

const CODE_RE = /^[A-Z0-9]{6,12}$/;
export function prototypeDir(w, code) {
  if (!CODE_RE.test(String(code || ''))) throw new UserError(`"${code}" is not a valid client code.`);
  return path.join(w.prototypes, code);
}
