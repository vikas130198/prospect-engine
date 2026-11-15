// Shared helpers: errors, JSON storage with atomic writes, process execution, locks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

/** An error that is safe and useful to show to the user (no stack trace). */
export class UserError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'UserError';
    this.hint = hint;
  }
}

export function formatError(err) {
  if (err instanceof UserError) return err.hint ? `${err.message}\nHow to fix: ${err.hint}` : err.message;
  return `Unexpected error: ${err?.message || String(err)}`;
}

export const now = () => new Date().toISOString();

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT' && fallback !== undefined) return structuredClone(fallback);
    if (e.code === 'ENOENT') throw new UserError(`File not found: ${file}`);
    throw new UserError(`Could not read ${file}: ${e.message}`, 'The file may be corrupted. Restore it from a backup or fix the JSON syntax.');
  }
}

function renameWithRetry(from, to) {
  // Windows can briefly lock files (antivirus, indexers). Retry a few times.
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      const until = Date.now() + 50 * (i + 1);
      while (Date.now() < until) { /* short spin wait */ }
    }
  }
}

/** Write JSON atomically (temp file + rename) so a crash never leaves a half-written file. */
export function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameWithRetry(tmp, file);
}

export function writeText(file, text) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, text);
  renameWithRetry(tmp, file);
}

export function appendLine(file, obj) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

export function copyDir(src, dest, { filter } = {}) {
  fs.cpSync(src, dest, { recursive: true, force: true, filter: filter ? (s) => filter(s) : undefined });
}

export function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export function deepMerge(target, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  }
  return out;
}

export function slugify(s, max = 40) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'item';
}

export function hashDir(dir) {
  const h = crypto.createHash('sha256');
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        h.update(path.relative(dir, p).replace(/\\/g, '/'));
        h.update(fs.readFileSync(p));
      }
    }
  };
  walk(dir);
  return h.digest('hex').slice(0, 16);
}

export function dirSize(dir) {
  let total = 0;
  const files = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        total += st.size;
        files.push({ file: path.relative(dir, p).replace(/\\/g, '/'), size: st.size });
      }
    }
  };
  walk(dir);
  return { total, files };
}

/**
 * Run a command without a shell when possible. Returns { code, stdout, stderr }.
 * Never throws on non-zero exit; throws UserError if the binary is missing or times out.
 */
export function run(cmd, args = [], { cwd, env, timeoutMs = 10 * 60_000, shell = false, onOutput } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell, windowsHide: true });
    } catch (e) {
      reject(new UserError(`Could not start ${cmd}: ${e.message}`));
      return;
    }
    let stdout = '';
    let stderr = '';
    const cap = (s, chunk) => (s.length > 2_000_000 ? s : s + chunk);
    child.stdout?.on('data', (d) => {
      stdout = cap(stdout, d.toString());
      onOutput?.(d.toString());
    });
    child.stderr?.on('data', (d) => {
      stderr = cap(stderr, d.toString());
      onOutput?.(d.toString());
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new UserError(`${path.basename(cmd)} took too long (over ${Math.round(timeoutMs / 1000)}s) and was stopped.`));
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new UserError(`Could not run ${cmd}: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Locate npm's JS entry so we can run it with node directly (avoids .cmd/shell issues on Windows). */
export function npmCli() {
  const dir = path.dirname(process.execPath);
  const candidates = [
    path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(dir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  return candidates.find(exists) || null;
}

export async function runNpm(args, opts) {
  const cli = npmCli();
  if (cli) return run(process.execPath, [cli, ...args], opts);
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { ...opts, shell: process.platform === 'win32' });
}

/** Simple cross-process lock using an exclusive lock file. Stale locks (>20 min) are taken over. */
export async function withLock(lockFile, fn, { waitMs = 5 * 60_000 } = {}) {
  ensureDir(path.dirname(lockFile));
  const start = Date.now();
  for (;;) {
    try {
      fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, at: now() }), { flag: 'wx' });
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const age = Date.now() - fs.statSync(lockFile).mtimeMs;
        if (age > 20 * 60_000) {
          fs.rmSync(lockFile, { force: true });
          continue;
        }
      } catch { /* lock vanished, retry */ }
      if (Date.now() - start > waitMs) throw new UserError('Another build or deployment is still running.', 'Wait for it to finish, then try again.');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(lockFile, { force: true });
  }
}

export function truncate(s, n = 2000) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + `… [${s.length - n} more characters]` : s;
}

export function lastLines(s, n = 40) {
  return String(s || '').trim().split(/\r?\n/).slice(-n).join('\n');
}

export function openInBrowser(target) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', target] : [target];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return true;
  } catch {
    return false;
  }
}
