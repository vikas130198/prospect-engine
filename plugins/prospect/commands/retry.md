---
description: Re-run one workflow stage for a lead (and continue from there)
argument-hint: "<lead-id> <stage>"
allowed-tools: Skill, mcp__plugin_prospect_prospect, Bash(node:*), Task, Agent, WebSearch, WebFetch, Read, Edit, Write, Glob, AskUserQuestion, ToolSearch
---

Retry from `$ARGUMENTS` (lead id, then stage). Stages: research, website_audit, competitors, scoring, design,
prototype, qa, deploy, contacts, email, draft.

1. If the stage is missing, `get_lead` (sections: stages) and show which stages failed or need review; ask which to retry.
2. Explain briefly what will be redone: this stage and every later stage are reset; earlier stages and all previous
   prototype versions/reports are kept. For `research`, the user will need to approve again.
3. `reset_stage`, then load the `prospect:workflow` skill and continue from that stage.
   - Retrying `qa` after manual edits: go straight to the `qa-fixer` subagent.
   - Retrying `deploy` only: run the CLI deploy.
