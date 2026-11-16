import { asset } from '../../lib/content';
import { rv } from '../../lib/motion';
import { INTRO_ACTIVE, motion, SplitText } from '../motion';
import { Btn, Eyebrow, hasText, Icon, T, VisualPanel } from '../ui';

/** Background layer chosen by the motion preset's hero_effect. */
function HeroBackdrop({ dark = false }: { dark?: boolean }) {
  const fx = motion.hero_effect;
  return (
    <>
      {fx === 'aurora' && (
        <div className="aurora" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {fx === 'spotlight' && !dark && <div className="grid-lines absolute inset-0 -z-10" aria-hidden="true" />}
      {fx !== 'aurora' && !dark && <div className="absolute inset-0 -z-10 hero-glow" aria-hidden="true" />}
    </>
  );
}

/**
 * Hero variants: split (text + visual), centered, fullbleed (photo background), editorial (oversized type,
 * wide image underneath). Effects come from content.motion (word/letter reveals, parallax, Ken Burns, aurora, spotlight).
 */
export function Hero({ s }: { s: any }) {
  const img = asset(s.image);
  const variant = s.variant || 'split';
  const badges: string[] = (s.badges || []).filter(hasText);
  const base = INTRO_ACTIVE ? 1050 : 120; // wait for the opening curtain to lift
  const center = variant === 'centered';
  const parallax = motion.hero_effect === 'parallax';
  const spotlight = motion.hero_effect === 'spotlight' ? { 'data-spotlight': '' } : {};
  const at = (i: number) => ({ 'data-reveal': 'fade-up', style: { '--d': `${base + 380}ms`, '--i': i } as any });
  const size = variant === 'editorial' ? 'text-5xl sm:text-6xl lg:text-8xl' : variant === 'split' || !['centered', 'fullbleed'].includes(variant) ? 'text-4xl sm:text-5xl xl:text-6xl' : 'text-4xl sm:text-6xl lg:text-7xl';

  const text = (
    <>
      {hasText(s.eyebrow) && <div style={{ '--d': `${base}ms` } as any}><Eyebrow text={s.eyebrow} center={center} /></div>}
      <SplitText as="h1" text={s.heading} mode={motion.hero_text} delay={base} className={`${size} font-semibold leading-[1.02] tracking-tight`} />
      {hasText(s.subheading) && <p {...at(0)} className={`mt-7 max-w-xl text-lg text-muted md:text-xl ${center ? 'mx-auto' : ''}`}><T>{s.subheading}</T></p>}
      <div {...at(1)} className={`mt-10 flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>
        <Btn href={s.primary_cta?.href} label={s.primary_cta?.label} icon />
        <Btn href={s.secondary_cta?.href} label={s.secondary_cta?.label} variant="outline" />
      </div>
      {badges.length > 0 && (
        <ul {...at(2)} className={`mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted ${center ? 'justify-center' : ''}`}>
          {badges.map((b, i) => (
            <li key={i} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-primary" /><T>{b}</T></li>
          ))}
        </ul>
      )}
    </>
  );

  if (variant === 'fullbleed') {
    return (
      <section id={s.id || 'home'} className="relative isolate overflow-hidden" {...spotlight}>
        {img ? (
          <div className="hero-media absolute inset-0 -z-10">
            <img src={img} alt={s.image_alt || ''} className="h-full w-full object-cover" fetchPriority="high" {...(parallax ? { 'data-parallax': '0.18' } : {})} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-10 bg-surface"><HeroBackdrop /></div>
        )}
        <div className={`container-x flex min-h-[88vh] flex-col justify-center py-24 md:py-32 ${img ? 'text-white [&_.text-muted]:text-white/85 [&_.text-primary]:text-white [&_.text-text]:text-white' : ''}`}>
          <div className="max-w-3xl">{text}</div>
          <div {...at(3)} className="mt-16 hidden md:block"><span className="scroll-cue block" aria-hidden="true" /></div>
        </div>
      </section>
    );
  }

  if (variant === 'editorial') {
    return (
      <section id={s.id || 'home'} className="relative isolate overflow-hidden" {...spotlight}>
        <HeroBackdrop />
        <div className="container-x pb-10 pt-20 md:pt-28">
          <div className="max-w-5xl">{text}</div>
        </div>
        <div className="container-x pb-16 md:pb-24">
          {img ? (
            <div {...(motion.image_reveal ? { 'data-reveal': 'image', style: { '--i': 0, transitionDelay: `${base + 500}ms` } as any } : rv(0))} className="hero-media relative aspect-[16/10] overflow-hidden rounded-brand md:aspect-[21/9]">
              <img src={img} alt={s.image_alt || ''} className="h-full w-full object-cover" fetchPriority="high" {...(parallax ? { 'data-parallax': '0.1' } : {})} />
            </div>
          ) : (
            <div {...at(3)}><VisualPanel icon={s.icon} label={s.visual_label} className="aspect-[16/10] md:aspect-[21/9]" /></div>
          )}
        </div>
      </section>
    );
  }

  if (center) {
    return (
      <section id={s.id || 'home'} className="relative isolate overflow-hidden" {...spotlight}>
        <HeroBackdrop />
        <div className="container-x mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center py-24 text-center md:py-32">
          {text}
          {img && (
            <div {...at(3)} className="hero-media mt-16 w-full overflow-hidden rounded-brand border border-border shadow-2xl">
              <img src={img} alt={s.image_alt || ''} className="w-full object-cover" fetchPriority="high" />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section id={s.id || 'home'} className="relative isolate overflow-hidden" {...spotlight}>
      <HeroBackdrop />
      <div className="container-x grid min-h-[78vh] items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
        <div>{text}</div>
        {img ? (
          <div {...(motion.image_reveal ? { 'data-reveal': 'image', style: { '--i': 0, transitionDelay: `${base + 250}ms` } as any } : at(3))} className="hero-media relative aspect-[4/3] overflow-hidden rounded-brand shadow-2xl lg:aspect-[5/6]">
            <img src={img} alt={s.image_alt || ''} className="h-full w-full object-cover" fetchPriority="high" {...(parallax ? { 'data-parallax': '0.1' } : {})} />
          </div>
        ) : (
          <div {...at(3)}><VisualPanel icon={s.icon} label={s.visual_label} className="aspect-[4/3] lg:aspect-[5/6]" /></div>
        )}
      </div>
    </section>
  );
}
