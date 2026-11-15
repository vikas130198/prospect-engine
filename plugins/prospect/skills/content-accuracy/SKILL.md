---
name: content-accuracy
description: Rules for never inventing business facts in Prospect Engine research, prototypes and emails — what counts as verified, how to label uncertainty, and how to use placeholders. Use whenever writing research reports, prototype content or outreach for a prospect.
---

# Content accuracy rules

The Prospect Engine shows real businesses a website made about them. A single invented fact (a wrong phone number,
a fake review, an award they never won) destroys trust and can mislead their customers. These rules are not optional.

## Four labels for every fact

| Label | Meaning | Example |
|---|---|---|
| `verified` | Seen directly in a named public source, or stated by the user | Bio text from a screenshot the user pasted; phone from the official website's contact page |
| `ai_analysis` | Your reasoned interpretation of verified facts | "Target audience appears to be young families" from post content |
| `assumption` | A plausible guess that has not been checked | "Probably takes orders by DM" |
| `unknown` | Could not be found | Follower count when the profile would not load |

`verified` always needs a `source` (URL, "Instagram Graph API", or "user screenshot"/"user said").
Never upgrade a label because it sounds likely. Missing data is recorded as `unknown`, never estimated.

## Never invent these (anywhere)

Addresses · phone numbers · email addresses · WhatsApp numbers · prices · opening hours · certifications · awards ·
testimonials / reviews / star ratings · customer, patient or project counts · years in business / "since 19xx" ·
team member names · branch locations · partner or client logos · guarantees.

If one is unavailable, do exactly one of:
1. **Omit it** (best for claims, stats, reviews, awards).
2. **Use a clearly marked placeholder**: `[[Add opening hours]]` — renders as a dashed, highlighted "to be confirmed" marker.
3. **Ask the user** if they know it, then save it with `update_lead` → `facts` (user-stated facts count as verified).

## Prototype-specific enforcement

The build refuses content that breaks these rules (`validate_prototype`):
- Phones and emails in content must match a saved contact (with source) or a user-stated fact.
- `testimonials` items need a real public `source_url` (e.g. their Google review). No source → delete the section.
- `stats` items need a `source`. `pricing` plans and menu/service prices need a source or a `[[placeholder]]`.
- Claims like "award-winning", "10+ years", "500 happy clients", "#1", "guaranteed" raise warnings — remove them unless verified.

Writing *original marketing copy* is fine and expected (headlines, descriptions of services they visibly offer,
calls to action). Copy may describe what is evident from their posts; it may not assert unverifiable facts.

## Images

- Use only images the business published publicly for promoting itself (with the URL recorded), images the user
  supplies, or no image (the templates have attractive image-free visual panels).
- Never use competitor or reference-site images, stock images with unclear licences, or AI images presented as the
  business's real premises, food, staff or work.

## Inspiration vs copying

Competitor and reference websites are inspiration for structure and style only. Never copy their text, code, images,
logos or brand identity.
