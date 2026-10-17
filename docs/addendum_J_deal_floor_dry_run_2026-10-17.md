# Addendum J, J0 item 2: deal-floor dry run (D-021) — 2026-10-17

**Read-only.** Nothing was published or changed. The check ran over the checked-in `sparkfare_ranked_deals.json` (generated 2026-10-17 07:46 UTC) and `sparkfare_ranked_deals_other_origins.json` (generated 2026-10-17 06:13 UTC): 920 records, 880 US (22 origins x 40 destinations) and 40 TLV. Re-run any time with `node scripts/deal-floor-dry-run.mjs --markdown` (tests: `tests/deal_floor_dry_run.test.js`). This is one part of the J0 plan report (`docs/addendum_J_plan_2026-10-17.md`, due Monday with the step 97 report); the other J0 items are not in this file.

**The rule being tested (D-021).** A fare is a deal only if it is at least 15% below the median **and** the route has at least 10 distinct observation days, with the median computed over distinct observation days only.

## 1. How the compile step tells a real fetch from a carried-forward day

- **Real fetches write history; carried-forward days do not.** `update_history()` in `Phase 1 Deal Ranking Script (Step 9 - with fallback).py` runs on the fresh feed and appends `{date, price, found_at, expires_at}` to a route's `observations`; `apply_fallback()` runs afterwards and only copies the previous day's *whole record* forward when there was no fresh price. So a carried-forward day never creates an observation.
- **The explicit signal on a record** is `is_stale_fallback: true`. A carried record keeps its **old** `found_at` and has `last_fresh_date` set to the last day it was really fresh (example today: JFK Algarve, `found_at` 2026-10-11, `last_fresh_date` 2026-10-11, flagged stale, in a file generated 2026-10-17). A fresh record has `found_at` within hours of the compile and `last_fresh_date` equal to the compile date.
- **Observations exclude the current price.** The newest observation is the previous real day (fresh example: `found_at` 2026-10-17, last observation 2026-10-16), as the T65 fix requires so today's price never biases its own baseline.

## 2. Proposed definition of a "distinct observation day"

> A distinct observation day is a distinct UTC calendar `date` among a route's `observations`, counted once at its cheapest price. It needs no `found_at`: 1,780 observation entries lack one (written before `found_at` was recorded, or backfilled from the hourly file) and are real fetches all the same. A carried-forward day cannot be counted because it writes no entry. The median for D-021 is taken over those per-day prices.

**Check on today's data:** none of the 421 routes with observations has a repeated date, so distinct days equal the raw observation count everywhere today. The dedupe is still needed in code, because the hourly pipeline can add a second entry for a date and the existing same-day rule keeps only the cheapest.

## 3. Result: US deals before and after

Steps are cumulative (each keeps only what the previous step kept).

| Step | ATL | AUS | BOS | BWI | CLT | DEN | DFW | DTW | EWR | FLL | IAD | IAH | JFK | LAS | LAX | MIA | MSP | ORD | PHL | PHX | SEA | SFO | **US total** | TLV |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Today (`status = deal`) | 0 | 0 | 2 | 0 | 0 | 0 | 3 | 0 | 5 | 0 | 1 | 4 | 5 | 0 | 1 | 3 | 0 | 5 | 0 | 0 | 2 | 1 | **32** | 6 |
| A. At least 15% below the stored median | 0 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 4 | 0 | 0 | 2 | 3 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | 1 | 1 | **19** | 3 |
| B. A, recomputed over distinct days (10 days, 15%) | 0 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 4 | 0 | 0 | 2 | 3 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | 1 | 1 | **19** | 3 |
| C. B, not stale (fallback flag, or last fresh over 3 days) | 0 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 4 | 0 | 0 | 2 | 3 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | 0 | 1 | **18** | 3 |
| D. C, not departing within 48 hours (or already gone) | 0 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 4 | 0 | 0 | 2 | 3 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | 0 | 1 | **18** | 3 |

**32 US deals become 18** (and TLV 6 become 3). What each rule did:
- **The 15% floor removes 13 of the 32.** Their stored gaps to the median run from 0% to 14% (the list: 0, 6, 7, 7, 7, 8, 8, 9, 9, 12, 13, 13 and one more near 15). They are "deals" today because the existing rare-find test (price at or below the median minus 2 median absolute deviations) passes on routes whose prices barely move; one reads 0% below.
- **The distinct-day recompute removes nothing today:** every current deal already has at least 10 distinct days and at least 14 days of span. It still matters as a rule, because the existing count uses the stored list as is.
- **The stale rule removes 1:** SEA to Larnaca is a carried-forward price (flagged stale), so it could not be a deal.
- **The departure rule removes 0 deals today.** It does remove other rows; see section 6.

**Against the hub's estimate:** "about 24 of 35 US deals clear 15%". On these two files the figures are 19 of 32 at the 15% step (the snapshot differs: deal counts move every compile, and the hub's 35 is not 32), so the hub's figure is higher than this snapshot's; the direction (roughly 60% to 70% survive the floor) agrees.

## 4. Origins that lose every deal, and what their hero shows

Eleven of the 22 US origins already have **no** deal today: ATL, AUS, BWI, CLT, DEN, DTW, FLL, LAS, MSP, PHL, PHX. The rule changes the other two cases to zero as well:

| Origin | Deals before | After | Hero then falls to |
|---|---:|---:|---|
| IAD | 1 | 0 | the best featured route (4 featured, 13 priced-not-a-deal) |
| SEA | 2 | 0 | the best featured route (3 featured, 12 priced-not-a-deal) |

So after the rule **13 of 22 US origins have no deal at all** and only nine do (BOS 2, DFW 2, EWR 4, IAH 2, JFK 3, LAX 1, MIA 1, ORD 2, SFO 1). The hero already handles this: `index.html` picks `bestOf(deals) || bestOf(featured) || bestOf(priced) || bestOf(building)` and labels a non-deal with `heroLabel()` ("chosen for the place, not the price", "priced normally today, not a deal", "price history still building, so no deal verdict"). For the origins above that is a featured route (MSP, with no featured or priced route, falls to a "price history still building" route). D-008 is respected: no deal wording appears on thin data.

## 5. A question the rule leaves open: replace or add to the rare-find test?

D-021 states the floor as the deal test. The current code also requires the price to be at or below the median minus 2 median absolute deviations ("rare find"). The tables above **keep** that test (they only remove deals). If D-021 is meant to **replace** it, more routes qualify:

- **Variant E (D-021 replaces the rare-find test, non-featured routes only, with the existing freshness and 14-day span gates): 27 US deals** (BOS 4, DFW 3, EWR 7, IAH 2, JFK 3, LAX 1, MIA 1, ORD 3, SEA 1, SFO 2). That is the 18 above plus 9 routes that are today "priced normally" yet sit 15% or more below a median taken over at least 10 days, for example SEA to Ho Chi Minh City (49%), SFO to Guatemala City (33%), ORD to Krakow (25%), BOS to Guatemala City (22%).
- **Excluded from E by design:** 8 more featured routes (the "chosen for the place" group, which has no verdict by definition) also clear the arithmetic; they stay un-judged.

**This is a product call for the owner:** with "add", 18 US deals; with "replace", 27, and the board would call routes deals that the engine currently calls normal. The 15% line is a visible, easy-to-explain rule, but it can flag routes whose prices are volatile, which is what the rare-find test guards against.

## 6. Side findings that affect J1

- **Past or near departures (A2).** 11 priced US rows depart in the past or inside 48 hours: 7 already gone and 4 within 48 hours (7 priced-not-a-deal, 4 featured). Examples: SFO to Petra (Oct 12), CLT to Cappadocia (Oct 13), SFO to Prague (Oct 14), ATL to Larnaca (Oct 14), SEA to Amalfi (Oct 14), IAH to Bali (Oct 14), BOS to Bogota (Oct 15), LAX to Sofia (Oct 17), ORD to Ho Chi Minh City (Oct 17), CLT to Tbilisi (Oct 17), IAD to Petra (Oct 18). Eight of the 11 are also carried-forward prices; none is a deal.
- **Stale prices (A3).** 58 of 394 priced US rows are carried-forward (flag set); **15** of them have a last fresh date more than 3 calendar days before the file, so under A3 they would show "Last seen" with no fare link; the other 43 are 1 to 3 days old. (A calendar-day comparison is used: Oct 14 is 3 days old on any time of Oct 17.)
- **Two counts that disagree (A5).** For 43 routes `history_points` and the number of distinct observation days differ by one (SEA to Larnaca: `history_points` 9, 10 distinct days, text says "10 observations"; SFO to Petra: 10 against 9). The basis text uses the observation list and matches it in every case today (0 mismatches), so the text is right and `history_points` is the unreliable one. J1 should use the observation list as the only source of the count.
- **No-data rows.** Not counted anywhere above; 8 no-data rows in the JFK file alone.

## 7. What this does not cover

- **Consumers of the same function.** I did not yet trace whether the digest, newsletter, `/check` and route pages call the same eligibility code (J1 item 4 asks J0 to say); that is the next part of the J0 report.
- **Route pages** (`/flight/...`) recompute eligibility per request from the same files, so they would follow whatever rule the shared function adopts.
- **One snapshot.** These files regenerate daily (JFK) and hourly-then-daily (others). Counts will differ tomorrow; the script reruns in seconds.

## 8. Decisions this needs from the owner

1. **Replace or add?** Should the 15% floor replace the rare-find test (27 US deals) or sit on top of it (18)?
2. **Confirm "a distinct observation day"** as defined in section 2, including that entries without a `found_at` count.
3. **Which count is the truth** for the text and `/check`: the observation list (recommended) rather than `history_points`.
