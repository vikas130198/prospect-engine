# Prospect Engine — Claude Code plugin

Turn an Instagram business profile into a qualified lead with a **working, personalised website prototype** and a
**personalised email waiting in your Drafts** — built for web design agencies and freelancers.

```
/prospect:new https://instagram.com/somebusiness
```

1. **Research** the business from permitted public sources (official Instagram API if configured, search, public
   pages, your screenshots). Every fact is labelled verified / analysis / assumption / unknown.
2. **You approve** ("Proceed & Continue") — nothing else happens until you do.
3. **Website investigation**: finds and verifies the official site, audits it (HTTPS, mobile, metadata, CTAs,
   PageSpeed / Core Web Vitals, broken links), researches competitors, classifies the site (No / Poor / Average /
   Good / No opportunity) and calculates a transparent 100-point opportunity score.
4. **Design selection** from your **design library** (website design videos and screenshots you drop into
   `design-library/inbox` — matched by design fit, not industry), 14 layouts, 12 themes and 6 motion presets.
5. **Prototype**: a responsive, **fully animated** React + Tailwind landing page written for that business —
   word-by-word headline reveals, scroll reveals, parallax / Ken Burns / aurora heroes, smooth scrolling, magnetic
   buttons, tilting cards, scroll-driven galleries, stacking cards, marquee bands, counters, an optional opening
   curtain — plus working navigation, a demo enquiry form and SEO metadata. Animations switch off for visitors who
   prefer reduced motion. Unknown details become clearly marked placeholders — the build **refuses**
   invented phone numbers, emails, reviews, prices or statistics.
6. **Automated QA** with a real browser at 375 / 390 / 768 / 1366 / 1440 px: layout overflow, JavaScript errors,
   broken links/files, mobile menu, form validation, headings, alt text, noindex, asset sizes, Lighthouse. Failures
   are auto-repaired (2–3 attempts) and **deployment is blocked until QA passes**.
7. **Deploy** to your free Cloudflare Pages or Netlify site (optionally your own subdomain):
   `https://prototype.youragency.com/client/AB7K29X2/` — unique unguessable codes, noindex, optional password,
   expiry (30 days default), disable/extend/delete any time.
8. **Contact research**: public business contacts only, each with its source and confidence.
9. **Email**: a short, honest, personalised email with the prototype link → saved to **Gmail Drafts** (Gmail
   connector) or your business mailbox's Drafts (IMAP). **It never sends anything** — enforced by a safety hook.

## Requirements
- Claude Code with a Claude **Pro, Max or Team** plan (no API key needed)
- Node.js **22.13+**, Git, Google Chrome (or Microsoft Edge)
- A free Cloudflare or Netlify account; Gmail or any IMAP mailbox

## Install
```
/plugin marketplace add vikas130198/prospect-engine
/plugin install prospect@nexdev
```
Then, from the folder you want as your workspace: `/prospect:setup`. Full guide: [SETUP.md](SETUP.md).

## How to use

### Quick start (first time)
```
mkdir My-Prospects
cd My-Prospects
claude
```
Then inside Claude Code:
```
/plugin marketplace add vikas130198/prospect-engine
/plugin install prospect@nexdev
/prospect:setup
```
The setup wizard asks for your agency details, connects free hosting (Cloudflare Pages or Netlify) and your email
drafts (Gmail or IMAP), and installs the website builder. It takes about 15–30 minutes, once. Check everything is
working with `/prospect:doctor`.

### Your daily routine
1. Find a business on Instagram that you think needs a website.
2. `/prospect:new <their profile URL>` (paste 1–2 screenshots of the profile for better research).
3. Read the short research summary, then reply **proceed**.
4. Wait while it audits, designs, builds, tests and publishes the prototype (usually a few minutes).
5. Review the email it wrote, reply **save it**, then open your Drafts and send it yourself.

### Example: from Instagram profile to email draft

> The business and all output below are a made-up example to show the flow.

**1. Start a prospect**
```
You:    /prospect:new https://instagram.com/harbour.lane.bakery Brighton bakery, takes cake orders by DM
        [pastes a screenshot of the profile]

Claude: ✅ Research complete — Harbour Lane Bakery (bakery, Brighton, UK)
        • Sourdough, croissants and celebration cakes; posts 3–4× a week
        • No website linked — orders are taken through Instagram DMs
        • Opportunity: online menu + pre-order enquiry page
        • Unknown: opening hours, phone number, exact address
        Report: leads/harbour-lane-bakery/research.md

        Review it and reply "proceed" to continue, tell me what to correct, or reject it.
```

**2. Approve — everything after this runs automatically**
```
You:    proceed

Claude: 🔎 Website investigation — Status: A (No Website)
        📊 Opportunity score: 78 / 100 — Medium priority
           Business activity 8/10 · Audience 6/10 · Website opportunity 24/25
           Growth potential 15/20 · Contact availability 8/15 · Business fit 17/20
        🎨 Design: "restaurant" layout, warm-bistro theme — Hero · About · Menu · Why us · FAQ · Contact
        🛠️ Prototype built (code ZKAUN7D5, v1) — 3 placeholders for you to confirm (phone, address, story)
        🧪 QA passed on 5 screen sizes — 0 critical problems
           Lighthouse: performance 85 · accessibility 100 · best practices 100
        🚀 Live: https://prototype.youragency.com/client/ZKAUN7D5/  (until 15 Dec)
        📇 Contacts: hello@harbourlanebakery.co.uk (verified — their Google Business Profile)
```

**3. Review the email**
```
Claude: To:      hello@harbourlanebakery.co.uk
        Subject: A website concept for Harbour Lane Bakery

        Hi Harbour Lane team,

        I'm Alex from Your Agency, a small web studio. I've been enjoying your sourdough posts — and
        noticed that cake orders currently all go through Instagram messages, with no place to see
        the menu or send a pre-order outside the app.

        I put together a free concept of what a simple site for the bakery could look like:
        https://prototype.youragency.com/client/ZKAUN7D5/

        It has your menu, a pre-order enquiry form and works well on phones. Happy to walk you
        through it in 10 minutes, or just reply with your thoughts.

        If this isn't useful, just let me know and I won't follow up.

        Alex — Your Agency

        Save this to your Drafts? You can also tell me what to change.

You:    make it a bit shorter and mention their celebration cakes, then save it

Claude: ✅ EMAIL READY IN DRAFTS
        Business:   Harbour Lane Bakery
        Recipient:  hello@harbourlanebakery.co.uk
        Subject:    A website concept for Harbour Lane Bakery
        Prototype:  https://prototype.youragency.com/client/ZKAUN7D5/ (live until 15 Dec)
        Draft:      saved in Gmail → Open Gmail Drafts
```
Open your Drafts, read it once more, and press Send yourself.

### More examples

**See and filter your leads**
```
/prospect:list                 all leads with status and next step
/prospect:list high            only high-priority leads
/prospect:list awaiting        leads waiting for your approval
/prospect:list failed          anything that needs attention
/prospect:list bakery          search by name, industry, location or notes
```

**Open one lead, update its status after you send the email**
```
/prospect:open harbour-lane-bakery
/prospect:open harbour-lane-bakery audit         show the website audit report
/prospect:open harbour-lane-bakery qa            show the QA report and screenshots

You: mark harbour-lane-bakery as contacted
You: they replied — set it to Meeting Scheduled and add a note "call on Friday 3pm"
```
Manual statuses: Contacted · Responded · Meeting Scheduled · Converted · Lost.

**Change the prototype (every change becomes a new version — you can always go back)**
```
/prospect:regenerate harbour-lane-bakery use a darker, more premium theme
/prospect:regenerate harbour-lane-bakery rewrite only the hero and about sections
/prospect:regenerate harbour-lane-bakery their phone is 01273 555 0100 and they open 8am–4pm Tue–Sun
/prospect:regenerate harbour-lane-bakery add a gallery using the photos in D:\photos\bakery
/prospect:regenerate harbour-lane-bakery go back to version 1
```
After a change it is re-tested automatically, and it asks before updating the live link.

**Manage live prototypes**
```
/prospect:prototypes                                   list all, with expiry dates
/prospect:prototypes extend harbour-lane-bakery 30     keep it live 30 more days
/prospect:prototypes protect harbour-lane-bakery on    require a password to view
/prospect:prototypes disable harbour-lane-bakery       switch it off now
/prospect:prototypes delete harbour-lane-bakery        remove it permanently
```

**When something stops or fails**
```
/prospect:resume harbour-lane-bakery           continue where it stopped (e.g. after a usage limit)
/prospect:retry harbour-lane-bakery qa         redo one stage
/prospect:retry harbour-lane-bakery research   start again from research (needs approval again)
/prospect:doctor                                check hosting login, email, browser and tools
```

**Teach it your taste with design videos (design library)**

Drop screen recordings of websites you love (MP4/WebM, 20 s – 3 min, scroll slowly) or screenshots into
`design-library/inbox/` in your workspace. Before every prototype Claude checks the folder, studies anything new
once (it turns each video into frame sheets with Chrome — nothing is uploaded), and picks the design, animations and
transitions that best suit *this* business — by look and feel, not by the industry of the site in the video.
```
/prospect:library                 what's in the library, what's new, anything unsupported
/prospect:library scan            study new videos now
/prospect:library list            analysed designs and what each suits
/prospect:regenerate harbour-lane-bakery use the design from dark-editorial-scroll
/prospect:regenerate harbour-lane-bakery make it more cinematic, add parallax to the hero
```

**Teach it your taste with design references**
```
/prospect:references add https://some-cafe-site-you-like.com — love the big photos and simple menu
/prospect:references list restaurants
/prospect:references scan        after dropping screenshots into references/<category>/<name>/
```

**Say no to a business**
```
/prospect:reject harbour-lane-bakery not a good fit
```
It can also add the business to your do-not-contact list so it is never emailed.

**See everything at a glance**
```
/prospect:dashboard
```
Opens a page in your browser with totals (researched, high priority, prototypes live, emails in Drafts, converted),
every lead's 12-stage progress, prototype expiry dates and anything that failed.

You can also just talk normally — for example *"what's waiting for me?"* or *"show me leads with no website in
Brighton"* — and Claude uses the same tools.

### Tips for better results
- **Fill your design library**: 5–10 recordings of sites you love gives every prototype your taste.
- **Paste screenshots** of the Instagram profile and a few posts — Instagram often hides data from tools.
- **Tell it facts you know** (phone, hours, address): it only puts verified details on the prototype, and fills
  the rest with clearly marked `[[placeholders]]`.
- **Add a free PageSpeed API key** in `/prospect:setup` so website audits include speed and Core Web Vitals data.
- **Use your own subdomain** (e.g. `prototype.youragency.com`) — links look far more trustworthy in emails.
- **On Claude Pro**, use Lite mode and do 1–3 prospects per 5-hour window; check `/usage`.

## Commands

| Command | What it does |
|---|---|
| `/prospect:setup [step]` | First-time setup wizard; re-run any time (e.g. `/prospect:setup email`) |
| `/prospect:doctor` | Health check of every component, with fixes |
| `/prospect:new <url> [notes]` | Start a prospect from an Instagram profile and research it |
| `/prospect:approve <id>` | Approve the research and run the rest of the workflow |
| `/prospect:reject <id> [reason]` | Reject a lead (optionally add to do-not-contact) |
| `/prospect:resume <id>` | Continue from the next unfinished stage |
| `/prospect:retry <id> <stage>` | Redo one stage and continue |
| `/prospect:list [filter]` | Leads table: `high`, `medium`, `low`, `awaiting`, `ready`, `failed` or search text |
| `/prospect:open <id> [tab]` | Lead details, reports, history; update status and notes |
| `/prospect:regenerate <id> <change>` | Change, regenerate or restore a prototype |
| `/prospect:prototypes [action]` | List, disable, enable, protect, extend, delete, logs, sync |
| `/prospect:library [action]` | Design library: videos/screenshots in `design-library/inbox` — status, scan, list, remove |
| `/prospect:references [action]` | Manage your design reference library (websites + notes) |
| `/prospect:dashboard` | Visual dashboard in your browser |
| `/prospect:help` | How it works and all commands |

## Usage on Claude Pro
Heavy steps run in subagents pinned to Haiku (research, audit, contacts, design) and Sonnet (prototype, QA repair,
email); prototypes are assembled from a tested template instead of written from scratch; scripts do testing and
deployment. Use **Lite** mode on Pro. If you hit a usage limit, nothing is lost — `/prospect:resume <id>` later.

## Privacy & safety
- All research, leads and reports stay on your computer (`leads/`, `prototypes/` in your workspace).
- Only finished prototypes are published, marked noindex, with a visible "Concept preview — not the official website" banner.
- Hooks block: any email/WhatsApp/SMS/DM *sending* tool, reading your secrets file, and deploying around the QA gate.
- Passwords/tokens live in `.prospect/secrets.env`, which you edit yourself; Claude cannot read it.
- No Instagram scraping, logins or cookies. Follow the email laws in your and your prospect's country.

## What's inside
| Path | Purpose |
|---|---|
| `commands/` | Slash commands (workflow orchestration) |
| `agents/` | One subagent per engine |
| `skills/` | Rule books: accuracy, research sources, scoring, prototype content, outreach email |
| `hooks/` | Safety guard (PreToolUse) |
| `dist/server.mjs` | MCP server (`prospect`) — leads, stages, audits, contacts, design, prototypes, email |
| `dist/cli.mjs` | Long jobs — install, build, QA, deploy, drafts, dashboard |
| `templates/` | Prototype template (React + Vite + Tailwind), themes, industry layouts |
| `src/` | Source of `dist/` (bundled with esbuild) |

## License
[MIT](LICENSE) © 2026 NexDev Studios — free to use, modify and redistribute, including commercially, as long as the
copyright notice is kept. Bundled third-party packages and their licenses are listed in
[`dist/THIRD_PARTY_NOTICES.md`](dist/THIRD_PARTY_NOTICES.md).

You are responsible for how you use it: research only permitted public sources, respect each platform's terms, and
follow the email and privacy laws that apply to you and the businesses you contact.

## Contributing
Issues and pull requests are welcome. Edit code in `src/` and `templates/`, then from the repository root run
`npm install`, `npm run build` (regenerates `dist/` — commit it) and `npm test`. Never commit secrets or real lead data.
