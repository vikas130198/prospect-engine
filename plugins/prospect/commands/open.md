---
description: Open a lead's workspace — overview, reports, prototype, contacts, email, history — and edit it
argument-hint: "<lead-id> [tab: overview|research|audit|competitors|design|prototype|qa|deployment|contacts|email|history]"
allowed-tools: mcp__plugin_prospect_prospect, Bash(node:*), Read, AskUserQuestion
---

Show lead `$ARGUMENTS` (first token = id or search text; second = tab, default overview).
If the id is not exact, `list_leads` with `search` and pick/ask.

Tabs:
- **overview** (default): `get_lead` → business name, client code, Instagram, status, website status, score/priority,
  12-stage progress as a compact stepper (✅ done · 🔄 running · ⏸ needs you · ❌ failed · ○ pending), preview URL,
  best contact, draft status, next step.
- **research / audit / competitors / design / contacts / email**: Read the matching report in the lead folder
  (research.md, audit.md, competitors.md, scoring.md, design-plan.md, contacts.md, email.md) and show it.
- **prototype**: versions, current version, build/QA status, placeholders to fill (`validate_prototype`).
- **qa**: Read `leads/<id>/qa/v<current>/report.md`; offer to show screenshots.
- **deployment**: `node "<cli>" deployments <id>`.
- **history**: `get_lead` sections ["activity"].

Then offer actions in one line: edit details/notes/tags/facts (`update_lead`), set status (Contacted, Responded,
Meeting Scheduled, Converted, Lost via `manual_status`), override priority, archive, `/prospect:resume`,
`/prospect:regenerate`, `/prospect:prototypes`. Apply what the user asks with `update_lead`.
