---
name: outreach-email
description: How to write the personalised, honest, non-spammy outreach email for a Prospect Engine lead (structure, tone, length, compliance, opt-out) and save it as a draft only. Use when writing or revising a prospect email.
---

# Outreach email rules

The goal is a short, genuine note from one person to one business owner — never a mass-marketing message.
The app **never sends**. It only saves a draft; the user reviews and sends it personally.

## Structure (120–220 words, plain text)
1. **Greeting** — the contact person's name if publicly known ("Hi Priya,"), otherwise "Hi <Business name> team,".
2. **Who you are, one line** — sender name + agency name (from settings). Honest sender identity is required.
3. **A genuine, specific observation** — something real from the research: a dish they post often, their busy
   weekend cake orders, their 4.8★ Google rating (only if verified)… Show you actually looked.
4. **The opportunity, framed kindly** — from the website audit, e.g. "your menu and pre-orders currently live only in
   Instagram DMs" or "the current site is hard to use on phones". No insults, no exaggeration.
5. **The prototype** — "I put together a free concept of what a site for <Business> could look like:" + the exact
   prototype URL on its own line. Mention it is a concept/preview, not live.
6. **Low-pressure invitation** — e.g. "Happy to walk you through it on a 10-minute call, or just reply with thoughts."
7. **Polite opt-out** — "If this isn't useful, just let me know and I won't follow up."
8. **Signature** — the signature from settings (name, agency, website, phone if set).

## Subject line
Short, specific, lowercase-friendly, no hype: "A website concept for Harbour Lane Bakery", "Idea for <Business>'s online menu".

## Never
- False claims, invented statistics, guarantees ("double your bookings"), fake urgency ("only today"), flattery overload.
- Claiming you are a customer, or implying any affiliation.
- Mentioning private data or how you "tracked" them.
- Placeholders, template variables, or brackets left in the text.
- Attaching anything; HTML formatting; multiple links (one prototype link, plus your own website in the signature).
- Bulk/mass sending, follow-up sequences, WhatsApp or Instagram DMs.

## Compliance
- Only email addresses publicly published for business contact (saved via `save_contacts` with a source).
- Respect the do-not-contact list (`suppress_contact`). If someone declines, add them.
- One email per business; the tools prevent duplicate drafts.
- Remind the user once, briefly, that cold email rules differ by country (e.g. GDPR/PECR in the UK/EU, CAN-SPAM in
  the US, DPDP in India) and they are responsible for sending appropriately.

## Saving
1. `save_email` (validates recipient, link, length, spam phrases, opt-out). Fix errors; show warnings to the user.
2. Show the final email to the user and ask: "Save this to your Drafts?" (they may edit it first).
3. Gmail: use the Gmail connector's **create draft** tool (never a send tool), then `record_gmail_draft` with the
   returned draft id. IMAP: run the CLI `draft-imap <lead>`.
