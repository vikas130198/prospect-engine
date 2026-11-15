---
name: lead-scoring
description: How the Prospect Engine classifies a business's website (statuses A–E) and calculates the transparent 100-point opportunity score with per-factor explanations. Use during website investigation and scoring.
---

# Website status (choose exactly one)

| Code | Status | Use when | Opportunity |
|---|---|---|---|
| A | No Website | No verified official website; relies on Instagram/social/marketplaces | Build a new website |
| B | Poor Website | Outdated design, broken on mobile, slow, missing key info, weak enquiry path, no HTTPS | Redesign |
| C | Average Website | Works, but clear improvement opportunities (conversion, speed, content, SEO) | Targeted redesign / improvements |
| D | Good Website | Professional and functional | Pursue only with a specific, meaningful improvement |
| E | No Clear Opportunity | Strong site, no convincing business case | Recommend rejecting / deprioritising |

Evidence for B/C: the `audit_website` issues list, PageSpeed mobile scores, and what you saw (screenshots via WebFetch
are not available — describe from the HTML audit). Be fair: never call a site poor without concrete findings.

# Opportunity score (100 points)

| Factor key | Max | Score high when… | Score low when… |
|---|---:|---|---|
| `business_activity` | 10 | Posts weekly or more, recent activity, active replies | Last post months ago |
| `audience_visibility` | 10 | Meaningful local following/engagement for its niche | Tiny or unknown reach (unknown ≈ 4–6, explain) |
| `website_opportunity` | 25 | A: 21–25 · B: 16–22 · C: 9–15 | D: 3–8 · E: 0–2 |
| `growth_potential` | 20 | Bookings/orders/enquiries would clearly grow with a site; expandable offer | Saturated or one-off business |
| `contact_availability` | 15 | Public business email found (11–15) | Only DMs (4–8); nothing public (0–3) |
| `business_fit` | 20 | Fits the agency's services and typical budget; legitimate, established | Regulated/risky niche, very large brand with in-house team, unclear legitimacy |

Rules:
- Every factor needs a one-sentence `reason` with the evidence. Unknown data lowers confidence — say so in the reason.
- Priority is computed: 80–100 High · 60–79 Medium · 40–59 Low · < 40 Reject/manual review.
- Scores are prioritisation indicators, not predictions that the business will buy. Say this in the report.
- If the result is **Reject** or status **E**, stop and ask the user whether to continue before design/prototype work.
- Contact availability is scored at this stage from what is visible so far; detailed contact research happens later.

# Report format (`report_markdown`)

```
## Opportunity score: 78 / 100 — Medium priority
| Factor | Score | Why |
|---|---|---|
| Business activity | 8/10 | Posts 3–4×/week, last post 2 days ago |
…
**Confidence:** medium — follower count unknown.
*Scores are prioritisation indicators, not predictions of purchase intent.*
```
