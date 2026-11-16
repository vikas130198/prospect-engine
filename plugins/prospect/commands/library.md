---
description: Your design library — website design videos/screenshots in design-library/inbox that every prototype is checked against
argument-hint: "[status | scan | list | show <id> | favourite <id> | remove <id>]"
allowed-tools: Skill, mcp__plugin_prospect_prospect, Bash(node:*), Task, Agent, Read
---

Design library request: `$ARGUMENTS` (empty = status). Load the `prospect:design-library` skill first.
`workspace_info` gives the CLI path and `design_library_inbox`.

- **status** (default): `design_library` status → say how many entries are analysed, new, unsupported (with the fix),
  and the inbox folder path. If anything is new, offer to scan now.
- **scan**: follow skill step 1 (CLI `library-scan`, then the `design-librarian` subagent for entries needing
  analysis). Report each new entry: title — best suited for.
- **list**: `design_library` list → table: Id · Title · Mood · Suits · ⭐ · Used.
- **show <id>**: `design_library` get → summarise the analysis; `Read` its detail frame if the user wants to see it.
- **favourite / unfavourite <id>**, **remove <id>** (ask whether to also delete the video file).

Remind the user: drop videos (MP4/WebM, 20 s – 3 min, desktop size, scroll slowly) or screenshots into the inbox at
any time — the next prototype picks them up automatically. Designs are inspiration only, never copied.
