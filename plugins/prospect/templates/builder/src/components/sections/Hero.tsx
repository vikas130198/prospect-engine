import { asset } from '../../lib/content';
import { Btn, hasText, Icon, T, VisualPanel } from '../ui';

/** Hero variants: split (text + visual), centered, fullbleed (image/gradient background). */
export function Hero({ s }: { s: any }) {
  const img = asset(s.image);
  const variant = s.variant || 'split';
  const badges: string[] = (s.badges || []).filter(hasText);
  const text = (
    <>
      {hasText(s.eyebrow) && <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary"><T>{s.eyebrow}</T></p>}
      <h1 className="text-4xl font-semibold sm:text-5xl lg:text-6xl"><T>{s.heading}</T></h1>
      {hasText(s.subheading) && <p className="mt-6 max-w-xl text-lg text-muted md:text-xl"><T>{s.subheading}</T></p>}
      <div className={`mt-9 flex flex-wrap gap-3 ${variant === 'centered' ? 'justify-center' : ''}`}>
        <Btn href={s.primary_cta?.href} label={s.primary_cta?.label} icon />
        <Btn href={s.secondary_cta?.href} label={s.secondary_cta?.label} variant="outline" />
      </div>
      {badges.length > 0 && (
        <ul className={`mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted ${variant === 'centered' ? 'justify-center' : ''}`}>
          {badges.map((b, i) => (
            <li key={i} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-primary" /><T>{b}</T></li>
          ))}
        </ul>
      )}
    </>
  );

  if (variant === 'fullbleed') {
    return (
      <section id={s.id || 'home'} className="relative isolate overflow-hidden">
        {img ? (
          <>
            <img src={img} alt={s.image_alt || ''} className="absolute inset-0 -z-10 h-full w-full object-cover" fetchPriority="high" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/55 to-black/25" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-surface hero-glow" />
        )}
        <div className={`container-x fade-up flex min-h-[78vh] flex-col justify-center py-24 md:py-32 ${img ? 'text-white [&_.text-muted]:text-white/85 [&_.text-primary]:text-white' : ''}`}>
          <div className="max-w-3xl">{text}</div>
        </div>
      </section>
    );
  }

  if (variant === 'centered') {
    return (
      <section id={s.id || 'home'} className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 hero-glow" />
        <div className="container-x fade-up mx-auto flex max-w-4xl flex-col items-center py-24 text-center md:py-32 [&_p]:mx-auto">
          {text}
          {img && <img src={img} alt={s.image_alt || ''} className="mt-14 w-full rounded-brand border border-border object-cover shadow-xl" fetchPriority="high" />}
        </div>
      </section>
    );
  }

  return (
    <section id={s.id || 'home'} className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 hero-glow" />
      <div className="container-x grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
        <div className="fade-up">{text}</div>
        {img ? (
          <img src={img} alt={s.image_alt || ''} className="aspect-[4/3] w-full rounded-brand object-cover shadow-xl lg:aspect-[5/6]" fetchPriority="high" />
        ) : (
          <VisualPanel icon={s.icon} label={s.visual_label} className="aspect-[4/3] lg:aspect-[5/6]" />
        )}
      </div>
    </section>
  );
}
