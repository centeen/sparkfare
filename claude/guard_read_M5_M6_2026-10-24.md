# Guard read: M5 Holiday Fare Report and M6 Answer-engine basics (2026-10-24)

Short consult. Steps run: Frame, Ground, Guard, Audit. Skipped: Convene, Price, Score (copy approval of approved backlog rows G77 and G82, not a new idea). Input: owner's bundle "Guard read bundle for the Hub: M5 and M6 (2026-10-24)" pasted in chat, with the M5 request (Oct 22) and M6 request (Oct 23) verbatim; source files are in the repo at `claude/`, not yet synced to the project.

**Non-attorney guidance; have a licensed attorney review before anything binding is published or signed.**

## Frame
Owner's wording: "Please evaluate and approve" the M5 headline and method copy, the 12/10 hub split, the two CSVs under CC BY 4.0; the M6 Q&A blocks, `llms.txt`, and the IndexNow privacy sentence.
Neutral: Is the M5 and M6 copy accurate to the data and code and inside the referral-copy, no-prediction and data-permission rules, so it can carry the G77 and G82 tests (confirmed signups with source `report`; AI and Bing referral sessions)?

## Ground (AGENT_PRODUCT_REALITY)
- Ledger last verified 2026-10-13 (11 days; stale from Tue Oct 27). No ledger rows exist for M5 or M6 yet.
- M5 report: Built, flag off (owner bundle: `ENABLE_REPORTS="false"`). Live check Oct 24 ~07:45 Israel: `/reports/holiday-2026` returns a client error, consistent with the flag off.
- M6 `/how-it-works`: **Live (observed Oct 24)**, Q&A and method body visible.
- M6 `llms.txt`: **Live (observed Oct 24)**, text matches the request; it lists the report URL, which currently returns an error.
- M6 IndexNow sentence on `/privacy`: **Live (observed Oct 24)**.
- M6 Q&A on `/check` and `/time-off`: **not observed** in the Oct 24 live fetch (no FAQ blocks returned; `/check` still links "How we measure" to `/blog/how-we-rank-deals`). The bundle says they are live. Conflict, reconciliation item 108.
- L04 `/check`: ledger says it needs at least 7 days of history; the M6 answer says 10 observation days across 14. Not verified in code (item 109).
- L06 `/time-off`: ledger says window fares OFF (`ENABLE_PTO_FARES=false` since Oct 11); live page shows dates and bridges, no fares. The M6 answer "Fares shown for long-weekend windows reflect..." describes fares the page may not show (item 110).
- Live `/time-off` default set includes "Day after Thanksgiving", which is not a federal holiday.

Hub arithmetic check on the bundle's table: 12 capable hubs sum to 209 capable routes and 24 deals; priced routes sum to 389 (278 + 111); 24/209 = 11.5%; 209/880 = 23.8%; 25 + 44 = 69. Figures are the owner's, from `reports/holiday-2026.csv` as of Oct 22, not re-run by the Hub.

## Guard (AGENT_LEGAL_COMPLIANCE): verdicts

### M5 Holiday Fare Report (dark; nothing public)
| Item | Verdict | Why |
|---|---|---|
| Headline, kicker, subtitle | CONDITIONAL | "Benchmark of US Airfares" and "880 US round-trip routes" read as domestic US fares; scope is international from US hubs. Subtitle frames a holiday benchmark, but most figures cover all departures and the holiday sample is 69 fares. "Sparkfare Airfare Index" names an index that has no computed index value (low; owner call) |
| Four hero metrics | CONDITIONAL | "24 Active Deals Today" on a dated report goes stale; must read "on Oct 22, 2026" (or the run date). Each metric shows its sample size |
| Method statement | CONDITIONAL | "observed across airline reservation systems and travel search aggregators" overstates the source (the data is cached round-trip lows from the Travelpayouts feed). Deal definition omits the two-MAD test that `/how-it-works` states; the two pages must match. Define the Thanksgiving (Nov 20 to 30) and year-end (Dec 18 to Jan 3) windows on the page |
| Disclaimer | CONDITIONAL | "including mandatory taxes and fees" is unverified (the per-person and fees basis was still open in the K-A6 read, Oct 17). Drop it unless Claude Code confirms it from the data. Keep "Sparkfare does not sell or book travel." If any fare link appears on the page, add the inline commission disclosure |
| 12 / 10 hub split | CONDITIONAL (approve the split) | The split follows the D-021 rule and the table supports it. But the line "each currently has <10 observation days per route" is contradicted by the bundle's own table (BWI, DTW, FLL median 12; CLT, MSP, PHX median 10); those hubs fail the 14-day span, not the 10-day count. State the rule instead. The split must be generated at publish, not hard-coded: hubs added around Oct 10 may cross the 14-day span before Nov 11, so "12 / 10" can change [I] |
| `holiday-2026.csv` (hub aggregates) under CC BY 4.0 | CONDITIONAL | Counts and shares are derived statistics, which E31 (Travelpayouts, Sep 23) allows Sparkfare to publish. E31 does not cover resale; CC BY 4.0 lets anyone reuse commercially. Low risk for counts, but confirm with Travelpayouts (one-line email) or counsel that licensing the aggregates under CC BY is within the permission. Keep `Dataset` JSON-LD license field consistent |
| `holiday-2026-departures.csv` (69 per-route fares with dates) under CC BY 4.0 | **FAIL as written** | Publishes individual observed fares with departure dates and a deal verdict under an open licence. That is closer to the underlying feed than "derived statistics", and E31 does not cover third-party reuse or resale. Fares with dates and a verdict also read as "fly on this date", next to the no-cheapest-day rule. Replace with counts by hub and holiday window (departures observed, how many at or past the deal floor), or drop |

### M6 Answer-engine basics (live; fixes are copy PRs)
| Item | Verdict | Why |
|---|---|---|
| `/how-it-works` Q1 (deal rule) | CONDITIONAL (low) | "exceed two median absolute deviations in volatility" misstates the live formula (price at or below median minus 2 MAD). Say "at least two median absolute deviations below that median" |
| `/how-it-works` Q2 (no predictions) | PASS | |
| `/how-it-works` Q3 (freshness) | CONDITIONAL | "48-hour window from when our daily fetch observed the quote": the decision log (Oct 10) says "Prices as of" is the fetch time, not when the fare was seen. State which clock the 48-hour rule uses (cache observation time or fetch time); if fetch time, do not say the quote was "observed" then |
| `/how-it-works` Q4 (can I buy here) | CONDITIONAL | "we send you directly to our booking partners or airlines": fare links go through Sparkfare's redirect to a third-party booking site via Travelpayouts, not to airlines and not directly. An answer about where fare links go is the place to say Sparkfare may earn a commission (FTC proximate disclosure). "booking partner" is on the copy-checker allowlist |
| `/check` Q1 (baseline) | CONDITIONAL | 10 days across 14 conflicts with ledger L04 (7 days). Confirm the `/check` code; the answer must match it |
| `/check` Q2 (verdicts) | CONDITIONAL | Confirm `/check` really returns "Deal", "Typical" and "High", applies the MAD test to a typed price, and that "High" is exactly 15% or more above the median. Define Typical as what the code does (anything that is neither) rather than "expected historical fluctuations" |
| `/check` Q3 (personalized / privacy) | CONDITIONAL | "across all searches for the route" overstates the source. "checks run without cookies or personal tracking" is an absolute privacy claim: the site logs activity, sets a first-party `ref` cookie for referral arrivals, and records the signup source "price checker" (live `/privacy`). Replace with only what the code proves, for example that the typed price is not saved to an account or sold; if `/check` logs events, `/privacy` must say so |
| `/time-off` Q1 (bridges) | PASS (low note) | "longest possible trips": the live page says "best plan for your PTO budget"; "most days off" is closer |
| `/time-off` Q2 (default holidays) | CONDITIONAL | "seven holidays most commonly granted by private employers" is an unsourced statistic (the live line "the holidays most private employers give" has the same gap). The default set includes Day after Thanksgiving, which is not federal, so "any federal holiday" is wrong. Name the seven, say federal dates follow OPM, and drop the "most commonly granted" claim unless a dated source is cited |
| `/time-off` Q3 (fares change) | CONDITIONAL | If window fares are still off, the answer describes prices the page does not show. "economy" is unverified. Say the planner shows dates, and fares on the linked route pages can change |
| `llms.txt` | CONDITIONAL | (1) It lists `/reports/holiday-2026`, which errors while `ENABLE_REPORTS` is off; remove the line until the flag flips, or build the file from the flag. The same 404 link is in the `/how-it-works` "Explore" row. (2) "tracks round-trip flight deals ... across 22 US airports" and "880 US routes": say international fares from 22 US airports. (3) "Compare any round-trip airfare": `/check` covers 22 origins and 40 destinations |
| IndexNow privacy sentence | PASS, one condition | Accurate if pings carry only canonical public URLs. Confirm pings exclude unlisted or private paths: home-card links ("not searchable" per `/privacy`), share links (J3, M3), `/account`, `/admin`, `/departing`, and any URL with plan or budget parameters |
| `/how-it-works` body copy (not submitted, but live) | CONDITIONAL | "We do not track your browsing, cookies, or travel dates to manipulate fares" can be read as "we do not track you", which `/privacy` contradicts (activity log, `ref` cookie, flight links carry the chosen fare's dates). "unbiased fare data" sits beside paid links. "trusted booking partners and airlines": not airlines. "economy" and "every single day" unverified (daily-fetch lateness and a missed Oct 7 run are on record) |

### Process note
Addendum M section 2: "Copy PRs wait for the Hub's Guard read before they enter a train." M6 (PR #362, per the bundle) merged Oct 23 before this read. Fixes now go out as a copy PR. Reconciliation item 111.

## Suggested wording (owner chooses; facts already in the sources, no new claims)
- **M5 H1:** "Holiday Fare Report 2026: international fares from 22 US airports".
- **M5 subtitle:** "A snapshot of 880 international round-trip routes from 22 US airports: {priced} with a cached price, {capable} with enough history to judge, and {n} observed Thanksgiving and year-end departures. As of {date, zone}." (numbers from the run)
- **M5 source line:** "Prices are cached round-trip lows from our flight-data partner, collected by Sparkfare's scheduled fetches. They are not live quotes for your dates."
- **M5 thin hubs:** "{n} newer hubs have no route that meets the history rule yet (10 observation days across at least 14 days), so they show Building history and no deals."
- **`/how-it-works` Q4:** "No. Sparkfare does not sell or book travel. A fare link takes you, through a short Sparkfare redirect, to a third-party booking site that shows the current price and handles booking and payment. Sparkfare may earn a commission if you buy there."
- **`/time-off` Q2:** "The planner starts with seven holidays turned on: {list}. Federal holidays use OPM's observed dates. Many employers don't give all of them, so turn on the ones yours does."
- **`llms.txt` summary:** "Sparkfare tracks international round-trip fares from 22 US airports and judges each against that route's trailing 30-day median. Sparkfare does not sell or book travel."

## Read-only asks for Claude Code (before the copy PR)
1. `/check`: minimum history rule, verdict labels, whether the MAD test applies to a typed price, what is logged when someone runs a check.
2. The clock the 48-hour freshness rule uses.
3. `ENABLE_PTO_FARES` value on main and live; whether `/time-off` shows any fare.
4. Whether report fares include taxes and fees and are for one adult.
5. IndexNow: the list of paths that trigger a ping and the exclusion list.
6. Why the `/check` and `/time-off` FAQ blocks do not appear on the live pages (deploy, cache or template).

## Audit (AGENT_QUALITY_AUDITOR)
1. Status grounded: PASS — statuses from live fetches Oct 24 and ledger rows L04, L06; owner-reported items labelled as such; status skill file missing (noted).
2. No scope breach: PASS — no persona, price or forecast; Legal flags and returns decisions to the owner.
3. Statistics sourced or labeled: PASS — report figures attributed to the owner's CSV (Oct 22), arithmetic checked; verdicts do not depend on the exact values.
4. Legal-adjacent claims flagged: PASS — every verdict under Legal with the non-attorney label.
5. No fabrication: PASS — suggested wording uses facts from the ledger, live pages, E31 and the bundle only.
6. Assumptions stated: N/A — no projection.
7. Conflicts surfaced: PASS — items 106 to 112.
8. Attribution intact: PASS — Ground, Guard and Audit under their own headings.

STATUS: PASSED
