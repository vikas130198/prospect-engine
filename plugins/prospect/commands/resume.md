---
description: Continue a lead's workflow from its next incomplete stage (runs until an approval point or the end)
argument-hint: "<lead-id>"
allowed-tools: Skill, mcp__plugin_prospect_prospect, Bash(node:*), Task, Agent, WebSearch, WebFetch, Read, Edit, Write, Glob, AskUserQuestion, ToolSearch
---

Continue the Prospect Engine workflow for lead `$ARGUMENTS`. If no lead id was given, call `list_leads` and ask
which one (show business name, status, next stage).

Load the `prospect:workflow` skill and follow it from the lead's next stage.
