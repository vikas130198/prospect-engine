import { useEffect, useState, type ElementType } from 'react';
import { content } from '../lib/content';
import { prefersReducedMotion, resolveMotion } from '../lib/motion';

export const motion = resolveMotion(content.motion);

/** True when the opening curtain will play on this page load (first visit, motion allowed). */
export const INTRO_ACTIVE: boolean = (() => {
  if (motion.intro !== 'curtain' || typeof window === 'undefined' || prefersReducedMotion()) return false;
  try {
    return !sessionStorage.getItem('prospect-intro');
  } catch {
    return true;
  }
})();

const PH = /(\[\[.*?\]\])/g;
const plain = (s: string) => s.replace(/\[\[(.*?)\]\]/g, '$1');

/**
 * Heading whose words (or letters) rise out of a mask when it scrolls into view.
 * Placeholders [[…]] stay one highlighted unit. Screen readers get the plain text once.
 */
export function SplitText({ as: Tag = 'span', text, mode, className = '', delay = 0 }: { as?: ElementType; text?: string; mode?: 'words' | 'chars' | 'fade'; className?: string; delay?: number }) {
  if (!text) return null;
  const m = mode || 'words';
  if (m === 'fade') {
    return <Tag className={className} data-reveal="fade-up">{renderPlain(text)}</Tag>;
  }
  let i = 0;
  const parts = String(text).split(PH).filter((p) => p !== '');
  const useChars = m === 'chars' && plain(text).length <= 48;
  return (
    <Tag className={className} data-reveal="split" aria-label={plain(text)} style={{ '--d': `${delay}ms` } as any}>
      {parts.map((p, pi) => {
        if (p.startsWith('[[') && p.endsWith(']]')) {
          return (
            <span key={pi} className="split-w" aria-hidden="true">
              <span style={{ '--i': i++ } as any} className="placeholder-text" title="Placeholder — to be confirmed with the business">{p.slice(2, -2)}</span>{' '}
            </span>
          );
        }
        return p.split(/(\s+)/).map((word, wi) => {
          if (!word) return null;
          if (/^\s+$/.test(word)) return ' ';
          return (
            <span key={`${pi}-${wi}`} className="split-w" aria-hidden="true">
              {useChars
                ? [...word].map((ch, ci) => <span key={ci} style={{ '--i': i++ } as any}>{ch}</span>)
                : <span style={{ '--i': i++ } as any}>{word}</span>}
            </span>
          );
        });
      })}
    </Tag>
  );
}

function renderPlain(text: string) {
  return String(text).split(PH).map((p, i) =>
    p.startsWith('[[') && p.endsWith(']]') ? <span key={i} className="placeholder-text">{p.slice(2, -2)}</span> : <span key={i}>{p}</span>,
  );
}

/** Opening curtain with the business name (once per visit). */
export function Intro({ name }: { name?: string }) {
  const [show, setShow] = useState(INTRO_ACTIVE);
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem('prospect-intro', '1');
    } catch { /* private mode */ }
    const t = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(t);
  }, [show]);
  if (!show) return null;
  return (
    <div className="intro-curtain" data-intro aria-hidden="true">
      <p className="intro-name font-heading">{plain(name || '')}</p>
    </div>
  );
}

export function ScrollProgress() {
  if (!motion.scroll_progress) return null;
  return <div className="scroll-progress" data-scroll-progress aria-hidden="true" />;
}

export function Cursor() {
  if (!motion.cursor) return null;
  return (
    <div className="cursor-ring" data-cursor aria-hidden="true">
      <span className="cursor-label">View</span>
    </div>
  );
}
