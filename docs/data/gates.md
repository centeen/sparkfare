# Decision gates registry

One file for every dated gate: what is measured, with which metric, the minimum sample and the rule. Metric ids are from `src/metrics/definitions.js`
(`KPI_CATALOG`); the weekly auto file (`docs/metrics/state_METRICS_auto_*.md`) shows each with its as-of date and sample size. A gate whose rule has not
been written down says so below: nobody should read a number against a rule that is not in the repo.

| Gate | Date | Metric id(s) | Minimum sample | Rule | Source |
|---|---|---|---|---|---|
| G1 | Nov 20, 2026 | not supplied | not supplied | **Rule not supplied.** The owner named this gate in Addendum N; its rule is not in the repo | Addendum N, N11 |
| G2 | Dec 6, 2026 | not supplied | not supplied | **Rule not supplied.** Same | Addendum N, N11 |
| Leave signal (D-004 / D-014) | Dec 11, 2026 | `leave_clicks_per_100_signups`, `signups_by_trip_length`; the Away plan compares partner clicks per 100 plan completions with today's `/away-mode` clicks per 100 views, by bucket | At least 30 plan completions per trip-length bucket | A bucket below the minimum gives "no decision, extend", not a verdict. At or below today's rate after the minimum sample, or one wrong rule in production, is the kill or review line. Clicks alone are allowed as the evidence (D-004) | `claude/away_mode_plan_v1_2026-10-16.md` sections 6 and 7; `claude/data_framework_v1_2026-10-24.md` F12 |
| Month 1 gate (Plus build) | Dec 11, 2026 | none in the metrics layer yet | n/a | Five owner checks: Stripe webhook live with no failed events; at least 1 to 2 Plus signups if the list is over 1,000; Awin pixel firing; code and `partners` table in parity; no bounce spike and suppression working. All 5: continue. 4: continue and watch. 3 or fewer: pause and debug | `ROADMAP.md`, Plus build gates |
| Month 3 gate | Feb 12, 2027 | none in the metrics layer yet | n/a | Five owner checks: Plus adoption at least 0.5% of the email list; at least 5 travel-blogger affiliate signups; white-label pilot with at least 50 users; at least 5% of Plus users create a sitter link; churn under 5% a month. All 5: scale. 4: scale and fix the failing one. 3 or fewer: iterate with one-week tests. Checks 3 and 4 apply only if steps 43 and 63 are built | `ROADMAP.md`, Plus build gates |

Notes
- Two different gates fall on Dec 11: the leave-signal gate (D-004) and the Plus Month 1 gate. They are separate decisions.
- The engaged-subscriber count (opened in the last 45 days) and the data-quality SLO attainment are reported weekly but are not tied to a gate.
- When a gate's rule is supplied, add it here in the same PR that adds any new metric it needs, and add the metric to `KPI_CATALOG` first.
