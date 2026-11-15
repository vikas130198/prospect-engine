import { Component, type ReactNode } from 'react';
import { CLIENT_CODE, content, customComponent } from './lib/content';
import { Footer, Navbar, PreviewBanner } from './components/Layout';
import { Hero } from './components/sections/Hero';
import { About, Cta, Faq, Features, Gallery, Menu, Pricing, Process, Services, Stats, Team, Testimonials } from './components/sections/Blocks';
import { Contact } from './components/sections/Contact';

const SECTIONS: Record<string, any> = {
  hero: Hero,
  about: About,
  services: Services,
  menu: Menu,
  gallery: Gallery,
  features: Features,
  process: Process,
  testimonials: Testimonials,
  stats: Stats,
  pricing: Pricing,
  team: Team,
  faq: Faq,
  cta: Cta,
  contact: Contact,
};

/** One broken section must never blank the whole page. */
class SectionBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(`Section "${this.props.name}" failed to render`, err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function App() {
  const c = content;
  const sections: any[] = Array.isArray(c.sections) ? c.sections : [];
  return (
    <div id="top" data-prospect-code={CLIENT_CODE} className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-bg focus:px-4 focus:py-2">Skip to content</a>
      <PreviewBanner c={c} />
      <Navbar c={c} />
      <main id="main">
        {sections.map((s, i) => {
          const C = s.type === 'custom' ? customComponent(s.component) : SECTIONS[s.type];
          if (!C) return null;
          return (
            <SectionBoundary key={s.id || i} name={s.id || s.type}>
              <C s={s} c={c} />
            </SectionBoundary>
          );
        })}
      </main>
      <Footer c={c} />
    </div>
  );
}
