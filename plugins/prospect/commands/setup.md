---
description: First-time setup wizard (re-runnable) — workspace, components, agency profile, hosting, email, usage mode, references
argument-hint: "[step: install | profile | hosting | domain | email | mode | references]"
allowed-tools: mcp__plugin_prospect_prospect, Bash(node:*), Bash(notepad:*), Bash(open:*), Read, AskUserQuestion, ToolSearch
---

You are running the Prospect Engine setup wizard for a possibly non-technical user. Be friendly, short and concrete.
Do one step at a time, confirm each result, and never ask for passwords or tokens in the chat.

If an argument was given (`$ARGUMENTS`), jump to that step. Otherwise run every step, skipping ones already done
(check with `workspace_info` and the doctor output) — but always show what is already configured.

## Step 1 — System check & workspace
- Call `workspace_info`. If not initialized: explain that this folder (`cwd`) will become their workspace, where leads,
  reports and prototypes are stored. Ask to confirm (or ask them to restart Claude Code in another folder), then
  `init_workspace`.
- Run `node "<cli>" doctor --quick` (cli from `workspace_info`). Node must be 22.13+; Chrome or Edge must exist.
  Explain any failure with its fix in plain words and stop if Node is too old.

## Step 2 — Agency profile
Ask (AskUserQuestion or plain questions, all in one message): agency name, their name (sender), role, agency website,
business email they send from, phone (optional), and preferred email signature (offer a default built from the above).
Save with `update_settings` → `{agency:{…}}`.

## Step 3 — Hosting choice
Ask with AskUserQuestion:
- **Cloudflare Pages (Recommended)** — free, commercial use allowed, high limits.
- **Netlify** — free, commercial use allowed, limited deploys per month on the free plan.
Save `update_settings` → `{hosting:{provider:"cloudflare"|"netlify"}}`. Tell them to create a free account now if they
don't have one (dash.cloudflare.com/sign-up or app.netlify.com/signup).

## Step 4 — Install components
Explain it downloads the website builder, testing tools and the hosting tool (~500 MB, 3–10 minutes, one time).
Run `node "<cli>" install` via Bash with timeout 1500000. Report success or the plain-language error.

## Step 5 — Hosting login & project
1. `node "<cli>" host-login` gives the login command. Run that command via Bash (timeout 300000): a browser opens;
   tell the user to log in and click **Allow/Authorize**. If the browser does not open or it times out, ask the user to
   run the same command themselves in a separate terminal, then continue.
2. `node "<cli>" host-status` must show `logged_in: true`. If Cloudflare shows several accounts, ask which one and save
   `update_settings` → `{hosting:{account_id:"…"}}`.
3. Suggest a project name `<agency-name>-prototypes` (lowercase, dashes); let them change it. Run
   `node "<cli>" host-create <name>`. Show the resulting address.

## Step 6 — Custom domain (optional, recommended)
Ask if they want links like `prototype.theiragency.com`. If yes:
1. `node "<cli>" host-domain prototype.theiragency.com`.
2. Show the DNS record as a table (Type CNAME · Name · Value) and, for Cloudflare, the dashboard steps returned.
   Explain: add it where their domain's DNS is managed (GoDaddy, Hostinger, Namecheap…); no nameserver change; the
   main website is not affected.
3. When they say it's done: `node "<cli>" host-test --use-domain`. If not ready, explain DNS/SSL can take minutes to
   a few hours and they can finish later with `/prospect:setup domain`.

## Step 7 — Hosting test
`node "<cli>" host-test` (timeout 600000). Confirm the address works, the noindex header is present and robots.txt
blocks crawlers. If it fails, explain and offer to retry.

## Step 8 — Email drafts
Ask with AskUserQuestion: **Gmail (Recommended, easiest)** or **Business email via IMAP** (Hostinger Mail, Zoho, Outlook…).
- Gmail: tell them to connect it at claude.ai → Settings → Connectors → Gmail → Connect, then restart Claude Code.
  Check with ToolSearch ("gmail draft") whether a Gmail create-draft tool is available now; if yes, offer to create a
  harmless test draft to themselves ("Prospect Engine test draft — you can delete this") with that create-draft tool
  (never a send tool) and ask them to confirm it appears in Drafts.
  Save `update_settings` → `{email:{method:"gmail", from_name, from_address}}`.
- IMAP: ask for the IMAP server, port (usually 993) and username — never the password. Save
  `update_settings` → `{email:{method:"imap", from_name, from_address, imap:{host, port, secure:true, user}}}`.
  Then open the private settings file for them: Windows `notepad "<workspace>\.prospect\secrets.env"`, macOS
  `open -e "<workspace>/.prospect/secrets.env"`. Ask them to fill `IMAP_PASSWORD=` (an app password if their provider
  requires it), save and close, then say "done". Run `node "<cli>" imap-test`.

## Step 9 — Usage mode
Ask: **Lite (Recommended for Pro plans)** — one landing page, 3 competitors, 2 auto-repairs; or **Full (for Max plans)**
— 5 competitors, 3 auto-repairs. Save `update_settings` → `{mode:"lite"|"full"}`. Mention `/usage` shows remaining usage
and that `/prospect:resume` continues after a limit reset with nothing lost.

## Step 10 — Design references (optional)
Explain the `references/<category>/` folders (README inside). Offer: skip for now, or add a few websites they admire
(name, URL, category, what they like) with `manage_reference` action `add`. Screenshots can be dropped into the folders
later and picked up with `/prospect:references scan`.

## Finish
Run `node "<cli>" doctor` and show a ✅/⚠️/❌ table (check · status · detail). Then tell them how to start:
`/prospect:new https://instagram.com/somebusiness`.
Recommended extra: a free **Google PageSpeed Insights API key** — without one, Google's shared quota often runs out and
website audits lose their speed/Core Web Vitals data. Steps: console.cloud.google.com → create a project → "APIs &
Services" → enable "PageSpeed Insights API" → Credentials → Create API key. Then open the private file for them (as in
Step 8) and ask them to paste it after `PAGESPEED_API_KEY=`.
Optional: the official Instagram API (META_ACCESS_TOKEN, META_IG_USER_ID) needs their own Instagram Business account
connected to a Facebook Page and a Meta developer app — research works without it.
