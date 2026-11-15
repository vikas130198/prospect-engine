---
description: Approve a researched lead ("Proceed & Continue") and run the rest of the workflow
argument-hint: "<lead-id> [note]"
allowed-tools: Skill, mcp__plugin_prospect_prospect, Bash(node:*), Task, Agent, WebSearch, WebFetch, Read, Edit, Write, Glob, AskUserQuestion, ToolSearch
---

The user ran `/prospect:approve $ARGUMENTS` — this is their explicit "Proceed & Continue" decision.

1. First token = lead id (if missing, `list_leads` with status "Awaiting Approval" and ask which one).
2. `decide_lead` with decision `approve`, `user_words` = "/prospect:approve $ARGUMENTS", and any note.
   If research is not complete, explain and stop.
3. Load the `prospect:workflow` skill and continue from the next stage.
