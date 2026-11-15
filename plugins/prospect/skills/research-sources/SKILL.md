---
name: research-sources
description: Permitted ways to research an Instagram business and its online presence for the Prospect Engine (official API, public pages, search, user screenshots) and what is forbidden (scraping behind logins, cookies, automation). Use when researching a prospect's Instagram profile, website or contacts.
---

# Permitted research sources

## Allowed
1. **Official Instagram Graph API** (`instagram_lookup` tool) — only if the user configured it, and only for
   Business/Creator accounts. Results are `verified` with source "Instagram Graph API".
2. **The public profile page** — at most one `WebFetch` of `https://www.instagram.com/<username>/`. It often shows a
   login wall or little data; that is fine — record what is missing as `unknown`.
3. **Search engines** (`WebSearch`): `"<business name>" <city>`, `"<username>" instagram`, `"<business name>" website`,
   `"<business name>" reviews`, `"<business name>" phone`. Google Business Profile / Maps / directory listings that
   appear in results may be fetched.
4. **The business's own website and its public pages** (`audit_website`, `extract_contacts`, `WebFetch`).
5. **Screenshots and notes the user pastes** — read them carefully; they are often the best source of follower
   counts, bio, highlights and recent posts. Mark as `verified`, source "user screenshot".
6. **Manual entry** — ask the user for a metric only when it matters for the decision (e.g. follower count).

## Forbidden
- Logging in to Instagram/Facebook, using session cookies, or any login bypass.
- Automated scraping of Instagram beyond the single public page fetch, or using unofficial Instagram APIs.
- Collecting private personal data (personal phone numbers or emails from unrelated sites, family members, home addresses).
- Sending any message, follow, like or DM.

## Verifying the official website
Never assume a similarly named site belongs to the business. Accept a website as official only with at least one of:
- It is linked from their Instagram bio / link-in-bio page.
- It links back to the same Instagram account.
- Same phone/address/brand name and location as the Instagram profile.
- Their Google Business Profile links to it.
Record how it was verified in `save_website_audit.verification`. If unsure, set `official_website: null` and explain.

## Contacts
- Business emails/phones published on the official website, Google Business Profile, official social profiles or
  reputable directories — each saved with its `source_url`.
- WhatsApp is `verified` only with a public `wa.me` / WhatsApp link from the business. A phone number alone means
  WhatsApp availability is `unknown`.
- Prefer generic business addresses (info@, hello@, bookings@) or the owner's published business address.
