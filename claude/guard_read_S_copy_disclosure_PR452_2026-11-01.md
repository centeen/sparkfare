# Guard read: PR #452, founder line on `/disclosure` (S-copy) · Sun Nov 1, 2026 ~13:00 Israel

Short consult. Steps run: Frame, Ground (diff read from the repo at branch `pr452`, commit 9643e74, base 4ad02c1), Guard (Hub-run, non-attorney guidance; have a licensed attorney review anything binding), self-check. Skipped: Convene, Price, Score (approved copy under D-067; no new idea; no revenue claim). Not run by a separate Auditor seat.

**Question (neutral):** Does PR #452 add exactly the owner-approved sentence to `/disclosure` without changing anything else, in a way that stays inside D-056, the FTC-style disclosure on that page and the referral-copy rules?
**Recommendation:** Approve for merge, subject to the owner's per-PR approval (D-035). Verdict: **PASS** (non-attorney).

## Ground [E, read from the diff]
- Files changed: `disclosure.html` (1 line) and one new test `tests/s_disclosure_owner_line.test.js`. Nothing else.
- Added text: "Sparkfare is built and run by Coby Enteen." in the owner's exact approved wording, first in the first paragraph under "Affiliate disclosure", directly before "Sparkfare participates in affiliate programs." The commission sentence follows in the same paragraph.
- Partner list, the 30-day-history paragraph, the FTC line and the hello@sparkfare.com contact are unchanged.
- Tests: I ran `tests/s_disclosure_owner_line.test.js` and `tests/partners.test.js` on the PR branch: 6 of 6 pass. `npm run check:copy` and the 375 px screenshots are Claude Code's report; I did not run them. The screenshots are not attached to the PR.

## Guard (AGENT_LEGAL_COMPLIANCE): PASS
| Item | Verdict | Note |
|---|---|---|
| Wording matches the approved line | PASS | Exact match |
| D-056 limits | PASS | Names the founder; no employer, home, family or travel dates |
| Disclosure still prominent | PASS | The commission statement stays in the opening paragraph |
| Referral-copy rules | PASS for the new sentence | Existing page text still says "flight booking links" and "buy a flight"; that is live copy outside this PR, not changed here |
| Name vs account holder | Carried | Public name differs from the legal name on the affiliate accounts [U whether any partner requires a match]. The sentence says who built and runs the site; it does not say who holds the accounts |
| Evidence | Note | Before and after screenshots are an acceptance item and are not attached; for a one-sentence text change the diff is the evidence |

## Reconciliation items
- The public repo (`centeen/sparkfare`, public "deliberately" per CLAUDE.md) contains the owner's personal email addresses in CLAUDE.md and the test notes. Out of scope for this PR. The founder story will make the name searchable, so the owner may want to look. The Hub did not scan the repo for the D-056 items (home, family, travel dates, employer).
- Ledger last verified Oct 13; this read does not update it.

**Owner decision needed:** approve PR #452 for merge before the Nov 4 last merge (D-035)?
