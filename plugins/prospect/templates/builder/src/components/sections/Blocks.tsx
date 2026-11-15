import { useState } from 'react';
import { ChevronDown, Quote } from 'lucide-react';
import { asset } from '../../lib/content';
import { Btn, hasText, Icon, Img, safeHref, Section, T, VisualPanel } from '../ui';

const list = (x: any) => (Array.isArray(x) ? x : []);
const paras = (body: any): string[] => (Array.isArray(body) ? body : hasText(body) ? String(body).split(/\n{2,}/) : []);

export function About({ s }: { s: any }) {
  const img = asset(s.image);
  const highlights = list(s.highlights);
  return (
    <Section id={s.id} tone={s.tone}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className={s.image_side === 'left' ? 'lg:order-2' : ''}>
          {hasText(s.eyebrow) && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary"><T>{s.eyebrow}</T></p>}
          <h2 className="text-3xl font-semibold md:text-4xl"><T>{s.heading}</T></h2>
          <div className="mt-6 space-y-4 text-lg text-muted">{paras(s.body).map((p, i) => <p key={i}><T>{p}</T></p>)}</div>
          {highlights.length > 0 && (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {highlights.map((h: any, i: number) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-brand bg-accent text-primary"><Icon name={h.icon} className="h-5 w-5" /></span>
                  <span><span className="block font-semibold"><T>{h.title}</T></span>{hasText(h.text) && <span className="text-sm text-muted"><T>{h.text}</T></span>}</span>
                </li>
              ))}
            </ul>
          )}
          {s.cta && <div className="mt-8"><Btn href={s.cta.href} label={s.cta.label} variant="ghost" icon /></div>}
        </div>
        {img ? <img src={img} alt={s.image_alt || ''} loading="lazy" className="aspect-[4/3] w-full rounded-brand object-cover shadow-lg" /> : <VisualPanel icon={s.icon} label={s.visual_label} className="aspect-[4/3]" />}
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
        <ul className="divide-y divide-border rounded-brand border border-border bg-bg">
          {items.map((it: any, i: number) => (
            <li key={i} className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <Icon name={it.icon} className="mt-1 h-6 w-6 shrink-0 text-primary" />
                <div><h3 className="text-xl font-semibold"><T>{it.title}</T></h3>{hasText(it.text) && <p className="mt-1 text-muted"><T>{it.text}</T></p>}</div>
              </div>
              {hasText(it.price) && <p className="font-semibold text-primary sm:text-right"><T>{it.price}</T></p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it: any, i: number) => {
            const img = asset(it.image);
            return (
              <article key={i} className="group flex flex-col overflow-hidden rounded-brand border border-border bg-bg transition hover:-translate-y-1 hover:shadow-lg">
                {img && <img src={img} alt={it.image_alt || it.title || ''} loading="lazy" className="aspect-[16/10] w-full object-cover" />}
                <div className="flex flex-1 flex-col p-7">
                  {!img && <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-brand bg-accent text-primary"><Icon name={it.icon} /></span>}
                  <h3 className="text-xl font-semibold"><T>{it.title}</T></h3>
                  {hasText(it.text) && <p className="mt-3 flex-1 text-muted"><T>{it.text}</T></p>}
                  {hasText(it.price) && <p className="mt-5 font-semibold text-primary"><T>{it.price}</T></p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {s.cta && <div className="mt-10 text-center"><Btn href={s.cta.href} label={s.cta.label} icon /></div>}
    </Section>
  );
}

export function Menu({ s }: { s: any }) {
  const cats = list(s.categories);
  const [active, setActive] = useState(0);
  const cat = cats[active] || cats[0];
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone} center>
      {cats.length > 1 && (
        <div className="mb-10 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Menu categories">
          {cats.map((c: any, i: number) => (
            <button key={i} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}
              className={`min-h-11 rounded-full border px-5 py-2 text-sm font-semibold transition ${i === active ? 'border-primary bg-primary text-primary-contrast' : 'border-border hover:border-primary'}`}>
              <T>{c.name}</T>
            </button>
          ))}
        </div>
      )}
      {cat && (
        <div className="mx-auto grid max-w-4xl gap-x-12 gap-y-7 md:grid-cols-2" role="tabpanel">
          {list(cat.items).map((it: any, i: number) => (
            <div key={i} className="border-b border-dashed border-border pb-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold"><T>{it.name}</T></h3>
                {hasText(it.price) && <span className="shrink-0 font-semibold text-primary"><T>{it.price}</T></span>}
              </div>
              {hasText(it.description) && <p className="mt-1 text-[15px] text-muted"><T>{it.description}</T></p>}
            </div>
          ))}
        </div>
      )}
      {hasText(s.note) && <p className="mt-10 text-center text-sm text-muted"><T>{s.note}</T></p>}
    </Section>
  );
}

export function Gallery({ s }: { s: any }) {
  const imgs = list(s.images).map((i: any) => ({ ...i, url: asset(i.src) })).filter((i: any) => i.url);
  if (!imgs.length) return null;
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {imgs.map((im: any, i: number) => (
          <figure key={i} className={`overflow-hidden rounded-brand ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
            <img src={im.url} alt={im.alt || ''} loading="lazy" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
          </figure>
        ))}
      </div>
    </Section>
  );
}

export function Features({ s }: { s: any }) {
  const items = list(s.items);
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone} center>
      <div className={`grid gap-8 sm:grid-cols-2 ${items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {items.map((it: any, i: number) => (
          <div key={i} className="text-center">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary"><Icon name={it.icon} /></span>
            <h3 className="text-lg font-semibold"><T>{it.title}</T></h3>
            {hasText(it.text) && <p className="mt-2 text-muted"><T>{it.text}</T></p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Process({ s }: { s: any }) {
  const steps = list(s.steps);
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone ?? 'surface'}>
      <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((st: any, i: number) => (
          <li key={i} className="rounded-brand border border-border bg-bg p-7">
            <span className="font-heading text-4xl font-semibold text-primary">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="mt-4 text-lg font-semibold"><T>{st.title}</T></h3>
            {hasText(st.text) && <p className="mt-2 text-muted"><T>{st.text}</T></p>}
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
          <figure key={i} className="flex flex-col rounded-brand border border-border bg-bg p-7 text-left">
            <Quote className="h-7 w-7 text-primary" aria-hidden="true" />
            <blockquote className="mt-4 flex-1 text-[17px]"><T>{t.quote}</T></blockquote>
            <figcaption className="mt-6 text-sm"><span className="font-semibold"><T>{t.author}</T></span>{hasText(t.platform) && <span className="text-muted"> · <T>{t.platform}</T></span>}</figcaption>
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
    <section id={s.id} className="border-y border-border bg-surface py-12">
      <div className="container-x grid grid-cols-2 gap-8 text-center md:grid-cols-4">
        {items.map((x: any, i: number) => (
          <div key={i}><p className="font-heading text-4xl font-semibold text-primary"><T>{x.value}</T></p><p className="mt-1 text-sm text-muted"><T>{x.label}</T></p></div>
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
          <div key={i} className={`flex flex-col rounded-brand border p-8 text-left ${p.featured ? 'border-primary shadow-xl' : 'border-border'}`}>
            <h3 className="text-xl font-semibold"><T>{p.name}</T></h3>
            <p className="mt-4"><span className="font-heading text-4xl font-semibold"><T>{p.price}</T></span>{hasText(p.period) && <span className="text-muted"> / <T>{p.period}</T></span>}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {list(p.features).map((f: string, j: number) => <li key={j} className="flex gap-2"><Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-primary" /><T>{f}</T></li>)}
            </ul>
            {p.cta && <div className="mt-8"><Btn href={p.cta.href} label={p.cta.label} variant={p.featured ? 'primary' : 'outline'} className="w-full" /></div>}
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
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {members.map((m: any, i: number) => {
          const img = asset(m.image);
          return (
            <div key={i} className="text-center">
              {img ? <Img src={img} alt={m.name} className="mx-auto aspect-square w-40 rounded-full object-cover" /> : <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-accent text-primary"><Icon name="users" className="h-9 w-9" /></span>}
              <h3 className="mt-4 text-lg font-semibold"><T>{m.name}</T></h3>
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
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-brand border border-border">
        {items.map((f: any, i: number) => (
          <div key={i}>
            <h3>
              <button type="button" className="flex w-full items-center justify-between gap-4 p-6 text-left text-lg font-semibold" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
                <T>{f.q}</T>
                <ChevronDown className={`h-5 w-5 shrink-0 transition ${open === i ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </h3>
            <div id={`faq-${i}`} hidden={open !== i} className="px-6 pb-6 text-muted"><T>{f.a}</T></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Cta({ s }: { s: any }) {
  return (
    <section id={s.id} className="py-16 md:py-20">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-brand bg-primary px-6 py-14 text-center text-primary-contrast md:px-16">
          <div className="absolute inset-0 pattern-dots opacity-20" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold md:text-4xl"><T>{s.heading}</T></h2>
            {hasText(s.text) && <p className="mt-4 text-lg opacity-90"><T>{s.text}</T></p>}
            {s.cta && hasText(s.cta.label) && (
              <a href={safeHref(s.cta.href)} className="mt-8 inline-flex min-h-11 items-center justify-center rounded-brand bg-primary-contrast px-7 py-3 font-semibold text-primary transition hover:opacity-90">
                <T>{s.cta.label}</T>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
