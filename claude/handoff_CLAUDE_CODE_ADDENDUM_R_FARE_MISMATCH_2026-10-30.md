# Addendum R: cached deals that do not reproduce on Aviasales (D-051, option B)

**For:** Claude Code (or Antigravity IDE; same rules). **From:** the Sparkfare Design Council Hub, Oct 30, 2026.
**Authority:** D-051 (owner, Oct 30 08:49 Israel). Evidence: R-013, R-013a (`claude/evidence_R-013_fare_mismatch_EWR_BUD_2026-10-30.md`, `..._R-013a_swiss_itinerary_2026-10-30.md`). Decision: `claude/decision_staged_D-051_fare_mismatch_option_B_2026-10-30.md`.
**Why:** on Oct 30 the EWR to Budapest card showed $478 "Deal, 28% below 30-day median", dates Dec 14 to Jan 26, Swiss. Aviasales for the same dates, 1 adult, showed $722 cheapest (LOT) and $731 for the Swiss-involved itinerary (Austrian-style out via Vienna, Swiss back via Zurich). The owner reports the same gap on most routes. J1 verified dates, staleness, the deal floor and counts; none of it compares a shown fare with the Aviasales price.
**Lane:** merge train (D-035). Not green-lane: visible text changes. No merges Nov 6 18:00 ET to Nov 8; Nov 5 is fix-only.
**Order:** R0 report, then stop for the owner. R1 after the Guard reads the final strings. R2 after the owner sets a tolerance.
**Deadlines (latest, not earliest):** R0 by Sat Oct 31. R1 merged by Wed Nov 4. R2 merged by Wed Nov 4 or cut: if R2 is not merged and smoke-checked by Nov 4, R1 still ships and R2 waits until Nov 9 or later. Record progress in `docs/handoff/BUILD_STATE.md`.

## Rules (all sections)
1. Read-only until the owner approves a PR. No flag changes, migrations, sends, or production job triggers.
2. Do not call or scrape Aviasales from code. Do not request any affiliate link or `/out` redirect. The live comparison is done by reading pages in a browser, not by you.
3. Referral-copy rules apply to every string; `npm run check:copy` and `npm test` pass before every PR. No "book", "secured", "locked in", "save $", and "live" is never a price claim.
4. Never say a Sparkfare price is bookable at that price. Never remove the one honest naming of Aviasales where a visitor leaves (D-018).
5. No traveler dates in URLs, logs or sub-IDs.
6. If the repo contradicts this addendum, stop and report; do not proceed silently.

## R0 · Read-only report (then stop)
1. **Raw records.** For the EWR to Budapest route and for every current US deal, print: route key, `price`, `airline`, `departure_at`, `return_at`, `found_at`, `expires_at`, `history_points`, the last 5 `price_history` values, `median_baseline`, `basis_text`, `status`, and the exact `booking_link`. Output as a CSV in the report (no secrets). Say which data file and commit it came from.
2. **What the fields mean.** Quote the code or doc lines that set `found_at` and `expires_at`, and say whether `found_at` is the fetch time or the fare's own observation time. Note that the Oct 12 data file shows `expires_at` about one hour after `found_at`; say what sets that and whether any code uses it today.
3. **Every surface that prints a fare, a "Deal", "% below", "$ under" or "Checked N h ago".** File and line, current text, and whether it is generated at build, at request or at send. At minimum: deal cards, hero, route pages, `/check`, the `/departing` interstitial, daily digest, weekly edition, lifecycle emails, social post text and images (daily Bluesky and Mastodon post, OG images), blog destination grids, `/how-it-works`, `/disclosure`, press and report pages. Say which are on `main` but not yet deployed (item 81 history).
4. **Candidate data-only rules** (report only; do not build): for example (a) a drop of 25 percent or more from the previous observation that is not yet corroborated by a second fetch day; (b) the cached fare is not within X percent of the airline's other cached fares for the same dates; (c) `found_at` older than N hours. For each, say how many of today's deals it would suppress. Note that the EWR to Budapest chart shows the low level holding for more than one point, so rule (a) may not catch it; say so if the data shows that.
5. **Does the data hold per-agency or per-airline-combination detail** that could explain a mixed-carrier itinerary labeled with one airline?
6. **What would a live price source need?** Which Travelpayouts endpoints or products return live prices, whether our current terms and the 2.3.5 and 2.2.4 clauses allow showing them, and the quota. Report only; no calls.
Send the report, then stop. The owner sets the tolerance after reading it together with the live-comparison sample (Hub or owner, no marker, no `/out`).

## R1 · Interim honest wording (after the Guard reads the final strings)
One PR per surface group. Strings are PROPOSED; fill the placeholders from data; the copy checker and the Guard decide the final text.

| Surface | Current | Proposed |
|---|---|---|
| Card freshness line | "Checked {n} h ago · {time} {zone}" | "From search data · updated {n} h ago · {time} {zone}" |
| Card note (under the dates row, small) | none | "Price can differ on Aviasales. Bags may cost extra." |
| `/departing` interstitial | "Check this fare on Aviasales" | keep, and add: "Sparkfare shows prices from recent search data, not a quote for your dates. The price on Aviasales may be different." |
| Route pages, hero | as card | same two lines as the card |
| Emails (daily, weekly, lifecycle), footer line next to the existing deal-information line | none | "Prices come from recent search data for one adult, round trip, and can differ on Aviasales." |
| `/how-it-works` and `/disclosure` | existing text | add: "Fares are the lowest round-trip price for one adult that appeared in recent search data. They are not quotes. The price on Aviasales can be higher or lower, and the deal comparison uses our own 30-day history, not the Aviasales price." |
| Social post text | per R0 item 3 | append: "Seen in search data; price can differ on Aviasales." |

**Keep unchanged:** "View fare ↗", the commission disclosure under the button, the "Deal" chip text, the basis line ("{p}% below 30-day median, {n} observations"), zone and 48-hour window (D-030, J1), "Last seen {date}" for rows older than 3 days.
**Acceptance:** no "Checked" wording survives on any surface in R0 item 3; the new strings appear on every surface in that list; copy checker, tests, and the text-node checks pass; screenshots at 375 and 1,440 px for card, hero, route page and interstitial; one sample email and one social post rendered; Guard read of the final strings attached in the approval pack.

## R2 · Tolerance rule (after the owner sets the number)
A deal whose price fails the live comparison loses its "Deal" chip, its "% below" line and its "$ under" line. The card then shows the price, the freshness line and the note, with no verdict. The tolerance (for example, live cheapest no more than a set percent above the cached fare and still below the median) is the owner's choice after the report.
- Implement as data in a config file the owner can edit, default off.
- If no automated live source exists (R0 item 6), R2 applies only through the candidate data-only rules the owner picks, and the PR says plainly that it is a proxy and which sample it was backtested on.
- Report the backtest: of the sampled deals, how many the rule keeps, how many it suppresses, and how many mismatches it misses.
- Guard reads the effect before it goes on. No flag flip without the owner's explicit approval.

## What to send back
R0 report first. Then, per PR: link, head commit, test output, screenshots, the copy-checker output, and for R1 the surface list with "done" against each item. Do not call anything done that was not checked where its acceptance says.

## Do not
- Do not change the deal floor (D-021), the J1 rules or any flag not named here.
- Do not edit live copy outside R1's table.
- Do not post anything to any channel or send a real email.
- Do not add a countdown, scarcity line or "live" price claim anywhere.
