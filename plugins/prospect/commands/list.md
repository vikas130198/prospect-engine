---
description: List leads with status, priority and next step (filters: high, medium, low, failed, ready, or search text)
argument-hint: "[high|medium|low|failed|ready|awaiting|<search>]"
allowed-tools: mcp__plugin_prospect_prospect
---

Show the user's leads. Filter from `$ARGUMENTS`:
- `high` / `medium` / `low` → `list_leads` priority High/Medium/Low
- `awaiting` → status "Awaiting Approval"; `ready` → status "Email Ready"
- `failed` → list all, then keep leads whose next stage has an error (use `get_lead` stages only if needed)
- anything else → `search`

Show a compact table: Business · id · Status · Priority (score) · Website · Prototype link · Draft · Next step.
Below it, one line of suggested actions (e.g. "3 leads await your approval → /prospect:approve <id>").
If there are none, suggest `/prospect:new <instagram-url>`.
