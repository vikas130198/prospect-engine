---
name: motion-design
description: Standard for making every prototype engaging and timeless — choosing motion presets, hero effects, section variants and copy that animates well, while keeping accessibility and performance. Use when selecting a design or writing/regenerating a prototype.
---

# Engaging, timeless motion

Every prototype must feel crafted and alive — never a plain, static template — and still look right in ten years.
Timeless motion is **purposeful, smooth and restrained in amplitude**, not loud.

## Principles
- Motion explains hierarchy: headline first, then supporting text, then actions; sections reveal as they arrive.
- One signature moment per page (curtain intro, parallax hero, horizontal gallery, stacking process cards or a marquee
  band) — not all of them.
- Slow, eased, confident: the template uses expo-out easing and 0.7–1.2 s durations. Never bounce text.
- Hover feedback everywhere (buttons, cards, images, links) — the template provides it automatically.
- Content first: animation never hides information permanently. With "reduce motion" everything is static and visible
  (the template and QA enforce this).
- Avoid trends that date fast: neon glows, heavy glassmorphism, autoplaying sound, cursor trails, spinning 3D logos.

## Choosing (content.json → `motion`)
`{"preset": "<name>", …overrides}`. Presets: **cinematic** (curtain intro, masked reveals, parallax, cursor —
premium/visual brands), **elegant** (default: soft reveals, Ken Burns imagery — calm, refined), **bold** (scale-ins,
aurora gradients, tilting cards — energetic/youthful), **playful** (springy slides, aurora — kids, cafés, pets,
creative), **tech** (blur-ins, letter reveals, spotlight + grid — modern B2B, SaaS, modern clinics), **minimal**
(quiet fades — law, finance, medical where restraint signals trust).
Override single options only with a reason, e.g. `{"preset":"elegant","hero_effect":"parallax"}` when there is a
strong photo, or `"hero_effect":"aurora"` when there is none. Options: intro, reveal, hero_text, hero_effect, nav,
smooth_scroll, cursor, magnetic, tilt, scroll_progress, image_reveal, heading_reveal, counters, grain, speed.

Match effect to content:
| You have | Use |
|---|---|
| A strong wide photo | hero `fullbleed` or `editorial` + `hero_effect: parallax` or `ken-burns` |
| Good portrait photos | hero `split` + `image_reveal` |
| No usable photos | hero `split`/`centered` + `aurora` or `spotlight`, typography-led, marquee band |
| 4+ photos | gallery `variant: "scroll"` (horizontal, scroll-driven) |
| A clear 3–5 step process | process `variant: "stack"` (sticky stacking cards) |
| Many services with short text | services `variant: "list"` (large numbered rows) |
| Short verified offerings/places/values | a `marquee` band between two sections |

## Copy that animates well
- Hero heading 3–10 words; words rise one by one, so strong verbs and concrete nouns matter.
- `hero_text: "chars"` only for headings under ~30 characters.
- Section headings short (≤ 8 words); marquee phrases 1–3 words, at least 4 of them, all true for this business.
- Stats count up — only with verified numbers (the accuracy rules still apply).
