---
name: design-library
description: How to read the user's design library (website design videos and screenshots in design-library/inbox), analyse new files once, and pick the best-suited designs, animations and transitions for a prototype by design fit — not by industry. Use in the design stage, when the user adds videos, or runs /prospect:library.
---

# Design library

The user drops **screen recordings of websites they love** (MP4/WebM/MOV) and screenshots into
`<workspace>/design-library/inbox/`. These are their taste: every prototype must be checked against them.

## 1. Bring the library up to date (every design stage — cheap when nothing is new)
1. `design_library` action `status`.
2. If `needs_frames` is not empty: Bash `node "<cli>" library-scan` (timeout 600000). It turns each new video into
   contact sheets (`intro.jpg` = first 6 s every 0.5 s, `overview-1/2.jpg` = the whole recording, `detail.jpg` = one
   full-size frame). Unsupported files are reported with a fix — tell the user (e.g. "export as MP4 (H.264)").
3. For each entry in `needs_analysis`: Task subagent `design-librarian` with the entry ids (it looks at the sheets and
   calls `save_design_analysis`). Several entries → one librarian call with all ids. Analysis happens **once per file**.

## 2. Choose (design-selector does this)
`design_catalog` returns `design_library.analysed` (title, summary, style, mood, `suits`, `avoid_for`,
`template_mapping`). Choose by **design fit, never by the industry of the site in the video**:
- What does this business need to feel like? (premium/calm/energetic/trustworthy/playful/bold)
- What content does it really have? Photo-rich → image-led patterns (fullbleed/editorial hero, scroll gallery,
  image reveals). Few photos → typography-led patterns (oversized split headings, marquee, aurora/spotlight hero).
- Positioning (budget vs premium) and the primary action (call, book, order, visit).
- Respect `avoid_for`. Prefer `favourite` entries when the fit is equal.

Pick **one primary entry** (look, hero, motion) and optionally one secondary (a single section pattern). If nothing
fits, say so and use the layout's default motion preset — never force a bad match. If unsure between two, `Read` their
`detail_frame` images (one image each) before deciding.

## 3. Translate into the template
The template can express: motion presets and options (`design_catalog.motion_presets` / `motion_options`), hero
variants (split, centered, fullbleed, editorial), section variants (gallery scroll, process stack, services list),
the `marquee` band, themes/colours/fonts. Start from the entry's `template_mapping`, adjust to this business, and save
with `save_design` (`motion`, `library_ids`, section variants). In `design-plan.md` write a **"Design library"**
section: which entry, what is taken (look, hero, motion, a section pattern) and what is deliberately not.

At most one `custom` section may recreate a signature moment the template cannot do (listed in
`template_mapping.not_supported`), only if it clearly matters for this business.

Inspiration only: never copy the video's text, images, logos, brand names or exact layouts.
