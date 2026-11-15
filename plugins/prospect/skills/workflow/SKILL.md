---
name: workflow
description: The Prospect Engine stage-by-stage playbook (research → approval → website investigation → design → prototype → QA → deploy → contacts → email → Drafts) with the approval and safety stop points. Load it whenever a /prospect command runs or continues a lead workflow.
---

# Prospect Engine workflow playbook


Playbook for running a lead through the Prospect Engine stages. The calling command tells you the lead id.

You are the **orchestrator**. Keep your own context small: delegate heavy stages to the plugin's subagents and only
keep their short summaries. Never paste whole reports into chat — give 3–6 line summaries and the report path.

## Before starting
1. `workspace_info` → note `cli` and `config.mode`. If not initialized or problems exist that block the next stage
   (e.g. no hosting for deploy, no email method for drafts), say what is missing and point to `/prospect:setup <step>`.
2. `get_lead` → read `next_stage`. If the lead is rejected, say so and stop.
3. Mark each stage RUNNING with `set_stage` before you start it if the tool for that stage doesn't do it itself.

## Stages (run in order, starting at next_stage; stop at the points marked ⏸)

**research** → Task subagent `instagram-researcher` with the lead id, Instagram URL, notes, and a description of any
screenshots the user shared. Then show the summary and ⏸ **stop**: ask the user to review `research.md` and reply
"proceed" (or run `/prospect:approve <id>`), edit details, or reject.

**approval** ⏸ Never approve on your own. If the user's latest message in this conversation clearly says to proceed,
call `decide_lead` (approve, quoting their words) and continue; otherwise ask and stop.

**website_audit, competitors, scoring** → Task subagent `website-investigator` (tell it the mode's competitor limit:
Lite 3 / Full 5). Show status, score and priority. If priority is **Reject** or status is **E (No Clear
Opportunity)** ⏸ stop and ask whether to continue anyway, reject, or archive.

**design** → Task subagent `design-selector`. Show layout, theme and the section plan in 3–5 lines and continue
(the user can override later with `/prospect:regenerate <id> design …`).

**prototype** → Task subagent `prototype-builder`. It builds but does not test.

**qa** → Task subagent `qa-fixer`. If the result is REQUIRES_MANUAL_REVIEW ⏸ stop, explain what fails in plain words,
and offer `/prospect:regenerate` or manual fixes. Never deploy a failed prototype.

**deploy** → Bash: `node "<cli>" deploy <id>` (timeout 900000). On success show the live URL and expiry date.
On failure explain the error and how to fix it (login expired → `/prospect:setup hosting`; DNS → wait/retry).

**contacts** → Task subagent `contact-researcher`. If no public email is found ⏸ stop and tell the user the other
channels found (phone, contact form, Instagram) — the plugin never messages anyone itself; they can add an email they
know with `/prospect:open <id>` → facts, or finish manually.

**email** → Task subagent `email-writer`. Then show the email to the user (To, Subject, Body) and ⏸ ask:
"Save this to your Drafts? You can also tell me what to change." Apply edits by calling `save_email` again
(with `confirm_warnings: true` only if the user accepted the listed warnings).

**draft** (only after the user said to save it):
- If `config.email.method` is `gmail`: use ToolSearch to find the Gmail connector's **create draft** tool (never any
  send tool — sending is blocked anyway). Create the draft (to, subject, plain-text body). If the connector is missing
  or not authorised, tell the user to connect Gmail at claude.ai → Settings → Connectors, restart Claude Code, then
  `/prospect:resume <id>`. On success call `record_gmail_draft` with the returned draft id (and link if provided).
- If `imap`: Bash `node "<cli>" draft-imap <id>`.

## Finish
Call `final_summary` and show:

```
✅ EMAIL READY IN DRAFTS
Business:   …
Recipient:  …
Subject:    …
Prototype:  … (live until …)
Draft:      saved in Gmail Drafts  →  Open Gmail Drafts: <link>
```
Remind them: review and send it yourself; mark progress later with `/prospect:open <id>` (Contacted, Responded,
Meeting Scheduled, Converted, Lost).

## Errors
Any stage failing: the tool records it. Explain in one or two plain sentences, give the fix, and tell the user they can
run `/prospect:retry <id> <stage>`. Completed stages are never redone unless the user asks. If the usage limit is hit,
nothing is lost — ``/prospect:resume <id>` continues later.
