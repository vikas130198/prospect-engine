// Loads the prototype's content.json plus its local assets and custom components.
import raw from '../site/content.json';

export const content: any = raw;

const assetUrls = import.meta.glob('../site/assets/**/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Resolve an image reference: absolute https URL, or a file in the prototype's assets/ folder. */
export function asset(src?: string | null): string | null {
  if (!src || typeof src !== 'string') return null;
  if (/^https:\/\//i.test(src)) return src;
  const key = '../site/' + src.replace(/^\.?\/?/, '').replace(/^site\//, '');
  return assetUrls[key] ?? null;
}

export const customComponents = import.meta.glob('../site/custom/*.tsx', { eager: true }) as Record<string, { default: any }>;

export function customComponent(name: string) {
  return customComponents[`../site/custom/${name}.tsx`]?.default ?? null;
}

declare const __PROSPECT_CODE__: string;
export const CLIENT_CODE: string = typeof __PROSPECT_CODE__ === 'string' ? __PROSPECT_CODE__ : 'PREVIEW';
