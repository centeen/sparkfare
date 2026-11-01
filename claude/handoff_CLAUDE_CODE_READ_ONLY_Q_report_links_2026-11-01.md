# Claude Code · read-only question R-Q1 and one small copy PR · 2026-11-01

Paste this to Claude Code. R-Q1 is read-only: no code change, no PR.

## R-Q1 (read-only): links on the Holiday Fare Report page
Decision D-067 item 4: the report page links only to `/check` and `/how-it-works`, with no fare links. Before the Hub tells reporters "The report page has no fare links", confirm what is built.

On `main` at the current commit, with `ENABLE_REPORTS` on:
1. List every link the page `/reports/holiday-2026` renders (header, nav, body, footer, tables, CSV buttons, structured data): the `href`, the link text, and the template or generator file and line that produces it.
2. Does it render any link to a fare, a route page (`/flight/...`, `/data/...`, `/departing/...`), a "Book" or "View fare" link, or any partner or affiliate link? Answer yes or no, with the list.
3. Does it link to `/how-it-works` and `/check`?
4. Do the CSV download links point only to aggregate counts and shares (no fares, no per-route price rows, no booking links)?
5. If the answer to 2 is yes, say what it would take to remove those links, and do not change anything.
Report the answers to the Hub by Tue Nov 3. This does not displace M1, R1, #418, the M2/O2 flips or the route-count fix.

## S-copy (small copy PR; the owner approved the exact line on Sun Nov 1 at 12:36 Israel; the owner's per-PR approval still applies, D-035; Guard read of the PR copy before merge)
Add one sentence to `/disclosure`, in the first paragraph under the heading "Affiliate disclosure", before the sentence that says Sparkfare participates in affiliate programs:

APPROVED WORDING (owner, Nov 1 12:36): "Sparkfare is built and run by Coby Enteen."

- Nothing else on the page changes. The partner list, the 30-day-history statement and the contact line stay as they are.
- The owner has approved this exact wording. Do not change it.
- Acceptance: before and after screenshots; `tests/partners.test.js` still passes; the copy checker passes; the sentence appears once; no other page changes.
- Deadline: before the Nov 4 last merge. Tiny, and it never displaces M1, R1, #418, the M2/O2 flips or the route-count fix.

## S-copy B (small copy PR; owner said yes Sun Nov 1 12:40 Israel to a `/check` link in the report's own text; wording PROPOSED, the Guard decides; owner's per-PR approval, D-035)
Add one sentence with one link to the Holiday Fare Report page body, next to the existing `/how-it-works` method link (around lines 390 to 399), not in the hero and not in a pop-up:

PROPOSED: "Have a fare in mind? Check it against its route's own price history with Sparkfare's free price checker."
Link target: `/check`, on the words "price checker". Plain internal link.

- No UTM or tracking parameters on this internal link (they would overwrite a visitor's first-touch source, see S1).
- Not a fare link: `/check` shows a verdict, not a partner link. Do not add any other link.
- The sentence is gated by the same flag as the page (`ENABLE_REPORTS`); nothing changes while the flag is off.
- Acceptance: before and after screenshots with the flag on in staging; the page still has no fare, route or partner link (re-run the R-Q1 scan); the copy checker passes; the sentence appears once; the `/how-it-works` links are unchanged.
- Order of work: after M1, R1, #418, the M2/O2 flips and the route-count fix; before the Nov 4 last merge only if it fits. If it does not fit, skip it. The report works without it (the nav already links `/check`).

## S-copy C (small code change; flag default off per D-065; owner's per-PR approval, D-035): make the CC BY licence switchable
Why: Claude Code's structured-data answer (Nov 1 12:41) plus a repo read show the CC BY 4.0 licence is built into the report in four places: the JSON-LD `license` field, the visible line "Reuse under CC BY 4.0. Attribution: Sparkfare..." (twice on the page), in both `scripts/generate-holiday-report.mjs` (lines ~304, 409, 501) and `src/holidayReport.js` (lines ~73, 94, 405), and two tests assert it (`tests/m5_holiday_report.test.js:117`, `tests/m5m6_copy_fixes.test.js:131`). The rule (Guard, M5 consult): the CC BY line goes live only with Travelpayouts' written yes. The fallback if there is no yes by Tue Nov 10 is to publish Nov 11 without it. As built, that fallback means editing code after the Nov 6 freeze.
Ask:
- One constant or flag, `ENABLE_REPORT_CC_BY`, default **off**, that controls all four places together: the JSON-LD `license` property, and both visible "Reuse under CC BY 4.0" lines (when off, keep a plain credit line: "Source: Sparkfare (sparkfare.com), as of {date}."; no licence name, no licence URL).
- One place to change it (the same place as `ENABLE_REPORTS`), so the owner can flip it with the report flag without a code change.
- Update the two tests to assert both states.
- Acceptance: flag off, none of `creativecommons`, `CC BY` or `license` appears in the page or its JSON-LD; flag on, the current text appears exactly as today; the CSVs are unchanged either way; tests pass; before and after on the generated HTML.
- Order of work: after M1, R1, #418, the M2/O2 flips and the route-count fix. It must land before the Nov 4 last merge or it waits until after the Nov 6 to Nov 8 freeze. Small, and nothing else depends on it.
