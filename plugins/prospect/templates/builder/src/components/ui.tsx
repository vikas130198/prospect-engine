import type { ReactNode } from 'react';
import { motion, SplitText } from './motion';
import { rv } from '../lib/motion';
import {
  ArrowRight, Award, BadgeCheck, Baby, Bike, BookOpen, Briefcase, Building2, CalendarCheck, Camera, Car, Check, ChefHat,
  Clock, Coffee, Cpu, Dumbbell, Factory, Flower2, Gem, Gift, Globe, GraduationCap, Hammer, HandHeart, Heart, HeartPulse,
  Home, Leaf, Lightbulb, Mail, MapPin, MessageCircle, Music, Package, Paintbrush, PawPrint, Phone, Pizza, Plane, Palette,
  Ruler, Scissors, Shield, ShieldCheck, ShoppingBag, Smile, Sofa, Sparkles, Star, Stethoscope, Sun, Target, Timer, Truck,
  Users, Utensils, Wallet, Wine, Wrench, Zap,
} from 'lucide-react';

/** Curated icon set (keeps bundles small). Content refers to icons by these names. */
export const ICONS: Record<string, any> = {
  'arrow-right': ArrowRight, award: Award, 'badge-check': BadgeCheck, baby: Baby, bike: Bike, 'book-open': BookOpen,
  briefcase: Briefcase, building: Building2, calendar: CalendarCheck, camera: Camera, car: Car, check: Check, 'chef-hat': ChefHat,
  clock: Clock, coffee: Coffee, cpu: Cpu, dumbbell: Dumbbell, factory: Factory, flower: Flower2, gem: Gem, gift: Gift, globe: Globe,
  'graduation-cap': GraduationCap, hammer: Hammer, 'hand-heart': HandHeart, heart: Heart, 'heart-pulse': HeartPulse, home: Home,
  leaf: Leaf, lightbulb: Lightbulb, mail: Mail, 'map-pin': MapPin, message: MessageCircle, music: Music, package: Package,
  paintbrush: Paintbrush, palette: Palette, paw: PawPrint, phone: Phone, pizza: Pizza, plane: Plane, ruler: Ruler, scissors: Scissors,
  shield: Shield, 'shield-check': ShieldCheck, 'shopping-bag': ShoppingBag, smile: Smile, sofa: Sofa, sparkles: Sparkles, star: Star,
  stethoscope: Stethoscope, sun: Sun, target: Target, timer: Timer, truck: Truck, users: Users, utensils: Utensils, wallet: Wallet,
  wine: Wine, wrench: Wrench, zap: Zap,
};

export function Icon({ name, className = 'h-6 w-6' }: { name?: string; className?: string }) {
  const C = (name && ICONS[name]) || Sparkles;
  return <C className={className} aria-hidden="true" strokeWidth={1.75} />;
}

const PH = /(\[\[.*?\]\])/g;
export const isPlaceholder = (s?: string) => typeof s === 'string' && /^\s*\[\[.*\]\]\s*$/.test(s);
export const hasText = (s?: string) => typeof s === 'string' && s.trim() !== '';

/** Render text; [[...]] segments become clearly marked placeholders for unconfirmed details. */
export function T({ children }: { children?: string | null }) {
  if (!children) return null;
  const parts = String(children).split(PH);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[[') && p.endsWith(']]') ? (
          <span key={i} className="placeholder-text" title="Placeholder — to be confirmed with the business">
            {p.slice(2, -2)}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Only allow safe link targets. Placeholders fall back to the contact section. */
export function safeHref(href?: string, fallback = '#contact'): string {
  if (!href || isPlaceholder(href) || href.includes('[[')) return fallback;
  if (/^(#[A-Za-z][\w-]*|#)$/.test(href)) return href;
  if (/^(https:\/\/|mailto:|tel:)/i.test(href)) return href;
  return fallback;
}

export function isExternal(href: string) {
  return /^https:\/\//i.test(href);
}

type BtnProps = { href?: string; label?: string; variant?: 'primary' | 'outline' | 'ghost'; className?: string; icon?: boolean };
export function Btn({ href, label, variant = 'primary', className = '', icon = false }: BtnProps) {
  if (!hasText(label)) return null;
  const h = safeHref(href);
  const styles = {
    primary: 'btn-shine bg-primary text-primary-contrast hover:brightness-110 shadow-sm hover:shadow-lg',
    outline: 'border border-current/30 text-text hover:bg-text/5',
    ghost: 'text-primary underline-offset-4 hover:underline',
  }[variant];
  return (
    <a
      href={h}
      {...(isExternal(h) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...(variant !== 'ghost' ? { 'data-magnetic': '' } : {})}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-brand px-6 py-3 text-[15px] font-semibold ${styles} ${className}`}
    >
      <T>{label}</T>
      {icon && <ArrowRight className="btn-arrow h-4 w-4" aria-hidden="true" />}
    </a>
  );
}

/** Small uppercase label above headings, with a drawn rule. */
export function Eyebrow({ text, center = false, className = '' }: { text?: string; center?: boolean; className?: string }) {
  if (!hasText(text)) return null;
  return <p {...rv(0)} className={`eyebrow-line ${center ? 'center-eyebrow' : ''} mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-primary ${className}`}><T>{text}</T></p>;
}

/** Section heading (h2) that reveals word by word when the motion preset allows it. */
export function Heading({ text, as = 'h2', className = 'text-3xl font-semibold md:text-5xl' }: { text?: string; as?: any; className?: string }) {
  if (!hasText(text)) return null;
  const Tag = as;
  if (motion.heading_reveal) return <SplitText as={as} text={text} mode="words" className={className} />;
  return <Tag {...rv(0)} className={className}><T>{text}</T></Tag>;
}

type ShellProps = { id?: string; eyebrow?: string; heading?: string; intro?: string; tone?: 'default' | 'surface' | 'accent'; children: ReactNode; center?: boolean };
export function Section({ id, eyebrow, heading, intro, tone = 'default', children, center = false }: ShellProps) {
  const bg = tone === 'surface' ? 'bg-surface' : tone === 'accent' ? 'bg-accent' : '';
  return (
    <section id={id} className={`relative py-20 md:py-32 ${bg}`}>
      <div className="container-x">
        {(hasText(heading) || hasText(eyebrow) || hasText(intro)) && (
          <header className={`mb-12 md:mb-16 ${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
            <Eyebrow text={eyebrow} center={center} />
            <Heading text={heading} />
            {hasText(intro) && <p {...rv(2)} className="mt-5 text-lg text-muted"><T>{intro}</T></p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

export function Img({ src, alt, className = '' }: { src: string | null; alt?: string; className?: string }) {
  if (!src) return null;
  return <img src={src} alt={alt || ''} loading="lazy" decoding="async" className={className} />;
}

/** Image in a frame that wipes in from a mask and settles from a slow zoom (image_reveal), or fades in. */
export function RevealImage({ src, alt, className = '', frameClass = '', i = 0, priority = false, parallax = false }: { src: string | null; alt?: string; className?: string; frameClass?: string; i?: number; priority?: boolean; parallax?: boolean }) {
  if (!src) return null;
  const reveal = motion.image_reveal ? { 'data-reveal': 'image', style: { '--i': i } as any } : rv(i);
  return (
    <div {...reveal} className={`card-media relative overflow-hidden rounded-brand ${frameClass}`}>
      <img src={src} alt={alt || ''} {...(priority ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })} decoding="async" className={`h-full w-full object-cover ${className}`} {...(parallax ? { 'data-parallax': '0.12' } : {})} />
    </div>
  );
}

/** Decorative stand-in when the business has no usable photos yet. */
export function VisualPanel({ icon, label, className = '' }: { icon?: string; label?: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-brand border border-border bg-surface ${className}`} role="img" aria-label={label || 'Decorative illustration'}>
      <div className="absolute inset-0 hero-glow" />
      <div className="absolute inset-0 pattern-dots opacity-60" />
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="orbit h-56 w-56" />
        <span className="orbit h-80 w-80" style={{ animationDuration: '70s', animationDirection: 'reverse' }} />
      </div>
      <div className="relative flex h-full min-h-56 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="float-y flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-contrast shadow-lg">
          <Icon name={icon} className="h-9 w-9" />
        </div>
        {label && <p className="max-w-xs font-heading text-xl"><T>{label}</T></p>}
      </div>
    </div>
  );
}

const SOCIAL_PATHS: Record<string, string> = {
  instagram: 'M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 4.7a5.1 5.1 0 100 10.2 5.1 5.1 0 000-10.2zm0 8.4a3.3 3.3 0 110-6.6 3.3 3.3 0 010 6.6zm5.3-9.8a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z',
  facebook: 'M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4z',
  whatsapp: 'M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.8 14.1c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l1 2.3c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2.2 1c.3.2.5.2.6.4 0 .1 0 .7-.2 1.4z',
  linkedin: 'M4.98 3.5a2.5 2.5 0 11-.01 5 2.5 2.5 0 01.01-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.7 4.8 6.1V21h-4v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z',
  youtube: 'M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12a31 31 0 00.5 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.5-4.8 31 31 0 00-.5-4.8zM9.8 15.1V8.9L15.2 12z',
};

export function SocialIcon({ platform, className = 'h-5 w-5' }: { platform: string; className?: string }) {
  const d = SOCIAL_PATHS[platform?.toLowerCase()];
  if (!d) return <Globe className={className} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
