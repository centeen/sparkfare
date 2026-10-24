# Guard read bundle for the Hub: M5 and M6 (2026-10-24)

Everything the Hub asked for, in one file. Source files are in the repo at `claude/` (not yet synced to the project, which is why the Hub could not find them). Repo: github.com/centeen/sparkfare (public). All code merged to `main`; there are no open pull requests.

## Status the Hub should know before reading

- **Decision 3 (capacity swap) is answered.** The owner approved it on 2026-10-21, and all of M0 to M7 are now built and merged (PRs #353, #357 to #362). The "build gate" is closed.
- **M5 is dark.** `ENABLE_REPORTS="false"`; every `/reports` path returns 404 until the owner flips it (planned Nov 11, fallback Nov 18). Nothing in Part A is public yet.
- **M6 is already live in production.** Addendum M said M6 needs no flag, so the `/how-it-works` page, the Q&A blocks and FAQ schema on `/check` and `/time-off`, `llms.txt`, the IndexNow key file and the privacy sentence merged on Oct 23 (PR #362) **before** this Guard read. Part B is therefore a read of copy that is already public. If the Hub finds a problem, the fix is a copy PR, not a flag.
- **Ledger age:** the Hub noted the capability ledger goes stale Tue Oct 27.
- **Owner decisions logged 2026-10-24** (see `state_DECISION_LOG.md`): growth plan decisions 2, 4, 5, 6, 7, 8, 9 answered; entity later; founder name Coby Enteen.

## Extra data the Hub asked for

### M5: per-hub counts behind the 12 / 10 split (as of Oct 22, 2026, from `reports/holiday-2026.csv`)

Verdict-capable = at least 10 distinct observation days spanning at least 14 days (D-021 rule, J1). Deal = at least 15% below the 30-day median and passes the rare-find test. Period of data: Sep 6 to Oct 22, 2026. Generated from the checked-in ranked-deals and history files; the generator is `scripts/generate-holiday-report.mjs` (`npm run generate:report`). The figures in the request text are as of Oct 22; the data files have updated since, so a rerun will move some of them and the page always shows its own as-of line.

| Hub | Region | Routes tracked | Priced | Verdict-capable | Capable share % | Active deals | Median observation days |
|---|---|---|---|---|---|---|---|
| JFK | Northeast | 40 | 31 | 24 | 60.0 | 4 | 31 |
| EWR | Northeast | 40 | 30 | 23 | 57.5 | 3 | 30 |
| LAX | West Coast | 40 | 26 | 19 | 47.5 | 5 | 30 |
| MIA | Southeast | 40 | 25 | 18 | 45.0 | 0 | 30 |
| ORD | Midwest | 40 | 23 | 17 | 42.5 | 1 | 30 |
| SFO | West Coast | 40 | 23 | 17 | 42.5 | 2 | 30 |
| BOS | Northeast | 40 | 19 | 16 | 40.0 | 3 | 28 |
| DFW | South/Central | 40 | 21 | 16 | 40.0 | 1 | 26 |
| IAD | Southeast | 40 | 23 | 16 | 40.0 | 0 | 30 |
| ATL | Southeast | 40 | 19 | 15 | 37.5 | 0 | 24 |
| IAH | South/Central | 40 | 21 | 15 | 37.5 | 4 | 23 |
| SEA | West Coast | 40 | 17 | 13 | 32.5 | 1 | 16 |
| AUS | South/Central | 40 | 11 | 0 | 0.0 | 0 | 7 |
| BWI | Southeast | 40 | 23 | 0 | 0.0 | 0 | 12 |
| CLT | Southeast | 40 | 13 | 0 | 0.0 | 0 | 10 |
| DEN | Mountain | 40 | 11 | 0 | 0.0 | 0 | 6 |
| DTW | Midwest | 40 | 5 | 0 | 0.0 | 0 | 12 |
| FLL | Southeast | 40 | 18 | 0 | 0.0 | 0 | 12 |
| LAS | Mountain | 40 | 5 | 0 | 0.0 | 0 | 8 |
| MSP | Midwest | 40 | 6 | 0 | 0.0 | 0 | 10 |
| PHL | Northeast | 40 | 10 | 0 | 0.0 | 0 | 9 |
| PHX | Mountain | 40 | 9 | 0 | 0.0 | 0 | 10 |
| **US total** | National | **880** | **389** | **209** | **23.8** | **24** | **30** |

12 hubs have at least one verdict-capable route (the table's top 12 rows); the other 10 have none. The CSV also carries holiday-departure counts per hub (see columns below). The M0 report is `docs/handoff/addendum_M_plan_2026-10-21.md` (item 3 covers what the history supports).

### M5: CSV column lists

**`reports/holiday-2026.csv`** (hub benchmark, 23 rows: 22 hubs plus `US_TOTAL`):
`hub_code, hub_name, region, routes_tracked, priced_routes, verdict_capable_routes, verdict_capable_share_pct, active_deals_count, deal_share_of_capable_pct, thanksgiving_departures_observed, christmas_departures_observed, total_holiday_departures_observed, median_observation_days`

**`reports/holiday-2026-departures.csv`** (69 rows):
`origin_code, origin_city, destination, holiday_window, departure_date, return_date, observed_round_trip_usd, median_baseline_usd, diff_from_median_pct, deal_verdict`

Is it derived statistics only? The hub file is purely aggregate counts and shares. **The departures file is per-route, not aggregate:** each row is one route's lowest observed cached round-trip fare for a holiday departure, next to that route's 30-day median and the percentage difference. It is a derived statistic about a route (one number per route, no raw scrape rows, no history series, no airline or flight data), but it does publish individual observed fares, so the Hub should decide whether that is within the Sep 23 Travelpayouts "derived statistics only" permission. If not, the departures file can be dropped or reduced to counts by window and hub. Nothing is public while the flag is off.

### M6: current `/privacy` text the IndexNow sentence sits beside

Live on `privacy.html` (last updated line reads "October 21, 2026", inside the page's "not yet legally reviewed" note). The IndexNow paragraph is at line 128:

> **Search indexing.** When we publish or update public pages, we notify search engines via the IndexNow protocol with the changed page URLs; these notifications include only public web addresses and never include personal or user data.

For the surrounding text, read `privacy.html` in the repo (sections on providers, localStorage, trip tracking, email open tracking, the leave-by plan, and so on).

---

# Part A: M5 Holiday Fare Report request (verbatim)

# M5 Holiday Fare Report: Guard read request (2026-10-22)

For the Hub. Package M5 of Growth Pack, Addendum M (ROADMAP step 144).
Code is implemented and tested behind `ENABLE_REPORTS`, default off (`"false"` in `wrangler.jsonc`).
All routes (`/reports`, `/reports/*`) return 404 until this flag is turned on.

## What is being read

The public Holiday Fare Report 2026 page and its downloadable benchmark CSVs:
1. Web Page: `https://sparkfare.com/reports/holiday-2026` (and `reports/holiday-2026.html`)
2. Hub Benchmark CSV: `https://sparkfare.com/reports/holiday-2026.csv`
3. Departures CSV: `https://sparkfare.com/reports/holiday-2026-departures.csv`
4. Schema.org `Dataset` JSON-LD structured data on `/reports/holiday-2026`.

## Guard Condition 5 Compliance

Guard condition 5 requires:
- Derived statistics only in CSV exports. No raw price scrape rows or internal crawler dumps.
- Strict factual/empirical snapshot format.
- **Zero predictive claims**:
  - No "cheapest day to book"
  - No "best day to buy"
  - No "prices will increase" / "prices will fall"
  - No "book now before prices rise"
  - No "guaranteed savings"
- Non-commercial disclaimer using the exact approved phrase: `"Sparkfare does not sell or book travel."`

## Summary of Findings (Empirical Snapshot as of Oct 22, 2026)

- **Total tracked US routes**: 880 (22 origin hubs × 40 consistent global destinations).
- **Priced routes**: 389 routes currently have cached low observations.
- **Verdict-capable routes**: 209 routes (23.8% of tracked routes) have accumulated ≥10 distinct observation days across a minimum 14-day observation window, establishing a baseline 30-day median.
- **Active deals today**: 24 routes (11.5% of verdict-capable routes) sit ≥15% below their 30-day median.
- **Origin hubs**:
  - **12 verdict-capable hubs**: JFK (24 capable routes), EWR (23), LAX (19), MIA (18), ORD (17), SFO (17), BOS (16), DFW (16), IAD (16), ATL (15), IAH (15), SEA (13).
  - **10 thin hubs in building-history mode**: AUS, BWI, CLT, DEN, DTW, FLL, LAS, MSP, PHL, PHX (each currently has <10 observation days per route; accurately marked as "Building history" with 0 deals declared).
- **Holiday departure windows observed**: 69 total departures:
  - **Thanksgiving window** (Nov 20–30, 2026): 25 observed departures.
  - **Christmas / New Year window** (Dec 18, 2026 – Jan 3, 2027): 44 observed departures.

## Proposed Copy for Hub Review

### 1. Headline & Kicker
> **Kicker:** Sparkfare Airfare Index · Benchmark Report  
> **H1:** Holiday Flight Report 2026: Benchmark of US Airfares  
> **Subtitle:** An empirical snapshot of 880 US round-trip routes across 22 major hubs for Thanksgiving and year-end 2026 departures, benchmarked against 30-day medians of cached round-trip search lows.

### 2. Four Hero Metrics
1. **24 Active Deals Today**: 11.5% of verdict-capable routes sit ≥15% below their 30-day median.
2. **209 Verdict-Capable Routes**: 23.8% of 880 tracked US routes have 10+ distinct observation days.
3. **69 Holiday Departures Observed**: 25 Thanksgiving departures and 44 year-end departures.
4. **12 / 22 Hubs with Verdict History**: 12 hubs have baseline medians; 10 newer hubs remain in building-history mode.

### 3. Methodology & Limitations Statement
> **Data Sources & Observation Window:**
> - Data collected between September 6, 2026 and October 22, 2026 across 880 US round-trip international flight routes.
> - Prices reflect cached round-trip search lows observed across airline reservation systems and travel search aggregators.
> - A route qualifies as verdict-capable when it has accumulated observations across at least 10 distinct calendar days spanning at least 14 days.
> - A route is classified as an active deal when the current observed round-trip low is at least 15% below its 30-day median low.
> - Hubs with insufficient observation days are classified as "Building history" to prevent false deal classifications.
> - Fares are volatile and subject to airline seat availability. This report reflects observed historical and cached search lows; Sparkfare does not predict future airfare movements or promise future savings.

### 4. Non-Commercial Disclaimer
> **Disclaimer:** Sparkfare is an independent flight tracking tool. Sparkfare does not sell or book travel. All fares shown are round-trip in USD including mandatory taxes and fees, as observed in recent search cache entries. Fares change frequently and availability cannot be guaranteed.

## Questions for the Hub

1. Is the empirical headline and methodology copy approved as written?
2. Does the Hub approve the 22-hub breakdown distinguishing verdict-capable hubs (12) from thin hubs (10, marked "Building history")?
3. Are the two CSV formats (`holiday-2026.csv` for Hub-level benchmarks, and `holiday-2026-departures.csv` for the 69 holiday-window departures) approved for public download under CC BY 4.0?

## Technical Implementation Details

- **Script**: `scripts/generate-holiday-report.mjs` (re-runnable via `npm run generate:report`).
- **Worker routing**: Flag-gated behind `ENABLE_REPORTS` (default `"false"` in `wrangler.jsonc`).
- **Brand v1 adherence**: Zero hex color literals, strict brand tokens (`--paper`, `--card`, `--ink`, `--ink-2`, `--line`, `--sage`, `--spark`), shared site header navigation, responsive mobile design, and minimum 13px font-size floor.
- **Automated tests**: 10 tests in `tests/m5_holiday_report.test.js` validating flag gating, headers, CSV structure, Schema.org Dataset, brand tokens, and copy rules.


---

# Part B: M6 Answer-engine basics request (verbatim)

# M6 Answer-engine basics: Guard read request (2026-10-23)

For the Hub. Built on branch `m/m6-answer-engine` (ROADMAP step 146; ADDENDUM_M section 4).
M6 provides answer-engine foundations: a methodology page (`/how-it-works`), question-and-answer blocks with matching JSON-LD schema on `/check`, `/time-off`, and `/how-it-works`, root `llms.txt`, and IndexNow notification integration.

---

## 1. What is being read

Short question-and-answer blocks (two to four sentences each), rendered visibly on three customer-facing surfaces and reflected in `FAQPage` JSON-LD structured data:
1. **Methodology page (`/how-it-works`)**: 4 Q&As explaining the 30-day median, absence of predictions, 48-hour freshness, and consumer booking disclosures.
2. **Price check page (`/check`)**: 3 Q&As explaining comparison baselines, the Deal/Typical/High verdicts, and data privacy.
3. **Time-off planner (`/time-off` and `/time-off/<origin>`)**: 3 Q&As explaining bridge calculation, default federal holidays, and fare volatility.

---

## 2. Draft Copy by Surface

### Surface 1: `/how-it-works`

> **Q: How does Sparkfare determine whether a flight is a deal?**  
> **A:** We compare today's lowest round-trip fare against that exact route's trailing 30-day median price from our observation history. To qualify as a deal, a fare must sit at least 15% below its 30-day median and exceed two median absolute deviations in volatility. We also require at least 10 distinct observation days across a minimum 14-day history span before scoring any route.

> **Q: Does Sparkfare predict future airfare prices?**  
> **A:** No. Sparkfare does not predict future prices, state ideal purchase dates, or claim fares will rise or fall. Every calculation is derived strictly from observed daily search lows for that specific origin and destination pair.

> **Q: How fresh are the prices shown on Sparkfare?**  
> **A:** Fares are evaluated against a strict 48-hour freshness window from when our daily fetch observed the quote. If a price was last seen more than 3 days ago, it is marked as lapsed and cannot carry a deal badge. Outbound flights departing within 48 hours are automatically hidden.

> **Q: Can I buy tickets directly on Sparkfare?**  
> **A:** No. Sparkfare does not sell or book travel. When you click a fare link, we send you directly to our booking partners or airlines, where you can view current inventory and complete your purchase.

---

### Surface 2: `/check`

> **Q: What does the price check compare my price against?**  
> **A:** It compares the number you enter against Sparkfare's trailing 30-day median of the lowest cached round-trip fares for that route. We require at least 10 observation days spanning 14 days before showing a comparison. It does not predict future prices or reflect specific flight numbers.

> **Q: What do the Deal, Typical, and High verdicts mean?**  
> **A:** A Deal means the price is at least 15% below the route's 30-day median and meets our statistical volatility threshold. Typical indicates the fare falls within expected historical fluctuations. High means the price sits 15% or more above the 30-day median.

> **Q: Is my check personalized or tied to my search dates?**  
> **A:** No. Sparkfare baselines come from daily lowest round-trip quotes across all searches for the route, not your specific travel dates or itinerary. Nothing you type is sold, and checks run without cookies or personal tracking.

---

### Surface 3: `/time-off` and `/time-off/<origin>`

> **Q: How are long-weekend bridge days calculated?**  
> **A:** Sparkfare combines official federal holidays with adjacent weekends to identify contiguous days away from work. Any weekday between a weekend and an observed holiday is counted as a paid time off day. The optimizer schedules your chosen PTO budget to produce the longest possible trips.

> **Q: Which holidays are included by default?**  
> **A:** The planner starts with the seven holidays most commonly granted by private employers, following official Office of Personnel Management rules for observed dates. You can customize your schedule by selecting or unchecking any federal holiday on any airport page.

> **Q: Can flight prices change for these holiday windows?**  
> **A:** Yes. Fares shown for long-weekend windows reflect the lowest economy round-trip prices observed in search data and remain subject to airline availability. Sparkfare does not sell or book travel, and prices may change on partner sites.

---

## 3. Rules the copy meets

1. **Sentence length**: Every answer contains between 2 and 4 sentences.
2. **Brand v1 banned-pressure list**: Zero instances of "book now", "instantly", "the moment", countdowns, "only X left", "save $", activity counters, false urgency, or hype.
3. **Guard condition 5 (airfare claims)**: Derived statistics only, zero future predictions, zero claims of "cheapest day to book".
4. **Canonical disclaimer**: `"Sparkfare does not sell or book travel."` is prominently featured across all surfaces.
5. **Structured data fidelity**: Every question and answer in JSON-LD schema (`FAQPage` on `/how-it-works`, `/check`, and `/time-off`; `WebApplication` on `/check`) matches the visible DOM text word-for-word.
6. **Linters and checkers**: `npm run check:copy` passes cleanly across 1,020 repository files; `tests/k_b10_brand_lint.test.js` passes with zero raw hex color literals.

---

## 4. Root `llms.txt`

Created at repo root:
```markdown
# Sparkfare

> Sparkfare tracks round-trip flight deals against trailing 30-day median price baselines across 22 US airports. Sparkfare does not sell or book travel.

## Core Resources

- [How Sparkfare Works](https://sparkfare.com/how-it-works): Deal-scoring methodology, 30-day median baseline calculation, 15% deal floor, and freshness guardrails.
- [Holiday Flight Report 2026](https://sparkfare.com/reports/holiday-2026): Empirical airfare benchmark across 880 US routes, holiday departure windows, and origin coverage statistics.
- [Price Checker](https://sparkfare.com/check): Compare any round-trip airfare against Sparkfare's 30-day historical median for that route.
- [Time-Off and Long Weekend Planner](https://sparkfare.com/time-off): Optimize 2026 and 2027 paid time off around official US federal holidays and weekends.
```

---

## 5. One-Time Step for the Owner: Bing Webmaster Tools & IndexNow

- **IndexNow Key**: `c07b7b13e9a149c5950d24490f058097`
- **Key File URL**: `https://sparkfare.com/c07b7b13e9a149c5950d24490f058097.txt`
- **One-time step for owner**:
  1. Log into Bing Webmaster Tools (`bing.com/webmasters`).
  2. Add `https://sparkfare.com` as a property.
  3. Under verification methods, choose **IndexNow Key File**.
  4. Confirm verification: Bing will fetch `https://sparkfare.com/c07b7b13e9a149c5950d24490f058097.txt` and automatically verify ownership.

---

## 6. Proposed Privacy Policy Update (`privacy.html`)

For owner awareness and approval (can be included in the M6 PR or merged with owner OK):
> *"When we publish or update public pages, we notify search engines via the IndexNow protocol with the changed page URLs; these notifications include only public web addresses and never include personal or user data."*

---

## 7. Questions for the Hub

1. Is the Q&A copy approved as written for `/how-it-works`, `/check`, and `/time-off`?
2. Are the methodology explanations on `/how-it-works` (30-day median, 15% deal floor, 10 observation days, 48h freshness, and 3-day lapse) clear and properly aligned with Hub positioning?
