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
4. **Design selection** from 14 industry layouts, 12 themes and your own reference library.
5. **Prototype**: a responsive React + Tailwind landing page written for that business, with working navigation, a
   demo enquiry form and SEO metadata. Unknown details become clearly marked placeholders — the build **refuses**
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

## Commands
`/prospect:setup` · `/prospect:doctor` · `/prospect:new` · `/prospect:approve` · `/prospect:reject` · `/prospect:resume`
· `/prospect:retry` · `/prospect:list` · `/prospect:open` · `/prospect:regenerate` · `/prospect:prototypes`
· `/prospect:references` · `/prospect:dashboard` · `/prospect:help`

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
