---
description: Open the visual dashboard (metrics, all leads with 12-stage progress, prototypes, failed jobs) in the browser
allowed-tools: mcp__plugin_prospect_prospect, Bash(node:*)
---

Run `node "<cli>" dashboard` (cli from `workspace_info`). It writes `dashboard.html` in the workspace and opens it in
the browser. Then give a 4–6 line text summary from the returned metrics: researched, high/medium/low priority,
prototypes live, emails in Drafts, converted, and anything needing attention (failed jobs, approvals waiting,
prototypes expiring soon) with the command to fix each.
