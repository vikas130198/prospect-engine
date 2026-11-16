---
description: Change a prototype — regenerate it, redo selected sections, switch design/theme/colours/fonts, edit text, or restore a version
argument-hint: "<lead-id> <what to change>"
allowed-tools: Skill, mcp__plugin_prospect_prospect, Bash(node:*), Task, Agent, Read, Edit, Write, Glob, WebFetch, AskUserQuestion
---

Change the prototype for `$ARGUMENTS` (first token = lead id, rest = the request).

Never overwrite a working version: every change goes into a new version (`new_prototype_version` with a note), so the
user can always go back.

Decide the smallest path:
- **Small edits** (fix text, change a heading, swap colours/fonts, reorder or remove a section, fill placeholders the
  user just told you): `new_prototype_version`, edit `content.json` yourself following the `prospect:prototype-content`
  skill (facts the user states → also save with `update_lead` facts), `validate_prototype`, then build.
- **More/less animation, a different motion feel** ("make it more cinematic", "calmer", "add parallax"): small edit of
  `content.json` → `motion` (see `prospect:motion-design`).
- **"Use the design from my video X"**: update the library first (`prospect:design-library`), then `design-selector`
  with that entry as an override, then `prototype-builder`.
- **Different design / reference / layout**: Task `design-selector` with the user's request (override), then
  `prototype-builder` to create a fresh version.
- **Regenerate whole site or selected sections**: Task `prototype-builder` with clear instructions (which sections).
- **Restore an earlier version**: `restore_prototype_version`, then rebuild if its build is missing.

After building, always run QA (Task `qa-fixer`). If the lead was already deployed, ask whether to deploy the new
version now (`node "<cli>" deploy <id>` keeps the same link and expiry). Summarise what changed and the version number.
