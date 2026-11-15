---
description: Reject a lead (optionally add it to the do-not-contact list)
argument-hint: "<lead-id> [reason]"
allowed-tools: mcp__plugin_prospect_prospect, AskUserQuestion
---

Reject lead from `$ARGUMENTS` (first token = lead id, rest = reason).

1. `decide_lead` with decision `reject`, `user_words` = "/prospect:reject $ARGUMENTS", note = reason.
2. Ask if they also want to add the business to the do-not-contact list (useful if the business declined contact).
   If yes: `suppress_contact` with the Instagram username (and any known email/domain).
3. Confirm in one line. Nothing is deleted; the lead stays in the list as Rejected.
