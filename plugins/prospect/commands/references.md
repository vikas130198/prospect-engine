---
description: Manage the design reference library — list, add websites/screenshots, tag, favourite, remove, scan the folder
argument-hint: "[list [category] | add <url or description> | scan | remove <id> | favourite <id>]"
allowed-tools: mcp__plugin_prospect_prospect, WebFetch, Read, AskUserQuestion
---

Design reference library (`references/<category>/…` in the workspace). Request: `$ARGUMENTS`

- **list [category]**: `manage_reference` action `list` → table: Name · Category · Tags · ⭐ · Images · URL.
- **add**: gather name, category (restaurants, healthcare, real-estate, ecommerce, corporate, education, interior-design,
  hospitality, manufacturing, beauty, fitness, events, other), URL, what they like about it, tags, and screenshot file
  paths if they have any. If a URL is given you may `WebFetch` it once to describe its style (layout, colours,
  typography, navigation, conversion structure) into `style` and `description`. Then `manage_reference` action `add`.
- **scan**: `manage_reference` action `scan` to pick up folders the user created manually.
- **remove <id>** (ask whether to delete files too) / **favourite <id>** (`update` with favourite true) / tag edits.

Remind them: references guide the design direction only — the engine never copies their code, text, images or branding.
