// Design library: the user drops website design videos (screen recordings) or screenshots into
// design-library/inbox/. The engine turns each video into a few contact sheets of frames (using the same
// Chrome/Edge the QA step uses — no ffmpeg needed). Claude studies the sheets once and saves a written
// analysis (style, layout, motion, transitions). Every prototype's design step then picks the best-suited
// entries by design fit — not by industry — and applies their look and motion through the template.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ensureDir, exists, now, readJSON, removeDir, slugify, UserError, writeJSON } from './util.mjs';

export const VIDEO = /\.(mp4|webm|mov|m4v|ogv)$/i;
export const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;
const MIME = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.ogv': 'video/ogg' };
const MAX_BYTES = 1_500_000_000;

export function libraryPaths(w) {
  const root = path.join(w.root, 'design-library');
  return { root, inbox: path.join(root, 'inbox'), frames: path.join(root, 'frames'), index: path.join(root, 'library.json') };
}

export function ensureDesignLibrary(w) {
  const p = libraryPaths(w);
  ensureDir(p.inbox);
  ensureDir(p.frames);
  if (!exists(p.index)) writeJSON(p.index, { entries: [] });
  const readme = path.join(p.root, 'README.md');
  if (!exists(readme)) {
    fs.writeFileSync(readme, `# Design library

Drop website design **videos** (screen recordings of sites you love: MP4/WebM/MOV) or **screenshots** into
\`inbox/\`. Before every prototype, Claude checks this folder, studies anything new once, and picks the designs,
animations and transitions that suit the business best — by design fit, not by industry.

- Best results: 20 seconds – 3 minutes per video, recorded at desktop size, scrolling slowly through the whole page.
- Name files so you recognise them, e.g. \`dark-luxury-scroll.mp4\`.
- iPhone .mov (HEVC) may not play in Chrome — export as MP4 (H.264) if a video shows as "unsupported".
- Files are never uploaded anywhere. Frames are saved in \`frames/\`, the analysis in \`library.json\`.
- Inspiration only: prototypes never copy another site's text, images, logos or code.

Commands: \`/prospect:library\` (status), \`/prospect:library scan\` (study new files now), \`/prospect:library remove <id>\`.
`);
  }
  return p;
}

function loadIndex(w) {
  return readJSON(libraryPaths(w).index, { entries: [] });
}
function saveIndex(w, idx) {
  writeJSON(libraryPaths(w).index, idx);
}

/** Cheap fingerprint (size + mtime + first/last 64 KB) so multi-GB videos are never fully re-read. */
function fingerprint(file) {
  const st = fs.statSync(file);
  const h = crypto.createHash('sha1').update(`${st.size}:${Math.round(st.mtimeMs)}`);
  const fd = fs.openSync(file, 'r');
  try {
    const n = Math.min(65536, st.size);
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, 0);
    h.update(buf);
    if (st.size > n) {
      fs.readSync(fd, buf, 0, n, Math.max(0, st.size - n));
      h.update(buf);
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex').slice(0, 16);
}

function walkInbox(dir, base = dir, out = []) {
  if (!exists(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkInbox(full, base, out);
    else if (VIDEO.test(name) || IMAGE.test(name)) out.push({ full, rel: path.relative(base, full).replace(/\\/g, '/'), size: st.size });
  }
  return out;
}

/** Compare the inbox with the index: new, changed and removed files. Does not process anything. */
export function syncInbox(w) {
  const p = ensureDesignLibrary(w);
  const idx = loadIndex(w);
  const files = walkInbox(p.inbox);
  const seen = new Set();
  for (const f of files) {
    const fp = fingerprint(f.full);
    seen.add(f.rel);
    // The user removed this exact file from the library earlier: leave it alone.
    if (idx.entries.some((x) => x.removed && x.fingerprint === fp)) continue;
    let e = idx.entries.find((x) => x.file === f.rel && !x.removed);
    if (e && e.fingerprint === fp) {
      if (e.status === 'missing') e.status = e.analysis ? 'analysed' : 'new';
      continue;
    }
    if (!e) {
      let id = slugify(path.basename(f.rel).replace(/\.[^.]+$/, '')) || 'design';
      let n = 2;
      while (idx.entries.some((x) => x.id === id)) id = `${slugify(path.basename(f.rel).replace(/\.[^.]+$/, ''))}-${n++}`;
      e = { id, file: f.rel, added_at: now() };
      idx.entries.push(e);
    }
    Object.assign(e, { kind: VIDEO.test(f.rel) ? 'video' : 'image', fingerprint: fp, size_mb: Math.round((f.size / 1048576) * 10) / 10, status: 'new', sheets: [], analysis: e.analysis ? { ...e.analysis, outdated: true } : null, error: null });
    if (e.kind === 'image') {
      e.sheets = [path.relative(w.root, f.full).replace(/\\/g, '/')];
      e.status = 'frames_ready';
    }
    if (f.size > MAX_BYTES) Object.assign(e, { status: 'unsupported', error: 'File is larger than 1.5 GB — trim or compress it.' });
  }
  for (const e of idx.entries) if (!seen.has(e.file) && !e.removed) e.status = 'missing';
  saveIndex(w, idx);
  return idx;
}

/** Serve one file with HTTP Range support (needed for video seeking). */
function serveFile(file) {
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<!doctype html><html><body style="margin:0;background:#000"></body></html>');
    }
    if (!req.url.startsWith('/video')) {
      res.writeHead(404);
      return res.end();
    }
    const size = fs.statSync(file).size;
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
      fs.createReadStream(file).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

// Runs in the page: draws frames at the given times into labelled contact sheets and returns JPEG data URLs.
async function grabSheets({ src, plans }) {
  const v = document.createElement('video');
  v.muted = true;
  v.preload = 'auto';
  v.crossOrigin = 'anonymous';
  v.src = src;
  document.body.appendChild(v);
  await new Promise((ok, fail) => {
    v.onloadedmetadata = ok;
    v.onerror = () => fail(new Error(`cannot decode (${v.error?.code || '?'})`));
    setTimeout(() => fail(new Error('timed out loading video')), 30000);
  });
  const dur = v.duration;
  if (!isFinite(dur) || dur <= 0 || !v.videoWidth) throw new Error('video has no readable frames');
  const seek = (t) => new Promise((ok) => {
    const done = () => (v.removeEventListener('seeked', done), ok());
    v.addEventListener('seeked', done);
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, dur - 0.05));
    setTimeout(done, 8000);
  });
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
  const landscape = v.videoWidth >= v.videoHeight;
  const sheets = [];
  for (const plan of plans) {
    const times = plan.kind === 'intro'
      ? Array.from({ length: plan.count }, (_, i) => Math.min(dur * 0.98, i * plan.step))
      : plan.kind === 'single'
        ? [dur * plan.at]
        : Array.from({ length: plan.count }, (_, i) => dur * (plan.from + ((plan.to - plan.from) * (i + 0.5)) / plan.count));
    const cols = plan.kind === 'single' ? 1 : landscape ? 3 : 6;
    const rows = Math.ceil(times.length / cols);
    const cellW = plan.kind === 'single' ? Math.min(1600, v.videoWidth) : landscape ? 640 : 320;
    const cellH = Math.round((cellW * v.videoHeight) / v.videoWidth);
    const c = document.createElement('canvas');
    c.width = cols * cellW;
    c.height = rows * cellH;
    const g = c.getContext('2d');
    g.fillStyle = '#111';
    g.fillRect(0, 0, c.width, c.height);
    for (const [i, t] of times.entries()) {
      await seek(t);
      const x = (i % cols) * cellW;
      const y = Math.floor(i / cols) * cellH;
      g.drawImage(v, x, y, cellW, cellH);
      if (plan.kind !== 'single') {
        g.strokeStyle = '#000';
        g.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
        g.fillStyle = 'rgba(0,0,0,.72)';
        g.fillRect(x + 6, y + 6, 74, 24);
        g.fillStyle = '#fff';
        g.font = 'bold 15px sans-serif';
        g.fillText(fmt(t), x + 12, y + 23);
      }
    }
    sheets.push({ name: plan.name, data: c.toDataURL('image/jpeg', 0.82), times: times.map((t) => Math.round(t * 10) / 10) });
  }
  return { duration: Math.round(dur * 10) / 10, width: v.videoWidth, height: v.videoHeight, sheets };
}

function plansFor() {
  // intro: first ~6 s densely (load animations, hero entrance); overview sheets: the whole recording;
  // detail: one full-size frame for typography and colour.
  return [
    { name: 'intro', kind: 'intro', count: 12, step: 0.5 },
    { name: 'overview-1', kind: 'spread', count: 12, from: 0.02, to: 0.5 },
    { name: 'overview-2', kind: 'spread', count: 12, from: 0.5, to: 0.98 },
    { name: 'detail', kind: 'single', at: 0.12 },
  ];
}

/** Extract contact sheets for every new/changed video. Long job → run via the CLI. */
export async function scanLibrary(w, { force = false, log = () => {}, findChrome, loadPlaywright } = {}) {
  const idx = syncInbox(w);
  const p = libraryPaths(w);
  const todo = idx.entries.filter((e) => !e.removed && e.kind === 'video' && (force ? e.status !== 'missing' : e.status === 'new'));
  const result = { processed: [], failed: [], skipped: idx.entries.filter((e) => e.status === 'missing').map((e) => e.id) };
  if (todo.length) {
    const pw = loadPlaywright(w);
    const chrome = findChrome();
    if (!chrome) throw new UserError('Google Chrome or Microsoft Edge is needed to read design videos.', 'Install Google Chrome, then run /prospect:library scan again.');
    const browser = await pw.chromium.launch({ executablePath: chrome, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
      for (const e of todo) {
        log(`Reading ${e.file}…\n`);
        const file = path.join(p.inbox, e.file);
        const { server, base } = await serveFile(file);
        const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
        const page = await ctx.newPage();
        try {
          await page.goto(base + '/', { waitUntil: 'load' });
          const r = await page.evaluate(grabSheets, { src: `${base}/video${path.extname(file)}`, plans: plansFor() });
          const dir = path.join(p.frames, e.id);
          removeDir(dir);
          ensureDir(dir);
          e.sheets = r.sheets.map((s) => {
            const f = path.join(dir, `${s.name}.jpg`);
            fs.writeFileSync(f, Buffer.from(s.data.split(',')[1], 'base64'));
            return path.relative(w.root, f).replace(/\\/g, '/');
          });
          Object.assign(e, { status: 'frames_ready', duration_s: r.duration, resolution: `${r.width}×${r.height}`, sheet_times: Object.fromEntries(r.sheets.map((s) => [s.name, s.times])), frames_at: now(), error: null });
          result.processed.push(e.id);
        } catch (err) {
          const msg = String(err.message || err).split('\n')[0];
          Object.assign(e, { status: 'unsupported', error: /decode|no readable|timed out/.test(msg) ? `Chrome cannot play this video (${msg}). Export it as MP4 (H.264) or WebM and drop it in again.` : msg });
          result.failed.push({ id: e.id, file: e.file, error: e.error });
        } finally {
          await ctx.close().catch(() => {});
          server.close();
        }
      }
    } finally {
      await browser.close().catch(() => {});
    }
    saveIndex(w, idx);
  }
  return { ...result, ...libraryStatus(w) };
}

/** What is in the library and what still needs Claude's analysis. */
export function libraryStatus(w) {
  const idx = loadIndex(w);
  const live = idx.entries.filter((e) => !e.removed);
  const needsAnalysis = live.filter((e) => e.status === 'frames_ready').map((e) => ({ id: e.id, file: e.file, kind: e.kind, duration_s: e.duration_s || null, sheets: e.sheets.map((s) => path.join(w.root, s)), previous_analysis: e.analysis ? 'outdated — file changed' : null }));
  return {
    inbox: libraryPaths(w).inbox,
    total: live.length,
    analysed: live.filter((e) => e.status === 'analysed').length,
    needs_frames: live.filter((e) => e.status === 'new').map((e) => e.id),
    needs_analysis: needsAnalysis,
    unsupported: live.filter((e) => e.status === 'unsupported').map((e) => ({ id: e.id, file: e.file, error: e.error })),
    missing: live.filter((e) => e.status === 'missing').map((e) => e.id),
  };
}

export function listLibrary(w, { full = false } = {}) {
  return loadIndex(w).entries.filter((e) => !e.removed && e.analysis).map((e) => {
    const a = e.analysis;
    const base = { id: e.id, file: e.file, kind: e.kind, favourite: Boolean(e.favourite), title: a.title, summary: a.summary, style_keywords: a.style_keywords, mood: a.mood, suits: a.suits, avoid_for: a.avoid_for, template_mapping: a.template_mapping, status: e.status, used_count: e.used_count || 0, detail_frame: e.sheets.length ? path.join(w.root, e.sheets.find((s) => /detail\.jpg$/.test(s)) || e.sheets[0]) : null };
    return full ? { ...base, analysis: a, sheets: e.sheets.map((s) => path.join(w.root, s)) } : base;
  });
}

export function getLibraryEntry(w, id) {
  const e = loadIndex(w).entries.find((x) => x.id === id && !x.removed);
  if (!e) throw new UserError(`No design-library entry "${id}".`, 'Run /prospect:library to see the ids.');
  return { ...e, sheets: e.sheets.map((s) => path.join(w.root, s)) };
}

export function saveAnalysis(w, id, analysis) {
  const idx = loadIndex(w);
  const e = idx.entries.find((x) => x.id === id && !x.removed);
  if (!e) throw new UserError(`No design-library entry "${id}".`);
  if (!['frames_ready', 'analysed'].includes(e.status)) throw new UserError(`"${id}" is not ready for analysis (status ${e.status}).`, 'Run the library scan first.');
  e.analysis = { ...analysis, analysed_at: now() };
  e.status = 'analysed';
  saveIndex(w, idx);
  return { saved: id, title: analysis.title };
}

export function updateEntry(w, id, { favourite, remove, deleteFiles } = {}) {
  const idx = loadIndex(w);
  const e = idx.entries.find((x) => x.id === id && !x.removed);
  if (!e) throw new UserError(`No design-library entry "${id}".`);
  if (favourite !== undefined) e.favourite = Boolean(favourite);
  if (remove) {
    e.removed = true;
    e.removed_at = now();
    removeDir(path.join(libraryPaths(w).frames, e.id));
    if (deleteFiles) fs.rmSync(path.join(libraryPaths(w).inbox, e.file), { force: true });
    // The record stays (with its fingerprint) so the same file is not imported again.
  }
  saveIndex(w, idx);
  return { id, favourite: e.favourite || false, removed: Boolean(e.removed), file_deleted: Boolean(remove && deleteFiles) };
}

export function markUsed(w, ids = []) {
  if (!ids.length) return;
  const idx = loadIndex(w);
  for (const e of idx.entries) if (ids.includes(e.id)) e.used_count = (e.used_count || 0) + 1;
  saveIndex(w, idx);
}

export function libraryExists(w, ids = []) {
  const known = new Set(loadIndex(w).entries.filter((e) => !e.removed).map((e) => e.id));
  return ids.filter((i) => !known.has(i));
}

