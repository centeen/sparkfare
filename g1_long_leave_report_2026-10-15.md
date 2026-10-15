# G1 Long Leave: status report (Addendum B, report-only)

Prepared 2026-10-15. **Report only: no flag was changed.** The owner decides.

## Findings

| Question | Answer | Evidence |
|---|---|---|
| Is `ENABLE_LONG_LEAVE` on in production? | **Yes.** `"true"` in `wrangler.jsonc` on `main`. | `wrangler.jsonc` line 118 |
| Which PR flipped it, and when? | **#207** "flags: turn on ENABLE_LONG_LEAVE (D-006)", commit `dd1dc346`, merged **2026-10-13 14:03 UTC** by the owner (centeen); Worker version created 14:05:12 UTC. | `git log -S`, `gh pr view 207`, `state_DECISION_LOG.md` line 82 |
| Was it the owner's instruction? | **Yes, per the PR body**: "on the owner's instruction (2026-10-13)", handoff task 3c. | PR #207 |
| Was the lead copy reviewed by the Council first? | **Not shown anywhere in the repo.** The PR re-checked only the USPS wording against usps.com. No record of a Hub review of the exact lead text. | PR #207 body; no review entry in the decision log |
| Is 30+ actually live (observed)? | **Yes.** Loading `https://sparkfare.com/` in a browser, the `trip_length` select ends with option `30_plus` labelled `30+ days`. `GET /api/long-leave` returns `enabled:true` with the three lead items. `long-leave.js` is included on `/`, `/widget`, `/account`, `/leave`, `/away-mode`. | live check 2026-10-15 |

## Why the Oct 14 observation differed

The Addendum said the live homepage selector showed no 30+ option. The option is not in the served HTML: `long-leave.js` adds it
after the page loads, once `/api/long-leave` answers, so a `curl` or a view-source shows nothing and a script-less check reads
as "no 30+ option". In a real browser it is there. This is also why a grep of the homepage HTML for `30_plus` returns nothing.

## Open point for the owner

The flag was switched on the same day D-006 was written, on the owner's own instruction, but D-006 as quoted in the Addendum says
the flip waits for Hub review of the exact lead copy. That copy is now exported in `g1_lead_copy_2026-10-14.md` (already on main from #218). Options:
leave it on and send the copy for review now, or set `ENABLE_LONG_LEAVE` back to `"false"` until the review lands. Rollback is
one line and safe (a stored `30_plus` reads back as a normal trip length; new writes fall back to `2+ weeks`).

## Exposure while it is on

- New events only when on: `leave_started`, `leave_trip_length`, `leave_long_branch_shown`, `leave_completed`.
- One sponsored link, US Global Mail, through `/out/us-global-mail?src=leave_long`.
- No insurance link or partner (step 19 / D-002 intact).
