import { useEffect, useState } from 'react';
import { Menu as MenuIcon, X } from 'lucide-react';
import { asset } from '../lib/content';
import { Btn, hasText, isExternal, safeHref, SocialIcon, T } from './ui';
import { rv } from '../lib/motion';

/** Honest disclosure: this is a concept preview, not the business's official website. */
export function PreviewBanner({ c }: { c: any }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const agency = c.preview?.agency_name || 'our studio';
  return (
    <div className="relative z-50 bg-text text-bg" data-preview-banner>
      <div className="container-x flex items-center justify-between gap-3 py-2 text-[13px]">
        <p>
          <strong className="font-semibold">Concept preview</strong> prepared by{' '}
          {c.preview?.agency_url && /^https:\/\//.test(c.preview.agency_url) ? (
            <a className="underline underline-offset-2" href={c.preview.agency_url} target="_blank" rel="noopener noreferrer">{agency}</a>
          ) : (
            agency
          )}{' '}
          for {c.business?.name || 'this business'} — not the official website.
        </p>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded opacity-80 hover:opacity-100" aria-label="Hide preview notice">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Navbar({ c }: { c: any }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('');
  // Highlight the link of the section currently on screen.
  useEffect(() => {
    const ids = (c.nav?.links || []).map((l: any) => String(l.href || '')).filter((h: string) => /^#[a-z]/.test(h)).map((h: string) => h.slice(1));
    const els = ids.map((id: string) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: '-45% 0px -50% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [c]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links: any[] = (c.nav?.links || []).filter((l: any) => hasText(l.label));
  const logo = asset(c.business?.logo);
  const name = c.business?.logo_text || c.business?.name;
  return (
    <header data-nav className={`sticky top-0 z-40 border-b ${scrolled ? 'border-border bg-bg/90 shadow-sm backdrop-blur' : 'border-transparent bg-bg'}`}>
      <nav className="container-x flex h-16 items-center justify-between gap-4 md:h-20" aria-label="Main">
        <a href="#top" className="flex min-h-11 min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          {logo ? <img src={logo} alt={`${c.business?.name} logo`} className="h-9 w-auto max-w-40 object-contain md:h-11" /> : null}
          {(!logo || c.business?.show_name_with_logo) && <span className="truncate font-heading text-xl font-semibold md:text-2xl"><T>{name}</T></span>}
        </a>
        <div className="hidden items-center gap-8 lg:flex">
          {links.map((l, i) => (
            <a key={i} href={safeHref(l.href, '#top')} aria-current={active && l.href === `#${active}` ? 'true' : undefined} className="nav-link text-[15px] font-medium text-muted transition-colors hover:text-text aria-[current=true]:text-text"><T>{l.label}</T></a>
          ))}
          {c.nav?.cta && <Btn href={c.nav.cta.href} label={c.nav.cta.label} className="!min-h-10 !px-5 !py-2" />}
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-brand border border-border lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MenuIcon className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>
      {open && (
        <div id="mobile-menu" className="mobile-menu-panel border-t border-border bg-bg lg:hidden">
          <div className="container-x flex flex-col gap-1 py-4">
            {links.map((l, i) => (
              <a key={i} href={safeHref(l.href, '#top')} onClick={() => setOpen(false)} style={{ '--i': i } as any} className="rounded-brand px-3 py-3 font-heading text-2xl font-medium hover:bg-surface"><T>{l.label}</T></a>
            ))}
            {c.nav?.cta && (
              <div className="pt-2" onClick={() => setOpen(false)}>
                <Btn href={c.nav.cta.href} label={c.nav.cta.label} className="w-full" />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer({ c }: { c: any }) {
  const f = c.footer || {};
  const social: any[] = (f.social || []).filter((s: any) => /^https:\/\//.test(s.url || ''));
  const links: any[] = (c.nav?.links || []).filter((l: any) => hasText(l.label));
  const year = new Date().getFullYear();
  const plainName = String(c.business?.logo_text || c.business?.name || '').replace(/[[(.*?)]]/g, '$1');
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-x grid gap-10 py-12 md:grid-cols-3">
        <div>
          <p className="font-heading text-2xl font-semibold"><T>{c.business?.name}</T></p>
          {hasText(f.text) && <p className="mt-3 max-w-sm text-muted"><T>{f.text}</T></p>}
        </div>
        {links.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Explore</p>
            <ul className="space-y-2">
              {links.map((l, i) => (
                <li key={i}><a href={safeHref(l.href, '#top')} className="hover:text-primary"><T>{l.label}</T></a></li>
              ))}
            </ul>
          </div>
        )}
        {social.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Follow</p>
            <div className="flex flex-wrap gap-3">
              {social.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.platform} data-magnetic="" className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:border-primary hover:text-primary">
                  <SocialIcon platform={s.platform} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="container-x overflow-hidden pb-6" aria-hidden="true">
        <p {...rv(0)} data-word={plainName} className="wordmark font-heading font-semibold" />
      </div>
      <div className="border-t border-border">
        <div className="container-x flex flex-col gap-2 py-5 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <p>© {year} <T>{c.business?.name}</T></p>
          <p>
            Concept preview by{' '}
            {c.preview?.agency_url && isExternal(c.preview.agency_url) ? (
              <a href={c.preview.agency_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{c.preview?.agency_name}</a>
            ) : (
              c.preview?.agency_name || 'our studio'
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
