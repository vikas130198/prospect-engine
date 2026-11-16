import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown, Quote, X } from 'lucide-react';
import { asset } from '../../lib/content';
import { motionOn, rv } from '../../lib/motion';
import { motion } from '../motion';
import { Btn, Eyebrow, hasText, Heading, Icon, Img, RevealImage, safeHref, Section, T, VisualPanel } from '../ui';

const list = (x: any) => (Array.isArray(x) ? x : []);
const paras = (body: any): string[] => (Array.isArray(body) ? body : hasText(body) ? String(body).split(/\n{2,}/) : []);

export function About({ s }: { s: any }) {
  const img = asset(s.image);
  const highlights = list(s.highlights);
  return (
    <Section id={s.id} tone={s.tone}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className={s.image_side === 'left' ? 'lg:order-2' : ''}>
          <Eyebrow text={s.eyebrow} />
          <Heading text={s.heading} />
          <div className="mt-7 space-y-5 text-lg text-muted">{paras(s.body).map((p, i) => <p key={i} {...rv(i + 1)}><T>{p}</T></p>)}</div>
          {highlights.length > 0 && (
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {highlights.map((h: any, i: number) => (
                <li key={i} {...rv(i)} className="flex gap-4">
                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-brand bg-accent text-primary"><Icon name={h.icon} className="h-5 w-5" /></span>
                  <span><span className="block font-semibold"><T>{h.title}</T></span>{hasText(h.text) && <span className="text-sm text-muted"><T>{h.text}</T></span>}</span>
                </li>
              ))}
            </ul>
          )}
          {s.cta && <div {...rv(2)} className="mt-10"><Btn href={s.cta.href} label={s.cta.label} variant="ghost" icon /></div>}
        </div>
        {img ? (
          <RevealImage src={img} alt={s.image_alt} frameClass="aspect-[4/5] shadow-2xl" parallax={motion.hero_effect === 'parallax'} />
        ) : (
          <div {...rv(1)}><VisualPanel icon={s.icon} label={s.visual_label} className="aspect-[4/5]" /></div>
        )}
      </div>
    </Section>
  );
}

export function Services({ s }: { s: any }) {
  const items = list(s.items);
  const variant = s.variant || 'cards';
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone ?? 'surface'}>
      {variant === 'list' ? (
        <ul className="border-t border-border">
          {items.map((it: any, i: number) => (
            <li key={i} {...rv(i)} className="group border-b border-border">
              <div className="flex flex-col gap-3 py-8 transition-[padding] duration-500 sm:flex-row sm:items-center sm:justify-between md:group-hover:px-4">
                <div className="flex gap-6">
                  <span className="font-heading text-sm text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-2xl font-semibold transition-colors group-hover:text-primary md:text-3xl"><T>{it.title}</T></h3>
                    {hasText(it.text) && <p className="mt-2 max-w-2xl text-muted"><T>{it.text}</T></p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:text-right">
                  {hasText(it.price) && <p className="font-semibold text-primary"><T>{it.price}</T></p>}
                  <Icon name={it.icon} className="hidden h-7 w-7 text-primary transition-transform duration-500 group-hover:rotate-12 sm:block" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it: any, i: number) => {
            const img = asset(it.image);
            return (
              <article key={i} {...rv(i % 3)} className="group">
                <div data-tilt="" className="flex h-full flex-col overflow-hidden rounded-brand border border-border bg-bg">
                  {img && <div className="card-media"><img src={img} alt={it.image_alt || it.title || ''} loading="lazy" className="aspect-[16/10] w-full object-cover" /></div>}
                  <div className="flex flex-1 flex-col p-8">
                    {!img && <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-brand bg-accent text-primary transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"><Icon name={it.icon} /></span>}
                    <h3 className="text-xl font-semibold"><T>{it.title}</T></h3>
                    {hasText(it.text) && <p className="mt-3 flex-1 text-muted"><T>{it.text}</T></p>}
                    {hasText(it.price) && <p className="mt-6 font-semibold text-primary"><T>{it.price}</T></p>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {s.cta && <div {...rv(0)} className="mt-12 text-center"><Btn href={s.cta.href} label={s.cta.label} icon /></div>}
    </Section>
  );
}

export function Menu({ s }: { s: any }) {
  const cats = list(s.categories);
  const [active, setActive] = useState(0);
  const cat = cats[active] || cats[0];
  const choose = (i: number) => {
    const d: any = document;
    if (d.startViewTransition && document.documentElement.classList.contains('motion')) d.startViewTransition(() => flushSync(() => setActive(i)));
    else setActive(i);
  };
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone} center>
      {cats.length > 1 && (
        <div {...rv(0)} className="mb-12 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Menu categories">
          {cats.map((c: any, i: number) => (
            <button key={i} type="button" role="tab" aria-selected={i === active} onClick={() => choose(i)}
              className={`min-h-11 rounded-full border px-5 py-2 text-sm font-semibold transition-all duration-300 ${i === active ? 'border-primary bg-primary text-primary-contrast shadow-md' : 'border-border hover:-translate-y-0.5 hover:border-primary'}`}>
              <T>{c.name}</T>
            </button>
          ))}
        </div>
      )}
      {cat && (
        <div className="mx-auto grid max-w-4xl gap-x-14 gap-y-8 md:grid-cols-2" role="tabpanel" style={{ viewTransitionName: 'menu-panel' } as any}>
          {list(cat.items).map((it: any, i: number) => (
            <div key={`${active}-${i}`} {...rv(i % 2)} className="group border-b border-dashed border-border pb-6 text-left">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold transition-colors group-hover:text-primary"><T>{it.name}</T></h3>
                {hasText(it.price) && <span className="shrink-0 font-semibold text-primary"><T>{it.price}</T></span>}
              </div>
              {hasText(it.description) && <p className="mt-1 text-[15px] text-muted"><T>{it.description}</T></p>}
            </div>
          ))}
        </div>
      )}
      {hasText(s.note) && <p className="mt-12 text-center text-sm text-muted"><T>{s.note}</T></p>}
    </Section>
  );
}

function Lightbox({ img, onClose }: { img: any; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (img && d && !d.open) d.showModal();
  }, [img]);
  if (!img) return null;
  return (
    <dialog ref={ref} className="lightbox" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-label={img.alt || 'Image'}>
      <img src={img.url} alt={img.alt || ''} className="max-h-[86vh] w-auto rounded-brand object-contain" />
      <button type="button" onClick={() => ref.current?.close()} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Close image">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </dialog>
  );
}

/** Gallery: "grid" (bento) or "scroll" (vertical scrolling drives a horizontal strip on desktop; swipe on mobile). */
export function Gallery({ s }: { s: any }) {
  const imgs = list(s.images).map((i: any) => ({ ...i, url: asset(i.src) })).filter((i: any) => i.url);
  const [open, setOpen] = useState<any>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const scroll = s.variant === 'scroll' && imgs.length >= 3;
  useEffect(() => {
    if (!scroll || !wrap.current || !track.current) return;
    const fit = () => {
      if (!wrap.current || !track.current) return;
      const on = window.innerWidth >= 768 && document.documentElement.classList.contains('motion');
      wrap.current.style.height = on ? `${track.current.scrollWidth - wrap.current.clientWidth + window.innerHeight}px` : '';
      if (!on) track.current.style.transform = '';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(track.current);
    window.addEventListener('resize', fit);
    return () => (ro.disconnect(), window.removeEventListener('resize', fit));
  }, [scroll]);
  if (!imgs.length) return null;
  const tile = (im: any, i: number, cls: string) => (
    <figure key={i} {...rv(i % 3)} className={`zoom-hover relative overflow-hidden rounded-brand ${cls}`}>
      <button type="button" onClick={() => setOpen(im)} data-cursor-view="" className="block h-full w-full" aria-label={`Enlarge image${im.alt ? `: ${im.alt}` : ''}`}>
        <img src={im.url} alt={im.alt || ''} loading="lazy" className="h-full w-full object-cover transition-transform duration-1000" />
      </button>
    </figure>
  );
  return (
    <>
      {scroll ? (
        <section id={s.id} className={`relative ${s.tone === 'surface' ? 'bg-surface' : s.tone === 'accent' ? 'bg-accent' : ''}`}>
          <div ref={wrap} data-hscroll="" className="relative">
            <div className="flex flex-col justify-center overflow-hidden py-20 md:sticky md:top-0 md:h-screen md:py-0">
              <div className="container-x mb-10 max-w-2xl md:mb-12">
                <Eyebrow text={s.eyebrow} />
                <Heading text={s.heading} />
                {hasText(s.intro) && <p {...rv(2)} className="mt-5 text-lg text-muted"><T>{s.intro}</T></p>}
              </div>
              <div className={motionOn() ? 'overflow-x-auto md:overflow-visible' : 'overflow-x-auto'} style={{ scrollSnapType: 'x mandatory' }}>
                <div ref={track} data-hscroll-track="" className="flex w-max gap-4 px-5 will-change-transform md:gap-6 md:px-[max(2rem,calc((100vw-72rem)/2+2rem))]">
                  {imgs.map((im: any, i: number) => tile(im, i, `snap-start h-[55vh] w-[78vw] shrink-0 sm:w-[46vw] md:h-[56vh] md:w-[34vw] ${i % 2 ? 'md:mt-16' : ''}`))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone}>
          <div className="grid auto-rows-[11rem] grid-cols-2 gap-3 md:auto-rows-[15rem] md:grid-cols-4 md:gap-4">
            {imgs.map((im: any, i: number) => tile(im, i, i === 0 ? 'col-span-2 row-span-2' : i % 5 === 3 ? 'md:col-span-2' : ''))}
          </div>
        </Section>
      )}
      <Lightbox img={open} onClose={() => setOpen(null)} />
    </>
  );
}

export function Features({ s }: { s: any }) {
  const items = list(s.items);
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone} center>
      <div className={`grid gap-6 sm:grid-cols-2 ${items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {items.map((it: any, i: number) => (
          <div key={i} {...rv(i)} className="group">
            <div data-tilt="" className="h-full rounded-brand border border-transparent p-6 text-center transition-colors hover:border-border hover:bg-bg">
              <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary transition-transform duration-700 group-hover:rotate-[360deg]"><Icon name={it.icon} className="h-7 w-7" /></span>
              <h3 className="text-lg font-semibold"><T>{it.title}</T></h3>
              {hasText(it.text) && <p className="mt-2 text-muted"><T>{it.text}</T></p>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Process: "cards" (row of numbered cards) or "stack" (cards stack on top of each other while scrolling). */
export function Process({ s }: { s: any }) {
  const steps = list(s.steps);
  if (s.variant === 'stack') {
    return (
      <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone ?? 'surface'}>
        <ol className="mx-auto max-w-4xl space-y-6">
          {steps.map((st: any, i: number) => (
            <li key={i} className="stack-card" style={{ '--i': i } as any}>
              <div className="grid gap-6 rounded-brand border border-border bg-bg p-8 shadow-xl md:grid-cols-[8rem_1fr] md:p-12">
                <span className="font-heading text-6xl font-semibold text-primary md:text-7xl">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-2xl font-semibold md:text-3xl"><T>{st.title}</T></h3>
                  {hasText(st.text) && <p className="mt-3 text-lg text-muted"><T>{st.text}</T></p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    );
  }
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone ?? 'surface'}>
      <ol className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((st: any, i: number) => (
          <li key={i} {...rv(i)} className="group">
            <div data-tilt="" className="h-full rounded-brand border border-border bg-bg p-8">
              <span className="font-heading text-5xl font-semibold text-primary/90 transition-transform duration-500 group-hover:-translate-y-1 inline-block">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-5 text-lg font-semibold"><T>{st.title}</T></h3>
              {hasText(st.text) && <p className="mt-2 text-muted"><T>{st.text}</T></p>}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Only real, sourced reviews (validated by the engine before build). */
export function Testimonials({ s }: { s: any }) {
  const items = list(s.items).filter((t: any) => hasText(t.quote));
  if (!items.length) return null;
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone ?? 'accent'} center>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t: any, i: number) => (
          <figure key={i} {...rv(i % 3)}>
            <div data-tilt="" className="flex h-full flex-col rounded-brand border border-border bg-bg p-8 text-left">
              <Quote className="h-8 w-8 text-primary" aria-hidden="true" />
              <blockquote className="mt-5 flex-1 font-heading text-xl leading-relaxed"><T>{t.quote}</T></blockquote>
              <figcaption className="mt-7 text-sm"><span className="font-semibold"><T>{t.author}</T></span>{hasText(t.platform) && <span className="text-muted"> · <T>{t.platform}</T></span>}</figcaption>
            </div>
          </figure>
        ))}
      </div>
    </Section>
  );
}

export function Stats({ s }: { s: any }) {
  const items = list(s.items).filter((x: any) => hasText(x.value));
  if (!items.length) return null;
  return (
    <section id={s.id} className="border-y border-border bg-surface py-16 md:py-20">
      <div className="container-x grid grid-cols-2 gap-10 text-center md:grid-cols-4">
        {items.map((x: any, i: number) => (
          <div key={i} {...rv(i)}>
            <p className="font-heading text-5xl font-semibold text-primary md:text-6xl" {...(motion.counters && !/\[\[/.test(x.value) ? { 'data-count': x.value } : {})}><T>{x.value}</T></p>
            <p className="mt-2 text-sm uppercase tracking-wider text-muted"><T>{x.label}</T></p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Pricing({ s }: { s: any }) {
  const plans = list(s.plans);
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone} center>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p: any, i: number) => (
          <div key={i} {...rv(i)}>
            <div data-tilt="" className={`flex h-full flex-col rounded-brand border p-8 text-left ${p.featured ? 'border-primary bg-bg shadow-2xl' : 'border-border'}`}>
              <h3 className="text-xl font-semibold"><T>{p.name}</T></h3>
              <p className="mt-4"><span className="font-heading text-5xl font-semibold"><T>{p.price}</T></span>{hasText(p.period) && <span className="text-muted"> / <T>{p.period}</T></span>}</p>
              <ul className="mt-7 flex-1 space-y-3">
                {list(p.features).map((f: string, j: number) => <li key={j} className="flex gap-2"><Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-primary" /><T>{f}</T></li>)}
              </ul>
              {p.cta && <div className="mt-8"><Btn href={p.cta.href} label={p.cta.label} variant={p.featured ? 'primary' : 'outline'} className="w-full" /></div>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Team({ s }: { s: any }) {
  const members = list(s.members);
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone} center>
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {members.map((m: any, i: number) => {
          const img = asset(m.image);
          return (
            <div key={i} {...rv(i)} className="group text-center">
              {img ? (
                <div className="zoom-hover mx-auto aspect-square w-44 overflow-hidden rounded-full"><Img src={img} alt={m.name} className="h-full w-full object-cover transition-transform duration-1000" /></div>
              ) : (
                <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-accent text-primary transition-transform duration-500 group-hover:scale-110"><Icon name="users" className="h-9 w-9" /></span>
              )}
              <h3 className="mt-5 text-lg font-semibold"><T>{m.name}</T></h3>
              {hasText(m.role) && <p className="text-muted"><T>{m.role}</T></p>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function Faq({ s }: { s: any }) {
  const items = list(s.items);
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone} center>
      <div className="mx-auto max-w-3xl divide-y divide-border border-y border-border">
        {items.map((f: any, i: number) => (
          <div key={i} {...rv(Math.min(i, 4))}>
            <h3>
              <button type="button" className="group flex w-full items-center justify-between gap-4 py-6 text-left text-lg font-semibold" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
                <span className="transition-colors group-hover:text-primary"><T>{f.q}</T></span>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border transition-all duration-500 ${open === i ? 'rotate-180 border-primary bg-primary text-primary-contrast' : ''}`}>
                  <ChevronDown className="h-5 w-5" aria-hidden="true" />
                </span>
              </button>
            </h3>
            <div id={`faq-${i}`} className="acc-panel" data-open={open === i} role="region" aria-hidden={open !== i} {...(open !== i ? { inert: true as any } : {})}>
              <div><p className="pb-6 pr-14 text-muted"><T>{f.a}</T></p></div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Cta({ s }: { s: any }) {
  return (
    <section id={s.id} className="py-16 md:py-24">
      <div className="container-x">
        <div {...rv(0)} className="cta-band relative overflow-hidden rounded-brand px-6 py-16 text-center text-primary-contrast md:px-16 md:py-24">
          <div className="absolute inset-0 pattern-dots opacity-20" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl">
            <Heading text={s.heading} className="text-4xl font-semibold md:text-6xl" />
            {hasText(s.text) && <p {...rv(2)} className="mt-6 text-lg opacity-90"><T>{s.text}</T></p>}
            {s.cta && hasText(s.cta.label) && (
              <a {...rv(3)} href={safeHref(s.cta.href)} data-magnetic="" className="mt-10 inline-flex min-h-12 items-center justify-center rounded-brand bg-primary-contrast px-8 py-3 font-semibold text-primary shadow-lg hover:shadow-2xl">
                <T>{s.cta.label}</T>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Endless band of short words (verified offerings, places, values). Static and wrapped with reduced motion. */
export function Marquee({ s }: { s: any }) {
  const items: string[] = list(s.items).filter(hasText);
  if (!items.length) return null;
  const outline = s.style === 'outline';
  const dur = s.speed === 'slow' ? 60 : s.speed === 'fast' ? 24 : 38;
  const row = (hidden: boolean) => (
    <div className="marquee-track" style={{ '--marquee-dur': `${dur}s` } as any} {...(hidden ? { 'aria-hidden': true } : {})}>
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-12">
          <span className={`whitespace-nowrap font-heading text-4xl font-semibold md:text-6xl ${outline && i % 2 ? 'text-outline' : ''}`}><T>{t}</T></span>
          <Icon name={s.icon || 'sparkles'} className="h-6 w-6 shrink-0 text-primary md:h-8 md:w-8" />
        </span>
      ))}
    </div>
  );
  return (
    <section id={s.id} className={`overflow-hidden border-y border-border py-10 md:py-14 ${s.tone === 'surface' ? 'bg-surface' : s.tone === 'accent' ? 'bg-accent' : ''}`} aria-label={s.label || items.join(', ')}>
      <div className="marquee">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
