---
description: Start a new prospect from an Instagram profile URL and research the business
argument-hint: "<instagram-url> [notes]"
allowed-tools: Skill, mcp__plugin_prospect_prospect, Bash(node:*), Task, Agent, WebSearch, WebFetch, Read, AskUserQuestion
---

Start a new prospect from: `$ARGUMENTS`

1. `workspace_info`. If not initialized, tell the user to run `/prospect:setup` first and stop.
2. The first token is the Instagram URL (or @username); anything after it is notes. If the user attached or pasted
   screenshots of the profile, describe what they show (bio, followers, posts, contact buttons) — that is valuable,
   verified information.
3. `create_lead` (instagram_url, notes, and industry/location if the user mentioned them). If it is a duplicate or on the
   do-not-contact list, explain and stop (offer `/prospect:open <id>` or `/prospect:resume <id>` for duplicates).
4. Load the `prospect:workflow` skill and run only its **research** stage (Task subagent `instagram-researcher`).
5. Show a short summary: business name, what they do, location, website found or not, opportunity hypothesis, and the
   biggest unknowns. Give the report path (`leads/<id>/research.md`).
6. Ask the user to review it, then reply **"proceed"** (or run `/prospect:approve <id>`) to continue, tell you what to
   correct, or reject it. Do not continue past this point without their explicit go-ahead.

Tip for the user (mention once, briefly): pasting 1–2 screenshots of the profile and recent posts gives much better
research when Instagram data cannot be fetched.
