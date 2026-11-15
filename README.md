# NexDev Prospect Engine

Claude Code plugin marketplace containing the **Prospect Engine** plugin — AI-assisted client acquisition for web
design agencies: Instagram profile → research → approval → website audit & score → personalised prototype →
automated QA → deploy → contact research → email saved in Drafts (never sent automatically).

- Plugin: [`plugins/prospect`](plugins/prospect/README.md)
- First-time user guide: [`plugins/prospect/SETUP.md`](plugins/prospect/SETUP.md)

## Install (users)
You need Claude Code with a Pro/Max/Team plan, Node.js 22.13+, Git and Google Chrome.
```
mkdir My-Prospects
cd My-Prospects
claude
```
Inside Claude Code:
```
/plugin marketplace add vikas130198/prospect-engine
/plugin install prospect@nexdev
/prospect:setup
```
Step-by-step guide for first-time users: [SETUP.md](plugins/prospect/SETUP.md).

## How to use

```
/prospect:new https://instagram.com/somebusiness     research a business (paste profile screenshots for better results)
proceed                                              approve → audit, score, design, build, test, publish, find contacts, write email
save it                                              save the email to your Drafts — you send it yourself
```

What you get back (example):
```
✅ EMAIL READY IN DRAFTS
Business:   Harbour Lane Bakery
Recipient:  hello@harbourlanebakery.co.uk
Subject:    A website concept for Harbour Lane Bakery
Prototype:  https://prototype.youragency.com/client/ZKAUN7D5/ (live until 15 Dec)
Draft:      saved in Gmail → Open Gmail Drafts
```

Everyday commands:
```
/prospect:list high                                   high-priority leads
/prospect:open harbour-lane-bakery                    one lead's reports and status
/prospect:regenerate harbour-lane-bakery use a darker theme
/prospect:prototypes extend harbour-lane-bakery 30    keep a prototype live longer
/prospect:resume harbour-lane-bakery                  continue after a usage limit or error
/prospect:dashboard                                   visual overview in your browser
```

More examples, including a full walkthrough and the complete command list: [plugin README](plugins/prospect/README.md#how-to-use).

## Develop
```
npm install          # dev dependencies (MCP SDK, esbuild, imapflow, node-html-parser)
npm run build        # bundle src → plugins/prospect/dist (commit dist/)
npm test             # unit + hook tests
node tests/e2e-local.mjs <workspace>   # full local pipeline (needs a workspace with components installed)
claude --plugin-dir plugins/prospect   # try the plugin without installing it
```

## License
[MIT](LICENSE) © 2026 NexDev Studios. Third-party licenses for bundled code: `plugins/prospect/dist/THIRD_PARTY_NOTICES.md`.
Contributions welcome — see the plugin README.
