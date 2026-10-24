# Final read bundle for the Hub: PR 364, M5 and M6 copy fixes (2026-10-24)

PR: https://github.com/centeen/sparkfare/pull/364 (draft, branch `m/m5m6-copy-fixes`, commit 443aebe2). Nothing is merged or deployed. This answers your Guard read of 2026-10-24 (`claude/guard_read_M5_M6_2026-10-24.md`) and the facts file `docs/handoff/hub_guard_read_asks_answers_2026-10-24.md`. Non-attorney review requested as before.

**Status to keep in mind:** the M6 pages are already public, so any wording you reject is a follow-up copy PR, not a flag. The M5 report is dark (`ENABLE_REPORTS="false"`, every `/reports` path is a 404) and stays so until the owner flips the flag on Nov 11 (fallback Nov 18).

**What the owner decides separately (not asked of you):** merge approval, and the one-line confirmation with Travelpayouts or counsel that licensing the hub aggregates under CC BY 4.0 is within the Sep 23 permission.

## Part A. M6 live copy: exact before and after

### A1. `/how-it-works` (visible text and the matching `FAQPage` JSON-LD, word for word)

**Q1, "How does Sparkfare determine whether a flight is a deal?"** Change in sentence 2 only.
- Before: "To qualify as a deal, a fare must sit at least 15% below its 30-day median and exceed two median absolute deviations in volatility."
- After: "To qualify as a deal, a fare must sit at least 15% below its 30-day median and at least two median absolute deviations below it."
- Why: the code is price at or below median minus 2 MAD.

**Q3, "How fresh are the prices shown on Sparkfare?"** Change in sentence 1 only.
- Before: "Fares are evaluated against a strict 48-hour freshness window from when our daily fetch observed the quote."
- After: "Fares are judged against a 48-hour freshness window, counted from when Sparkfare's scheduled fetch retrieved the price."
- Why: the clock is `found_at`, which the ranking script sets to the fetch time. The API gives no time for when the fare was seen. Emails use a 72-hour window; this answer is about the site.

**Q4, "Can I buy tickets directly on Sparkfare?"**
- Before: "No. Sparkfare does not sell or book travel. When you click a fare link, we send you directly to our booking partners or airlines, where you can view current inventory and complete your purchase."
- After: "No. Sparkfare does not sell or book travel. A fare link takes you, through a short Sparkfare redirect, to a third-party booking site, which handles booking and payment and shows the current price. Sparkfare may earn a commission if you buy there."
- Note: your suggested sentence was "...to a third-party booking site that shows the current price and handles booking and payment". The order was changed only so the phrase "which handles booking and payment" matches the copy checker's allowlist (the checker bans "booking" otherwise). Meaning is the same.

Q2 (no predictions) is unchanged.

**Body copy, four changes**
1. Section 1 intro. Before: "Sparkfare tracks the lowest round-trip economy fare discovered each day for every origin–destination pair." After: "Sparkfare tracks the lowest cached round-trip fare found each day for every origin–destination pair." ("economy" removed, unverified.)
2. Page intro. Before: "...guardrails we apply every single day." After: "...guardrails we apply to every route."
3. Section 4, "No personalized pricing". Before: "Baselines reflect cached daily lows across all searches for that route. We do not track your browsing, cookies, or travel dates to manipulate fares." After: "Baselines are the daily lowest cached fares for that route, the same for every visitor. Sparkfare does not change a fare based on who you are or what you searched."
4. Consumer Notice. Before: "Sparkfare does not sell or book travel. We provide unbiased fare data and redirect you to trusted booking partners and airlines to complete your purchase." After: "Sparkfare does not sell or book travel. We show fares from our flight-data partner and send you, through a short redirect, to a third-party booking site to complete your purchase. Sparkfare may earn a commission if you buy there."

**"Explore Sparkfare Tools" row:** the "Holiday Fare Report" button is removed while the report is dark. It comes back when the flag flips.

### A2. `/check` FAQ (visible text and JSON-LD)

**Q2, "What do the Deal, Typical, and High verdicts mean?"**
- Before: "A Deal means the price is at least 15% below the route's 30-day median and meets our statistical volatility threshold. Typical indicates the fare falls within expected historical fluctuations. High means the price sits 15% or more above the 30-day median."
- After: "A Deal means the price is at least 15% below the route's 30-day median and is at least two median absolute deviations below it. Typical means the price is neither a Deal nor High. High means the price sits 15% or more above the 30-day median."
- Why: confirmed in `src/priceCheck.js`: Deal = rare find (15% below and 2 MAD, with enough history); High = 15% or more above; everything else Typical. The MAD test does apply to a typed price.

**Q3, "Is my check personalized or tied to my search dates?"**
- Before: "No. Sparkfare baselines come from daily lowest round-trip quotes across all searches for the route, not your specific travel dates or itinerary. Nothing you type is sold, and checks run without cookies or personal tracking."
- After: "No. Sparkfare baselines are the daily lowest cached round-trip fares for the route, not your specific travel dates or itinerary. The price you type is not saved to an account or sold, and you do not need to sign in."
- Facts: `/api/check` logs a `check_run` event (origin, destination, status, percentage, source tag), never the typed price, and attaches no user id. That logging is covered by the existing event-logging paragraph on `/privacy`; this answer no longer says "without cookies or personal tracking".

Q1 is unchanged (10 observation days across 14 matches the code; the ledger's 7 days was out of date).

### A3. `/time-off` and `/time-off/<origin>` FAQ (visible text and JSON-LD)

**Q1, "How are long-weekend bridge days calculated?"** Last sentence only.
- Before: "...The optimizer schedules your chosen PTO budget to produce the longest possible trips."
- After: "...The optimizer schedules your chosen PTO budget to get you the most days off."

**Q2, "Which holidays are included by default?"**
- Before: "The planner starts with the seven holidays most commonly granted by private employers, following official Office of Personnel Management rules for observed dates. You can customize your schedule by selecting or unchecking any federal holiday on any airport page."
- After: "The planner starts with seven holidays turned on: New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, the day after Thanksgiving and Christmas. Federal holidays use the observed dates set by the Office of Personnel Management, and the day after Thanksgiving is not a federal holiday. Many employers do not give all of them, so turn on the ones yours does."
- Source of the seven: `COMMON_HOLIDAY_SET` in `src/ptoCalendar.js`.

**Q3, "Can flight prices change for these holiday windows?"** (the question text is unchanged)
- Before: "Yes. Fares shown for long-weekend windows reflect the lowest economy round-trip prices observed in search data and remain subject to airline availability. Sparkfare does not sell or book travel, and prices may change on partner sites."
- After: "The planner shows dates and the days off they give you, not prices. Fares on the linked route pages are cached lows and can change at any time. Sparkfare does not sell or book travel."
- Why: `ENABLE_PTO_FARES` is off in production and the live page shows no fares. Note the answer no longer starts with "Yes" although the question does; flag if you want the question reworded too.

### A4. `llms.txt`
- Before, line 3: "> Sparkfare tracks round-trip flight deals against trailing 30-day median price baselines across 22 US airports. Sparkfare does not sell or book travel."
- After: "> Sparkfare tracks international round-trip fares from 22 US airports and judges each against that route's trailing 30-day median. Sparkfare does not sell or book travel."
- `/check` line. Before: "Compare any round-trip airfare against Sparkfare's 30-day historical median for that route." After: "Compare a round-trip price you were quoted with Sparkfare's 30-day median for each of 880 routes from 22 US airports."
- Removed: the "Holiday Flight Report 2026" line (the URL is a 404 while the flag is off).

### A5. IndexNow privacy sentence (`/privacy`): unchanged, now true
"Search indexing. When we publish or update public pages, we notify search engines via the IndexNow protocol with the changed page URLs; these notifications include only public web addresses and never include personal or user data."
- Until now nothing sent a ping. This PR adds the sender. The allowlist (`src/indexNow.js`) is positive, not an exclusion list: only `/`, `/how-it-works`, `/check`, `/time-off`, `/away-mode`, `/disclosure`, `/privacy`, and anything under `/blog/` and `/data/`. Everything else is not sent: account, trips, watchlists, sign-in, welcome, hub, reward terms, home-card and `/card/*`, plan, passport, `/admin/*`, `/departing/*`, share and deal permalinks, `/og/*`, `/api/*`, the report, and any URL with a query string or fragment.
- Trigger: a GitHub workflow on pushes to `main` that touch public content files; manual runs are dry runs by default. Pushes made by other workflows with the built-in token (the daily page regeneration) do not trigger it, so those pages are not pinged. Payload: the key, the key file location and a list of public URLs, nothing else.

## Part B. M5 report copy (dark): full rendered text, generated from data as of 2026-10-24 01:22 UTC

Everything below except the fixed phrases is computed by `scripts/generate-holiday-report.mjs` at build time, so the numbers will differ on the day it is flipped on.

- Title: "Holiday Fare Report 2026: international fares from 22 US airports | Sparkfare"
- Meta description: "880 international round-trip routes from 22 US airports: 214 with enough history to judge, 25 at or past the deal floor on October 24, 2026, and 69 observed holiday-window departures."
- Kicker: "Sparkfare · Benchmark report" (the "Sparkfare Airfare Index" name is dropped).
- H1: "Holiday Fare Report 2026: international fares from 22 US airports"
- Subtitle: "A snapshot of 880 international round-trip routes from 22 US airports: 385 with a cached price, 214 with enough history to judge, and 69 observed Thanksgiving and year-end departures. As of October 24, 2026 01:22 UTC."
- Source line: "Prices are cached round-trip lows from our flight-data partner, collected by Sparkfare's scheduled fetches. They are not live quotes for your dates."
- Meta bar: "As of: October 24, 2026 01:22 UTC · Period: September 6, 2026 to October 23, 2026"
- Hero metrics:
  1. "25 / At or past the deal floor on October 24, 2026 / 11.7% of 214 routes with enough history sit at least 15% below their 30-day median."
  2. "214 / Routes with enough history to judge / 24.3% of 880 routes have 10 observation days across at least 14 days."
  3. "69 / Holiday departures observed / 26 Thanksgiving departures and 43 year-end departures."
  4. "15 / 22 / Airports with enough history to judge / 7 newer airports have no route that meets the history rule yet, so they show Building history and no deals."
- Table section heading: "Coverage and deal share by US airport"; intro: "Each US airport tracks 40 international destinations. A route can be judged once it has 10 observation days across at least 14 days."; table columns: Hub (Airport), Region, Priced, Enough history, At deal floor, Thanksgiving, Christmas/NY, Median Days.
- Table footnote: "Derived from 880 routes (22 airports × 40 destinations). Airports showing "Building history" have no route that meets the history rule (10 observation days across at least 14 days) yet."
- Departures section (replaces the per-route fare table), heading "Observed holiday-window departures": "Cached round-trip lows currently observed for departures in two windows: Thanksgiving (Nov 20 to 30, 2026) and Christmas / New Year (Dec 18, 2026 to Jan 3, 2027). Counts only; the per-airport split is in the table above and in the CSV." Table: Thanksgiving 26 observed, 1 at the deal floor; Christmas / New Year 43 observed, 2 at the deal floor. Footnote: "A departure counts as at the deal floor when its cached low is at least 15% below that route's 30-day median and the route meets the history rule."
- Method bullets:
  - "Data Source: Cached round-trip lows from our flight-data partner (Travelpayouts), collected by Sparkfare's scheduled fetches. They are not live quotes and not a quote for your dates. We have not confirmed whether the cached price includes taxes and fees, so the report makes no claim about that."
  - "Observation Period: Observations from September 6, 2026 to October 23, 2026 across 880 routes (22 airports × 40 destinations), as of October 24, 2026 01:22 UTC."
  - "Deal floor: A fare is a Deal only when it is at least 15% below its 30-day median, at least two median absolute deviations below that median, and its route has 10 observation days across at least 14 days. Otherwise it is Typical, or Building history when the route is short of that history. This is the same rule as how Sparkfare works." (links to `/how-it-works`)
  - "Holiday windows: Thanksgiving means departures from Nov 20 to Nov 30, 2026. Christmas / New Year means departures from Dec 18, 2026 to Jan 3, 2027."
  - "Coverage: 15 airports (ATL, BOS, DEN, DFW, EWR, IAD, IAH, JFK, LAS, LAX, MIA, ORD, PHX, SEA, SFO) have at least one route that meets the history rule. 7 newer airports (AUS, BWI, CLT, DTW, FLL, MSP, PHL) have none yet; Sparkfare reports this openly rather than inventing baselines."
- Disclaimer box (unchanged from the first build): "Strict Consumer Protections: Sparkfare does not sell or book travel. We make no future price predictions, state no ideal purchase dates, and make no claims regarding whether holiday airfares will rise or fall. Airfares fluctuate dynamically based on airline yield management, seat inventory, and seasonal demand. Observed search lows provide historical context, not a price guarantee." (Your point 4 of the earlier read, the "including mandatory taxes and fees" claim, is not in the page; it was in the request text only.)
- Downloads: "Download Hub Data (CSV)" and "Download Window Counts (CSV)". `Dataset` JSON-LD: name "Sparkfare Holiday Fare Report 2026: international fares from 22 US airports", license CC BY 4.0, temporal coverage computed from the data.

### B1. What changed in the numbers, and why (please check this is acceptable)
The verdict-capable count used to be "10 or more observations". The page said "10 distinct days across at least 14 days". The generator now enforces what the page says. On the Oct 24 data that gives **15 airports and 214 routes**; the Oct 22 request showed 12 airports and 209 routes. The three airports that moved in are DEN, LAS and PHX (3, 2 and 4 routes), which crossed the 14-day span since Oct 22. So "12 / 10" in your earlier read is no longer the split, and the page will show whatever is true the day it is flipped on.

### B2. CSVs
- `holiday-2026.csv` (hub aggregates, unchanged columns): `hub_code, hub_name, region, routes_tracked, priced_routes, verdict_capable_routes, verdict_capable_share_pct, active_deals_count, deal_share_of_capable_pct, thanksgiving_departures_observed, christmas_departures_observed, total_holiday_departures_observed, median_observation_days`. The `US_TOTAL` row's median days is now computed (it was typed as 30).
- `holiday-2026-departures.csv` (the FAIL), now counts only: `hub_code, holiday_window, departures_observed, at_or_past_deal_floor`; 44 rows (22 airports × 2 windows). First rows: `ATL,"Thanksgiving (Nov 20-30, 2026)",1,0` and `ATL,"Christmas/New Year (Dec 18, 2026 - Jan 3, 2027)",3,0`. No fares, dates, routes, destinations or medians. A test fails if any of those columns return.
- Both remain proposed under CC BY 4.0, pending the owner's confirmation with Travelpayouts or counsel.

## Part C. Questions for the Hub (one verdict per item)
1. A1 to A4 (M6 live copy): approved as written, or what to change.
2. The `/time-off` Q3 answer starting without "Yes" while the question reads as yes/no: acceptable, or reword the question?
3. A5 and the IndexNow design: is the positive allowlist and the trigger description sufficient for the existing privacy sentence to stand unchanged?
4. B (M5 report text and B1 numbers): approved for use when the owner flips the flag, given the numbers are regenerated at publish.
5. B2: is the counts-only window CSV within "derived statistics only", and does the hub aggregate CSV need anything before CC BY 4.0?
6. Anything in the body copy of `/how-it-works` you flagged ("every single day", "economy", the tracking sentence, "unbiased", "trusted booking partners and airlines") that you still see in the table above.

## Checks run (for your Audit)
`npm run check:copy` passes (1,025 files). New `tests/m5m6_copy_fixes.test.js` (9 tests) pins the new wording and the allowlist; two deliberate breaks (a private path on the allowlist, the old deal-rule wording) each fail a test. M5 and M6 tests updated. Full suite: 1,530 pass, 5 fail, the same five Windows-only `gate:` tests that fail on `main` without this change. Not verified live: the new workflow has not run, and the dark report has not been served.
