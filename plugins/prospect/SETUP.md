# NexDev Prospect Engine — First-Time Setup

This guide takes you from nothing to your first prospect in about 30 minutes.
You only do this once.

> **What this plugin does:** you give it an Instagram profile URL. Claude researches the business,
> checks its website, builds a personalised website prototype, tests it, publishes it online,
> finds public contact details and saves a personalised email in your **Drafts**.
> **It never sends anything for you** — you review and send every email yourself.

---

## What you need before starting

| Requirement | Why | Where to get it |
|---|---|---|
| **Claude Pro, Max or Team plan** | Runs the AI | claude.ai → Upgrade |
| **Windows 10/11 or macOS** | Your computer | — |
| **Google Chrome** (or Microsoft Edge) | Automated website testing | google.com/chrome |
| **~1 GB free disk space** | Website builder + testing tools (downloaded once) | — |
| **Free Cloudflare or Netlify account** | Hosts your prototypes | Created during setup |
| **Gmail or business email account** | Saves email drafts | — |
| *(Optional)* **Your own domain** | Professional prototype links | Any registrar |

---

## Step 1 — Install the required software

Download and install (accept the defaults):

1. **Node.js 22.13 or newer** — nodejs.org (download the **LTS** version)
2. **Git** — git-scm.com

Python is **not** needed.

Check it worked — open a terminal (**PowerShell** on Windows, **Terminal** on Mac) and run:

```
node -v
git --version
```

Each command should print a version number. `node -v` must show **v22.13** or higher (for example v22.14.0 or v24.x).

---

## Step 2 — Install Claude Code and log in

1. Install Claude Code by following the official guide: **docs.claude.com → Claude Code → Quickstart**.
2. In the terminal run:
   ```
   claude
   ```
3. Choose **"Log in with your Claude account"** and sign in with your Pro/Max account in the browser.
4. Return to the terminal — Claude Code is ready.

---

## Step 3 — Create your workspace folder

This folder will hold all your leads, reports and prototypes.

```
mkdir NexDev-Prospects
cd NexDev-Prospects
claude
```

**Always start Claude Code from this folder when using the plugin.**

---

## Step 4 — Install the plugin

Inside Claude Code, type:

```
/plugin marketplace add vikas130198/prospect-engine
/plugin install prospect@nexdev
```

Restart Claude Code (type `/exit`, then run `claude` again).
Type `/prospect` — you should see the plugin's commands listed.

---

## Step 5 — Choose where your prototypes are hosted

The setup wizard (Step 7) will ask:

```
Where should your prototypes be hosted?
  1) Cloudflare Pages  (Recommended — free, commercial use allowed, high limits)
  2) Netlify           (free, commercial use allowed, limited deploys per month)
```

You can prepare now by creating a free account on the one you prefer.

### Option 1 — Cloudflare Pages (recommended)

1. Create a free account at **dash.cloudflare.com/sign-up** (if you don't have one).
2. During setup, the wizard installs the Cloudflare tool (`wrangler`) for you.
3. A browser window opens → log in → click **Allow**.
4. The wizard creates a project called `<your-agency>-prototypes`.
5. Your prototypes will be available at:
   `https://<your-agency>-prototypes.pages.dev/client/CODE`

### Option 2 — Netlify

1. Create a free account at **app.netlify.com/signup** (if you don't have one).
2. During setup, the wizard installs the Netlify tool (`netlify-cli`).
3. A browser window opens → log in → click **Authorize**.
4. The wizard creates a site called `<your-agency>-prototypes`.
5. Your prototypes will be available at:
   `https://<your-agency>-prototypes.netlify.app/client/CODE`

> **Note:** Netlify's free plan uses monthly credits, and each deployment uses some.
> Active users may run out before the month ends. Check current limits at netlify.com/pricing.

### Optional — Use your own domain (recommended)

Links like `prototype.youragency.com/client/AB7K29X2` look far more professional to clients.

1. The wizard asks for a subdomain, e.g. `prototype.youragency.com`.
2. It shows you **one DNS record** to add wherever your domain is managed
   (GoDaddy, Hostinger, Namecheap, etc.):

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `prototype` | `<your-agency>-prototypes.pages.dev` *(or `.netlify.app`)* |

3. The wizard connects the domain and waits for SSL to activate
   (usually a few minutes, occasionally up to a few hours).

**You do not need to move your domain or change nameservers.** Your main website is not affected.

---

## Step 6 — Connect your email (drafts only)

The plugin **never sends email**. It only saves drafts for you to review and send.

### Option A — Gmail (easiest)

1. Go to **claude.ai → Settings → Connectors**.
2. Find **Gmail** → click **Connect** → sign in and allow access.
3. Restart Claude Code.

### Option B — Business email (Hostinger Mail, Zoho, Outlook, etc.)

Have these ready — the wizard will ask for them in a secure prompt:

- Email address
- Password (or app password)
- IMAP server and port
  *(Hostinger: `imap.hostinger.com`, port `993` · Zoho: `imap.zoho.com`, port `993`)*

---

## Step 7 — Run the setup wizard

Inside Claude Code:

```
/prospect:setup
```

The wizard walks you through each step:

| # | Step | What you do |
|---|---|---|
| 1 | **System check & workspace** | Confirm this folder is your workspace — it checks Node and Chrome/Edge |
| 2 | **Agency profile** | Enter agency name, your name, website, email, phone and email signature |
| 3 | **Hosting choice** | Choose Cloudflare Pages (recommended) or Netlify |
| 4 | **Install components** | Confirm — downloads the website builder, testing tools and hosting tool (~500 MB, 3–10 min, once) |
| 5 | **Hosting login & project** | A browser opens → log in → **Allow**. The wizard creates your prototypes project |
| 6 | **Custom domain** *(optional)* | Add the CNAME record shown, then confirm |
| 7 | **Hosting test** | Nothing — uploads the site, checks the address works and is marked `noindex` |
| 8 | **Email** | Gmail: connect it in claude.ai → Connectors. IMAP: type your password into the private file that opens |
| 9 | **Usage mode** | **Lite** (recommended for Pro) or **Full** (for Max) |
| 10 | **Design library & references** *(optional)* | Drop website design videos/screenshots into `design-library/inbox` (any time) and optionally add favourite websites |

At the end you see a ✅ / ⚠️ / ❌ health table.

> **Passwords and tokens are never typed into the chat.** When one is needed (e.g. your mailbox password for IMAP),
> the wizard opens the private file `.prospect/secrets.env` in Notepad (TextEdit on Mac). You type it there, save and
> close. Claude is blocked from reading that file.

You can run `/prospect:setup` again at any time to change settings.

---

## Step 8 — Check everything works

```
/prospect:doctor
```

Every line should show ✅. Anything ❌ comes with clear fix instructions.

---

## Step 9 — Your first prospect

```
/prospect:new https://instagram.com/somebusiness
```

1. Claude researches the business and shows a **Business Understanding Report**.
2. Review it, correct anything wrong, then type **"proceed"** (or reject it).
3. Claude audits the business's website, scores the lead and picks a design.
4. Claude builds the prototype, tests it on mobile/tablet/desktop and publishes it.
5. Claude finds public contact details and writes a personalised email.
6. You see **EMAIL READY IN DRAFTS** with the prototype link.
7. Open your email, review the draft and **send it yourself**.

---

## Everyday commands

| Command | What it does |
|---|---|
| `/prospect:new <instagram-url>` | Start a new prospect |
| `/prospect:list` | See all leads and their status |
| `/prospect:open <name>` | View one lead's full details |
| `/prospect:resume <name>` | Continue a paused or failed workflow |
| `/prospect:retry <name> <stage>` | Redo one stage |
| `/prospect:prototypes` | List, disable or delete prototypes |
| `/prospect:dashboard` | Open the HTML dashboard in your browser |
| `/prospect:setup` | Change settings |
| `/prospect:doctor` | Check everything works |

---

## Usage limits (Pro users)

- A **Lite** prospect from start to finish uses a good share of your 5-hour usage window.
  Expect roughly **1–3 prospects per window** on Pro (to be confirmed by real measurements).
- If you hit your limit mid-run, **nothing is lost**. Wait for the reset, then run `/prospect:resume`.
- Type `/usage` to see how much you have left.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `/prospect` commands don't appear | Restart Claude Code; run `/plugin` and check the plugin is enabled |
| Browser login for Cloudflare/Netlify didn't open | Run `/prospect:setup` again and choose **Reconnect hosting** |
| Custom domain shows an error | Check the CNAME record is exactly as shown; wait up to a few hours for DNS and SSL |
| "Hosting test failed" | Run `/prospect:doctor` for details; reconnect hosting if your login expired |
| Netlify says credits are used up | Wait for the monthly reset, or switch to Cloudflare Pages in `/prospect:setup` |
| No Gmail draft appears | Reconnect Gmail in claude.ai → Settings → Connectors |
| IMAP draft fails | Check server, port and password; some providers require an **app password** |
| Instagram data is missing | Normal for personal accounts — paste a screenshot of the profile and Claude will read it |
| "Usage limit reached" | Wait for the reset, then `/prospect:resume` |

---

## Privacy & safety

- All leads, research and reports are stored **only on your computer**, in your workspace folder.
- Only the finished prototype websites are published online, and they are marked **noindex**
  so search engines don't list them.
- The plugin **cannot send emails, WhatsApp messages or Instagram DMs** — this is enforced, not optional.
- Contact details are taken only from public sources, each with its source link recorded.
- Use cold outreach responsibly and follow the email laws in your country and your prospect's country.
