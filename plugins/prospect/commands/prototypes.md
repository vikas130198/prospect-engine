---
description: Manage prototypes — list, open, copy link, redeploy, disable/enable, password-protect, extend expiry, delete, logs
argument-hint: "[list | disable <id> | enable <id> | extend <id> <days> | protect <id> on|off | delete <id> | redeploy <id> | logs <id> | sync]"
allowed-tools: mcp__plugin_prospect_prospect, Bash(node:*), Bash(notepad:*), Bash(open:*), AskUserQuestion
---

Prototype management. Use the CLI from `workspace_info` (`node "<cli>" …`). Request: `$ARGUMENTS`

- **list** (default): `list_prototypes` → table: Business · Code · Status (live/disabled/expired/not deployed) ·
  Link · Expires (flag "expiring soon") · Version · QA · 🔒 if protected. Suggest actions for expiring ones.
- **disable <id>** / **enable <id>**: `disable` / `enable`. Disabling takes effect after the upload (seconds to a minute).
- **extend <id> <days>**: `extend` (default 30 days). If it had expired, then also `enable`.
- **protect <id> on|off**: for `on`, the password must be in the private file. Open it for the user (Windows:
  `notepad "<workspace>\.prospect\secrets.env"`, macOS: `open -e …`) and ask them to add
  `PROTOTYPE_PASSWORD_<CODE>=their-password`, save and say done. Then `protect <id> on`. Visitors then need that
  password (any username). Never ask for the password in chat.
- **delete <id>**: confirm first (the link stops working for good and the code is never reused; source files are kept
  unless they also want them removed → `--purge`). Then `delete`.
- **redeploy <id>**: `deploy <id>` (only works if the current version passed QA).
- **logs <id>**: `deployments <id>` → show history (date, version, verified, errors).
- **sync**: `sync` (re-uploads all live prototypes and switches off expired ones).

The preview link is unlisted, not secret — recommend password protection for sensitive prototypes.
