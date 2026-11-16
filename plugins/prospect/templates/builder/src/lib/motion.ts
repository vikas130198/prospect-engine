// Motion system: resolves content.motion against presets and runs all interactive effects with a few shared
// observers/listeners. Everything is progressive enhancement: with prefers-reduced-motion (and in automated QA)
// the html element never gets the `motion` class, so all content is simply visible and static.
import Lenis from 'lenis';
import catalog from './motion.json';

export type MotionConfig = {
  preset: string;
  intro: 'curtain' | 'fade' | 'none';
  reveal: string;
  hero_text: 'words' | 'chars' | 'fade';
  hero_effect: 'parallax' | 'ken-burns' | 'aurora' | 'spotlight' | 'none';
  nav: 'hide-on-scroll' | 'sticky';
  smooth_scroll: boolean;
  cursor: boolean;
  magnetic: boolean;
  tilt: boolean;
  scroll_progress: boolean;
  image_reveal: boolean;
  heading_reveal: boolean;
  counters: boolean;
  grain: boolean;
  speed: 'slow' | 'normal' | 'fast';
};

const presets = catalog.presets as Record<string, any>;
const options = catalog.options as Record<string, any>;

export function resolveMotion(m: any = {}): MotionConfig {
  const preset = presets[m?.preset] ? m.preset : 'elegant';
  const out: any = { ...presets[preset], preset };
  delete out.label;
  for (const [k, allowed] of Object.entries(options)) {
    const v = m?.[k];
    if (v === undefined) continue;
    if (allowed === 'boolean' ? typeof v === 'boolean' : (allowed as string[]).includes(v)) out[k] = v;
  }
  return out as MotionConfig;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/** Called once before React renders, so the first paint already has the right initial states. */
export function applyMotionRoot(cfg: MotionConfig) {
  const root = document.documentElement;
  root.dataset.revealStyle = cfg.reveal;
  root.dataset.speed = cfg.speed;
  root.dataset.heroEffect = cfg.hero_effect;
  root.dataset.intro = cfg.intro;
  if (!prefersReducedMotion()) root.classList.add('motion');
  if (cfg.grain) root.classList.add('grain');
  // Printing or saving as PDF must show everything.
  window.addEventListener('beforeprint', () => document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')));
}

export const motionOn = () => document.documentElement.classList.contains('motion');

/** Start all runtime effects. Returns a cleanup function. */
export function startMotion(cfg: MotionConfig): () => void {
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(t: K, fn: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
    window.addEventListener(t, fn as any, o);
    cleanups.push(() => window.removeEventListener(t, fn as any, o));
  };

  // ---- reveal on scroll (also used by split headings, images and counters) ----
  if (!motionOn()) {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => (el.textContent = el.dataset.count || el.textContent));
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add('is-in');
        io.unobserve(el);
        setTimeout(() => el.classList.add('rv-done'), 2200);
        el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
        if (el.hasAttribute('data-count')) countUp(el);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  const observe = (root: ParentNode) => root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
  observe(document);
  const mo = new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => n instanceof HTMLElement && (n.matches('[data-reveal]') ? io.observe(n) : observe(n)));
  });
  mo.observe(document.body, { childList: true, subtree: true });
  cleanups.push(() => (io.disconnect(), mo.disconnect()));

  // ---- smooth scrolling (desktop wheel/trackpad; touch keeps native scrolling) ----
  let lenis: Lenis | null = null;
  if (cfg.smooth_scroll) {
    lenis = new Lenis({ lerp: cfg.speed === 'slow' ? 0.08 : 0.11, anchors: { offset: -84 }, autoRaf: true });
    cleanups.push(() => lenis?.destroy());
  }

  // ---- scroll-linked effects in one rAF loop: progress bar, parallax, nav hide ----
  const progress = document.querySelector<HTMLElement>('[data-scroll-progress]');
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  let lastY = window.scrollY;
  let ticking = false;
  const frame = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    const vh = window.innerHeight;
    document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
      const r = el.parentElement!.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const speed = Number(el.dataset.parallax) || 0.15;
      const mid = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(-mid * speed).toFixed(1)}px, 0) scale(1.12)`;
    });
    document.querySelectorAll<HTMLElement>('[data-hscroll]').forEach((wrap) => {
      const track = wrap.querySelector<HTMLElement>('[data-hscroll-track]');
      if (!track || window.innerWidth < 768) return;
      const r = wrap.getBoundingClientRect();
      const dist = track.scrollWidth - wrap.clientWidth;
      const total = r.height - vh;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      track.style.transform = `translate3d(${(-dist * p).toFixed(1)}px, 0, 0)`;
    });
    if (nav && cfg.nav === 'hide-on-scroll') {
      const down = y > lastY && y > 420;
      nav.classList.toggle('nav-hidden', down && !nav.contains(document.activeElement) && !nav.querySelector('[aria-expanded="true"]'));
    }
    lastY = y;
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };
  on('scroll', onScroll, { passive: true });
  on('resize', onScroll, { passive: true });
  frame();

  // ---- pointer effects (mouse/trackpad only) ----
  if (finePointer()) {
    const cursor = document.querySelector<HTMLElement>('[data-cursor]');
    let cx = 0, cy = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      if (cursor) cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    on('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target as Element;
      if (cursor && cfg.cursor) {
        tx = e.clientX;
        ty = e.clientY;
        cursor.classList.add('on');
        cursor.classList.toggle('grow', Boolean(t.closest?.('a, button, [data-tilt], label, input, textarea, select')));
        cursor.classList.toggle('view', Boolean(t.closest?.('[data-cursor-view]')));
        if (!raf) raf = requestAnimationFrame(loop);
      }
      const mag = cfg.magnetic ? (t.closest?.('[data-magnetic]') as HTMLElement | null) : null;
      document.querySelectorAll<HTMLElement>('[data-magnetic].mag-on').forEach((m) => {
        if (m !== mag) (m.classList.remove('mag-on'), (m.style.transform = ''));
      });
      if (mag) {
        const r = mag.getBoundingClientRect();
        mag.classList.add('mag-on');
        mag.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px)`;
      }
      const card = t.closest?.('[data-tilt]') as HTMLElement | null;
      if (card) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        if (cfg.tilt) card.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 7).toFixed(2)}deg) rotateY(${((px - 0.5) * 9).toFixed(2)}deg) translateY(-4px)`;
      }
      const spot = t.closest?.('[data-spotlight]') as HTMLElement | null;
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--sx', `${e.clientX - r.left}px`);
        spot.style.setProperty('--sy', `${e.clientY - r.top}px`);
      }
    }, { passive: true });
    document.addEventListener('pointerout', resetTilt, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => document.querySelector('[data-cursor]')?.classList.remove('on'));
    cleanups.push(() => document.removeEventListener('pointerout', resetTilt));
  }

  return () => cleanups.forEach((c) => c());
}

function resetTilt(e: PointerEvent) {
  const card = (e.target as Element).closest?.('[data-tilt]') as HTMLElement | null;
  if (card && !card.contains(e.relatedTarget as Node)) card.style.transform = '';
}

/** Count the numeric part of a value up from zero ("1,200+" → 0…1,200+). */
function countUp(el: HTMLElement) {
  const final = el.dataset.count || '';
  const m = final.match(/^(\D*)([\d,.]+)(.*)$/);
  if (!m || el.dataset.counted) return;
  el.dataset.counted = '1';
  const [, pre, num, post] = m;
  const target = parseFloat(num.replace(/,/g, ''));
  const decimals = (num.split('.')[1] || '').length;
  const comma = num.includes(',');
  const start = performance.now();
  const dur = 1600;
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / dur);
    const v = target * (1 - Math.pow(1 - p, 4));
    const s = decimals ? v.toFixed(decimals) : Math.round(v).toString();
    el.textContent = pre + (comma ? Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals }) : s) + post;
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = final;
  };
  requestAnimationFrame(step);
}

/** Spread onto an element to reveal it on scroll. `i` staggers siblings. */
export function rv(i = 0, style?: string): Record<string, any> {
  return { 'data-reveal': style || '', style: { '--i': i } };
}
