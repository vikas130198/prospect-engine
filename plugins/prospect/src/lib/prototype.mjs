// Engine 4: prototype source versions + production build.
import fs from 'node:fs';
import path from 'node:path';
import { allocateCode } from './codes.mjs';
import { loadConfig } from './config.mjs';
import { skeletonContent, validateContent } from './content-check.mjs';
import { getLead, logActivity, requireApproved, requireStageDone, saveLead, setStage } from './leads.mjs';
import { prototypeDir, TEMPLATES } from './paths.mjs';
import { copyDir, dirSize, ensureDir, exists, hashDir, lastLines, now, readJSON, removeDir, run, runNpm, UserError, withLock, writeJSON } from './util.mjs';

export function versionDir(w, code, v) {
  return path.join(prototypeDir(w, code), `v${v}`);
}
export function distDir(w, code, v) {
  return path.join(prototypeDir(w, code), 'dist', `v${v}`);
}

export function currentVersion(lead) {
  const p = lead.prototype;
  if (!p?.code || !p.current_version) throw new UserError('No prototype has been generated for this lead yet.', `Run /prospect:resume ${lead.id}.`);
  return { code: p.code, v: p.current_version, meta: p.versions[p.current_version] };
}

/** Create the first (or a fresh) prototype version from the saved design selection. */
export function createPrototype(w, leadId, { sections } = {}) {
  const lead = getLead(w, leadId);
  requireApproved(lead);
  requireStageDone(lead, 'design');
  if (!lead.design?.layout) throw new UserError('No design has been selected yet.', 'Run the design selection step first.');
  const cfg = loadConfig(w);
  if (!lead.prototype) lead.prototype = { code: allocateCode(w, lead.id), current_version: null, versions: {} };
  const code = lead.prototype.code;
  const v = Math.max(0, ...Object.keys(lead.prototype.versions).map(Number)) + 1;
  const dir = versionDir(w, code, v);
  ensureDir(path.join(dir, 'assets'));
  ensureDir(path.join(dir, 'custom'));
  const content = skeletonContent({
    layout: lead.design.layout,
    theme: lead.design.theme,
    business_name: lead.business_name,
    agency: cfg.agency,
    sections: sections || lead.design.sections,
    motion: lead.design.motion || null,
  });
  if (lead.design.theme_colors) content.theme.colors = lead.design.theme_colors;
  writeJSON(path.join(dir, 'content.json'), content);
  lead.prototype.versions[v] = { created_at: now(), from: null, note: 'Initial version from design plan', build: null, qa: null };
  lead.prototype.current_version = v;
  saveLead(w, lead);
  setStage(w, lead, 'prototype', 'RUNNING');
  logActivity(w, lead.id, 'prototype_created', `Prototype ${code} v${v} created`);
  return { code, version: v, folder: dir, content_file: path.join(dir, 'content.json'), assets_folder: path.join(dir, 'assets'), custom_folder: path.join(dir, 'custom') };
}

/** Copy the current (or given) version to a new version so previous work is never overwritten. */
export function newVersion(w, leadId, { from, note } = {}) {
  const lead = getLead(w, leadId);
  const { code, v: cur } = currentVersion(lead);
  const src = from || cur;
  if (!lead.prototype.versions[src]) throw new UserError(`Version ${src} does not exist.`);
  const v = Math.max(...Object.keys(lead.prototype.versions).map(Number)) + 1;
  copyDir(versionDir(w, code, src), versionDir(w, code, v));
  lead.prototype.versions[v] = { created_at: now(), from: Number(src), note: note || null, build: null, qa: null };
  lead.prototype.current_version = v;
  saveLead(w, lead);
  logActivity(w, lead.id, 'prototype_version', `New version v${v} from v${src}${note ? `: ${note}` : ''}`);
  return { code, version: v, folder: versionDir(w, code, v), content_file: path.join(versionDir(w, code, v), 'content.json') };
}

export function restoreVersion(w, leadId, version) {
  const lead = getLead(w, leadId);
  if (!lead.prototype?.versions?.[version]) throw new UserError(`Version ${version} does not exist.`);
  lead.prototype.current_version = Number(version);
  saveLead(w, lead);
  logActivity(w, lead.id, 'prototype_restore', `Restored v${version} as current`);
  return { code: lead.prototype.code, version: Number(version), build: lead.prototype.versions[version].build, qa: lead.prototype.versions[version].qa };
}

export function checkContent(w, leadId) {
  const lead = getLead(w, leadId);
  const { code, v } = currentVersion(lead);
  const dir = versionDir(w, code, v);
  const content = readJSON(path.join(dir, 'content.json'));
  return { version: v, ...validateContent(content, lead, { customDir: path.join(dir, 'custom') }) };
}

// ---------- builder environment ----------

const BUILDER_FILES = ['package.json', 'vite.config.js', 'index.html', 'tsconfig.json', 'src'];

/** Every runtime dependency of the template is present in the builder's node_modules. */
export function builderDepsPresent(w) {
  const pkg = readJSON(path.join(TEMPLATES, 'builder', 'package.json'));
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).every((d) => exists(path.join(w.builder, 'node_modules', ...d.split('/'), 'package.json')));
}

export function builderInstalled(w) {
  return exists(path.join(w.builder, 'node_modules', 'vite', 'bin', 'vite.js'));
}

/** Refresh builder source from the plugin (keeps node_modules); returns true if dependencies changed. */
export function syncBuilder(w) {
  ensureDir(w.builder);
  const srcRoot = path.join(TEMPLATES, 'builder');
  const before = exists(path.join(w.builder, 'package.json')) ? readJSON(path.join(w.builder, 'package.json')) : null;
  for (const f of BUILDER_FILES) {
    const from = path.join(srcRoot, f);
    if (f === 'src') {
      removeDir(path.join(w.builder, 'src'));
      copyDir(from, path.join(w.builder, 'src'), { filter: (p) => !p.includes(`${path.sep}site${path.sep}`) || p.endsWith(`${path.sep}site`) });
      ensureDir(path.join(w.builder, 'src', 'site'));
    } else if (f === 'package.json') {
      // Preserve extra deps added by the installer (host CLIs, lighthouse).
      const pkg = readJSON(from);
      if (before) {
        pkg.devDependencies = { ...before.devDependencies, ...pkg.devDependencies };
        pkg.dependencies = { ...before.dependencies, ...pkg.dependencies };
      }
      writeJSON(path.join(w.builder, 'package.json'), pkg);
    } else {
      fs.copyFileSync(from, path.join(w.builder, f));
    }
  }
  const after = readJSON(path.join(w.builder, 'package.json'));
  return JSON.stringify(before?.dependencies) !== JSON.stringify(after.dependencies) || JSON.stringify(before?.devDependencies) !== JSON.stringify(after.devDependencies);
}

function summarizeBuildErrors(out) {
  const lines = out.split(/\r?\n/);
  const important = lines.filter((l) => /error|Error|failed|Could not|Unexpected|is not exported|Cannot find|\.tsx?:\d+/.test(l)).slice(0, 25);
  return (important.length ? important.join('\n') : lastLines(out, 30)).replace(/\x1b\[[0-9;]*m/g, '');
}

export async function buildPrototype(w, leadId) {
  return withLock(path.join(w.locks, 'builder.lock'), async () => {
    const lead = getLead(w, leadId);
    requireApproved(lead);
    const { code, v } = currentVersion(lead);
    const vdir = versionDir(w, code, v);
    const content = readJSON(path.join(vdir, 'content.json'));
    const check = validateContent(content, lead, { customDir: path.join(vdir, 'custom') });
    const record = (build) => {
      const l = getLead(w, leadId);
      l.prototype.versions[v].build = build;
      l.prototype.versions[v].qa = null;
      saveLead(w, l);
      return l;
    };
    if (check.errors.length) {
      record({ status: 'failed', step: 'content_check', at: now(), errors: check.errors });
      logActivity(w, leadId, 'build_failed', `Content check failed (${check.errors.length} problems)`);
      return { ok: false, step: 'content_check', version: v, errors: check.errors, warnings: check.warnings, placeholders: check.placeholders.length };
    }
    if (!builderInstalled(w)) throw new UserError('The website builder is not installed yet.', 'Run /prospect:setup (step "Install components").');
    // A plugin update can add template packages: install them automatically (only the missing ones download).
    if (syncBuilder(w) || !builderDepsPresent(w)) {
      const res = await runNpm(['install', '--no-audit', '--no-fund', '--loglevel=error', '--no-update-notifier'], { cwd: w.builder, timeoutMs: 10 * 60_000 });
      if (res.code !== 0 || !builderDepsPresent(w)) throw new UserError('The plugin was updated and the builder could not download its new components.', 'Check your internet connection, then run /prospect:setup and choose "Install components".');
    }

    // Place this prototype's source into the builder.
    const siteDir = path.join(w.builder, 'src', 'site');
    removeDir(siteDir);
    copyDir(vdir, siteDir);
    const cfg = loadConfig(w);
    const built = structuredClone(content);
    built.preview = { agency_name: cfg.agency.name || built.preview?.agency_name || 'Our studio', agency_url: /^https:\/\//.test(cfg.agency.website || '') ? cfg.agency.website : built.preview?.agency_url || '' };
    writeJSON(path.join(siteDir, 'content.json'), built);

    const out = distDir(w, code, v);
    removeDir(out);
    const started = Date.now();
    const res = await run(process.execPath, [path.join(w.builder, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--base', `/client/${code}/`, '--outDir', out, '--emptyOutDir'], {
      cwd: w.builder,
      env: { PROSPECT_CODE: code, NODE_ENV: 'production', FORCE_COLOR: '0' },
      timeoutMs: 5 * 60_000,
    });
    const log = (res.stdout + '\n' + res.stderr).trim();
    fs.writeFileSync(path.join(prototypeDir(w, code), `build-v${v}.log`), log);
    const missing = [];
    if (res.code === 0) {
      if (!exists(path.join(out, 'index.html'))) missing.push('index.html');
      if (!exists(path.join(out, 'assets')) || !fs.readdirSync(path.join(out, 'assets')).some((f) => f.endsWith('.js'))) missing.push('JavaScript bundle');
    }
    if (res.code !== 0 || missing.length) {
      const errors = res.code !== 0 ? summarizeBuildErrors(log) : `Build finished but these are missing: ${missing.join(', ')}`;
      record({ status: 'failed', step: 'compile', at: now(), errors: [errors] });
      logActivity(w, leadId, 'build_failed', 'Production build failed');
      return { ok: false, step: 'compile', version: v, errors: [errors], log_file: path.join(prototypeDir(w, code), `build-v${v}.log`) };
    }
    const size = dirSize(out);
    const hash = hashDir(out);
    const l = record({ status: 'passed', at: now(), hash, seconds: Math.round((Date.now() - started) / 1000), total_kb: Math.round(size.total / 1024) });
    if (l.stages.prototype.status !== 'COMPLETED') setStage(w, l, 'prototype', 'COMPLETED');
    logActivity(w, leadId, 'build_passed', `Built ${code} v${v} (${Math.round(size.total / 1024)} KB)`);
    return { ok: true, version: v, code, out_dir: out, total_kb: Math.round(size.total / 1024), build_hash: hash, warnings: check.warnings, placeholders: check.placeholders };
  });
}
