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
