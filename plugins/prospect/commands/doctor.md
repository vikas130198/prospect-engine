---
description: Health check — tools, browser, hosting login, prototype address, email drafts, optional APIs, expiring prototypes
allowed-tools: mcp__plugin_prospect_prospect, Bash(node:*)
---

1. `workspace_info`. If not initialized → tell the user to run `/prospect:setup` and stop.
2. Run `node "<cli>" doctor` via Bash (timeout 180000).
3. Show a table: ✅ / ⚠️ / ❌ · Check · Detail. For every ❌ give the exact fix in plain words (from `fix`), e.g. which
   `/prospect:setup <step>` to run. ⚠️ items are optional or informational.
4. End with "All set" or the single most important thing to fix first.
