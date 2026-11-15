---
name: prototype-content
description: Complete reference for writing a Prospect Engine prototype — the content.json schema, every section type and its fields, themes, images, custom components, and the copywriting standard. Use when creating, editing, regenerating or repairing a website prototype.
---

# Writing a prototype

A prototype = one `content.json` (+ optional `assets/` images and `custom/*.tsx` components) rendered by a shared,
tested React + Tailwind template. **You write content, not a website from scratch.** This keeps quality high and
usage low. Edit only the files in the version folder returned by `create_prototype` / `new_prototype_version`.

Workflow: `create_prototype` → edit `content.json` → `validate_prototype` (fix all errors) → CLI `build` → CLI `qa`.
Before changing a version that was already built/deployed, call `new_prototype_version` first.

## Copywriting standard
- Specific to this business: their products, place, audience, tone (from research). Never generic filler
  ("We are committed to excellence…").
- Benefit-led headline (≤ 10 words), one-sentence subheading, scannable 1–2 sentence descriptions.
- Match their language and spelling (e.g. British vs American; Hinglish only if their brand uses it).
- **Every label must fit the business**: change nav CTA, button labels and section headings from the layout defaults
  (a bakery's button is "Pre-order a cake", not "Reserve a table").
- 4–7 sections is ideal. Remove sections you cannot fill truthfully (no reviews → no testimonials section).
- Follow the content-accuracy skill: unknown facts → omit or `[[placeholder]]`.

## Top-level fields
```json
{
  "schema": 1,
  "meta": {
    "title": "Business — clear benefit, ≤ 60–70 chars",
    "description": "50–160 chars, what they offer + where + one benefit",
    "lang": "en",
    "og_image": "https://… (optional, only a public image of the business)",
    "structured_data": { "@context": "https://schema.org", "@type": "Bakery", "name": "…" }
  },
  "business": { "name": "Exact business name", "tagline": "…", "logo": "assets/logo.png" or null, "logo_text": "optional short name", "show_name_with_logo": false },
  "theme": { "preset": "warm-bistro", "colors": { "primary": "#9a3412" }, "fonts": { "heading": "Fraunces", "body": "DM Sans" }, "radius": "1rem" },
  "nav": { "links": [{ "label": "Menu", "href": "#menu" }], "cta": { "label": "Pre-order", "href": "#contact" } },
  "sections": [ … ],
  "footer": { "text": "One-line description", "social": [{ "platform": "instagram", "url": "https://www.instagram.com/…/" }] }
}
```
- `preview` is filled automatically from settings (agency name/link for the "Concept preview" banner). Don't edit it.
- `structured_data`: only with verified facts (name, verified address/phone, sameAs Instagram URL). Omit if unsure.
- `theme.colors` overrides (6-digit hex) — use the brand's real colours from their logo/posts if obvious. Keys: `bg`,
  `surface`, `text`, `muted`, `primary`, `primary-contrast`, `accent`, `border`. Keep text/background contrast ≥ 4.5:1
  (primary + primary-contrast are used for buttons). When unsure, keep the preset.
- `theme.fonts` must be names from `design_catalog().fonts`.
- Social `platform`: instagram, facebook, whatsapp, linkedin, youtube (others show a globe).

## Links
`href` may be `#section-id`, `#top`, `https://…`, `mailto:` or `tel:` (tel/mailto only with verified values).
Every `#id` must exist. Placeholder hrefs fall back to `#contact`.

## Icons (field `icon`)
arrow-right award badge-check baby bike book-open briefcase building calendar camera car check chef-hat clock coffee cpu
dumbbell factory flower gem gift globe graduation-cap hammer hand-heart heart heart-pulse home leaf lightbulb mail
map-pin message music package paintbrush palette paw phone pizza plane ruler scissors shield shield-check shopping-bag
smile sofa sparkles star stethoscope sun target timer truck users utensils wallet wine wrench zap

## Section types
Every section has `type` and unique lowercase `id`. Optional `tone`: `default` | `surface` | `accent` (background).
Optional `eyebrow` (small label above headings) on most sections.

| type | Fields |
|---|---|
| `hero` (first, exactly one — holds the H1) | `variant`: `split` (text + image/visual) · `centered` · `fullbleed` (photo background; needs a strong photo, else gradient); `heading`, `subheading`, `primary_cta {label, href}`, `secondary_cta`, `image`, `image_alt`, `icon` + `visual_label` (shown when no image), `badges[]` (short verified facts like "Dine-in & takeaway") |
| `about` | `heading`, `body` (string or array of paragraphs), `highlights[] {icon, title, text}`, `image`, `image_alt`, `image_side` (`left`/`right`), `icon`, `visual_label`, `cta` |
| `services` | `heading`, `intro`, `variant` (`cards`/`list`), `items[] {icon, title, text, price?, price_source?, image?, image_alt?}`, `price_source`, `cta` |
| `menu` | `heading`, `intro`, `categories[] {name, items[] {name, description, price?, price_source?}}`, `price_source`, `note` |
| `gallery` | `heading`, `images[] {src, alt}` — hidden when empty; first image is large |
| `features` | `heading`, `intro`, `items[] {icon, title, text}` (3 or 4 items look best) |
| `process` | `heading`, `steps[] {title, text}` (3–4 steps) |
| `testimonials` | `heading`, `items[] {quote, author, platform, source_url}` — real public reviews only, quoted exactly |
| `stats` | `items[] {value, label, source}` — verified numbers only |
| `pricing` | `heading`, `plans[] {name, price, period, features[], cta, featured, source}` |
| `team` | `heading`, `members[] {name, role, image?, source}` |
| `faq` | `heading`, `items[] {q, a}` — answers only from verified info or general, safe guidance |
| `cta` | `heading`, `text`, `cta {label, href}` (bold coloured band) |
| `contact` | `heading`, `intro`, `info {phone, whatsapp, email, address, hours[] {days, time}}`, `map_query` (verified address or "Business name, City"), `show_form`, `form {fields[] {name,label,type,required,options?}, submit_label}`, `social[]` |
| `custom` | `component`: PascalCase name of `custom/<Name>.tsx` (see below) |

The contact form is a **demo**: it validates and shows "Preview only — nothing is sent". Default fields: name, phone,
email (optional), message. Field types: text, tel, email, textarea, select (with `options`), date, number.
Adapt labels to the business (e.g. "Cake date" (date), "Number of guests" (number)).

## Images
- Put files in the version's `assets/` folder and reference them as `"assets/<file>"`, or use an `https://` URL of an
  image the business published publicly. Always set `image_alt` / `alt` describing the image.
- Download with `curl -L -o "<assets>/<name>.jpg" "<url>"` only for images the business itself published publicly
  (their website/Google profile). Keep each under ~400 KB (QA warns above that).
- No suitable images? Use `split` hero with `icon` + `visual_label` — it looks intentional. Never use reference-site
  or competitor images, and never present AI or stock images as the business's real premises/products.

## Custom components (use sparingly — they cost more usage and can break the build)
Only when no section type fits (e.g. a cake-size picker or a class timetable). File `custom/CakeSizes.tsx`:
```tsx
import { Section, T, Icon, Btn } from '../../components/ui';
export default function CakeSizes({ s }: { s: any }) {
  return (
    <Section id={s.id} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro}>
      <div className="grid gap-6 md:grid-cols-3">{/* … */}</div>
    </Section>
  );
}
```
Then add `{ "type": "custom", "id": "sizes", "component": "CakeSizes", "heading": "…" }`. Use theme classes only:
`bg-bg bg-surface bg-accent bg-primary text-text text-muted text-primary text-primary-contrast border-border
rounded-brand font-heading container-x`. No external packages, no network calls, no tracking scripts.

## Theme presets
midnight-gold (luxury dining, dark) · warm-bistro (cafés/bakeries) · fresh-clinic (healthcare) · modern-slate
(corporate/B2B) · blush-studio (salon/beauty) · energy-dark (fitness, dark) · earth-living (interiors/real estate) ·
bright-retail (shops) · academy-blue (education) · industrial-steel (manufacturing) · green-organic (organic/eco) ·
event-celebration (events/weddings, dark). See `design_catalog` for layouts and the user's references.
