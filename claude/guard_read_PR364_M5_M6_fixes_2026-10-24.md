# Guard read: PR #364, M5 and M6 copy fixes (2026-10-24)

Second read, answering the owner's "Final read bundle for the Hub: PR 364" (pasted in chat, Oct 24 10:34 Israel). Short consult: Frame, Ground, Guard, Audit. Skipped: Convene, Price, Score (copy fixes to approved rows G77 and G82). First read: `claude/guard_read_M5_M6_2026-10-24.md`.

**Non-attorney guidance; have a licensed attorney review before anything binding is published or signed.**

## Frame
Neutral: does PR #364 meet the conditions of the first read, so the M6 fixes can merge to the live pages and the M5 report can go public when `ENABLE_REPORTS` flips (Nov 11, fallback Nov 18)?

## Ground (AGENT_PRODUCT_REALITY)
- PR #364: draft, 2 commits (443aebe, 4646646), branch `m/m5m6-copy-fixes`, observed on GitHub Oct 24. Cloudflare bot reports a successful build with a branch preview URL.
- Production unchanged: live `llms.txt` at about 10:35 Israel still has the old text and the report line. So the PR is not on production.
- Facts from Claude Code (repo, not observed by the Hub): `/check` uses 10 observation days across 14 and Deal, Typical, High from `src/priceCheck.js`; MAD test applies to a typed price; `check_run` logs origin, destination, status, percentage and source tag, never the typed price or a user id; `ENABLE_PTO_FARES` off in production; freshness clock is `found_at`, set to fetch time; emails use 72 hours. These update ledger L04 (was "7 days") and confirm L06; ledger re-verification due Oct 27.
- First-read ask 6 (why the `/check` and `/time-off` FAQ blocks were not visible live on Oct 24) is not answered in the bundle. Item 108 stays open.
- M5 numbers (generated Oct 24 01:22 UTC, owner bundle): 880 routes, 385 priced, 214 with enough history (24.3%), 25 at or past the deal floor (11.7% of 214), 69 holiday departures (26 + 43), 15 of 22 airports. Hub checked the arithmetic.

## Guard (AGENT_LEGAL_COMPLIANCE)

### M6 (live pages)
| Item | Verdict | Note |
|---|---|---|
| `/how-it-works` Q1 | PASS | |
| `/how-it-works` Q3 | CONDITIONAL (low) | The question says "on Sparkfare"; emails use 72 hours. Scope it: "On the website, fares are judged against a 48-hour freshness window, counted from when Sparkfare's scheduled fetch retrieved the price." Optionally add "Daily emails use a 72-hour window." |
| `/how-it-works` Q4 | PASS | Reordering to match the checker allowlist is fine |
| `/how-it-works` body, four changes | PASS | None of "every single day", "economy", the tracking sentence, "unbiased", "trusted booking partners and airlines" remains in the text supplied. Optional, low: "Final prices and seat availability are verified when you open the booking site" could read "are shown by the booking site" |
| Explore row, report button removed | PASS | Resolves item 112 on merge |
| `/check` Q1 (unchanged) | PASS | Code confirms 10 days across 14 |
| `/check` Q2 | PASS | |
| `/check` Q3 | PASS | Optional, low: name the price check in the `/privacy` event examples, since `check_run` is logged |
| `/time-off` Q1, Q2 | PASS | |
| `/time-off` Q3 | PASS, question change recommended | Reword the question to "Does the planner show flight prices?" in the visible text and JSON-LD, so the answer fits |
| `llms.txt` summary line, report line removed | PASS | |
| `llms.txt` `/check` line | CONDITIONAL | "for each of 880 routes" overstates: only routes with enough history get a comparison (214 on Oct 24). Suggested: "Compare a round-trip price you were quoted with Sparkfare's 30-day median for that route, for routes from 22 US airports to 40 international destinations that have enough history." |
| IndexNow allowlist, trigger, payload; privacy sentence unchanged | PASS | Positive allowlist, no query strings, private paths excluded. The sentence slightly overstates coverage (daily regenerations are not pinged), which is not a privacy risk |

### M5 (dark)
| Item | Verdict | Note |
|---|---|---|
| Title, H1, kicker, subtitle, source line, meta bar, windows, coverage line | PASS | |
| Taxes-and-fees line ("not confirmed ... makes no claim") | PASS | |
| "At or past the deal floor" (hero, departures table, CSV) | CONDITIONAL | The hero defines the 25 as at least 15% below the median; the method says a Deal also needs the two-MAD test. A reader will take "25" as 25 Deals, and the live board may show a different count. Pick one: (a) count with the full Deal rule and call them Deals, or (b) keep the 15% count and add "A Deal badge also needs the second test in the method." Rename hub CSV columns `active_deals_count` and `deal_share_of_capable_pct` to match whichever is chosen |
| Method bullet naming Travelpayouts | CONDITIONAL | The Travelpayouts agreement (R-003, clauses 2.4.1 to 2.4.3) treats use of its marks without permission as a violation, with no carve-out for factual references. Drop "(Travelpayouts)" and keep "our flight-data partner", or ask permission in the same one-line email as the CC BY question. `/privacy` naming it as a data processor is a separate matter |
| Disclaimer heading "Strict Consumer Protections" | CONDITIONAL (low) | Reads as a legal protection on offer. Suggested: "What this report does not do". The yield-management sentence is general explanation, not a prediction; optional to drop |
| B1 rule change (generator now enforces 10 days across 14) | PASS | Page and data now agree; numbers regenerate at publish |
| Window-counts CSV (counts only) | PASS | Within "derived statistics" (E31). The test that blocks fare, date, route and median columns is the right guard |
| Hub aggregates CSV | CONDITIONAL | Add an as-of field (column or dated filename) so a downloaded file carries its date. Show the CC BY 4.0 licence and attribution line beside the download links. CC BY itself still waits on the owner's Travelpayouts or counsel confirmation |

## What this means for merge (owner decides)
- M6: the two small fixes (`llms.txt` `/check` line, Q3 scope) plus the recommended Q3 question can go into this PR. If applied as worded above, no further Guard read is needed for M6.
- M5: resolve the deal-floor naming, the Travelpayouts mention, the disclaimer heading and the CSV as-of before the flag flips. The Hub reads the rendered page with that day's numbers before Nov 11 (or Nov 18).

## Audit (AGENT_QUALITY_AUDITOR)
1. Status grounded: PASS — PR #364 draft observed on GitHub; production `llms.txt` observed unchanged; code facts labelled as Claude Code's.
2. No scope breach: PASS — Legal flags, owner decides; no persona, price or forecast.
3. Statistics sourced or labeled: PASS — M5 figures attributed to the Oct 24 01:22 UTC generation; arithmetic checked; verdicts do not depend on the values.
4. Legal-adjacent claims flagged: PASS — under Legal with the non-attorney label.
5. No fabrication: PASS — suggested wording uses facts from the bundle, R-003 and E31.
6. Assumptions stated: N/A — no projection.
7. Conflicts surfaced: PASS — items 108, 109, 114 to 116.
8. Attribution intact: PASS.

STATUS: PASSED
