# Answers to the Hub's six read-only asks (M5 and M6 Guard read, 2026-10-24)

Read-only pass. No code or live copy changed. Sources are the repo at `main` (after pulling on Oct 24) and a few `curl` GETs of public pages. Hub file: `claude/guard_read_M5_M6_2026-10-24.md`.

## 1. `/check`

- **History rule:** `src/priceCheck.js` requires at least 10 observation days (`CHECK_MIN_POINTS = 10`) spanning at least 14 days (`CHECK_MIN_SPAN_DAYS = 14`). Fewer returns `not_enough_history`. The ledger's "7 days" (L04) is out of date. The M6 answer ("10 observation days across 14") matches the code.
- **Verdict labels:** `deal`, `high`, `typical` (shown as Deal, High, Typical). Logic: `deal` when `dealQuality(...).is_rare_find` is true; otherwise `high` when the typed price is 15% or more above the median (`VERDICT_HIGH_PCT = 15`); otherwise `typical`. So Typical means "neither", exactly as the Hub suggested defining it.
- **MAD test on a typed price:** yes. `is_rare_find` in `src/dealQuality.js` (line ~100) needs price at or below median minus 2 MAD **and** at least 15% below the median. The typed price is passed in as the current price.
- **Baseline source:** each route's history is one cheapest cached fare per day for that origin and destination (comment at the top of `priceCheck.js`). It is not "all searches", and it is not tied to travel dates.
- **What is logged:** `GET /api/check` logs a `check_run` event with origin, destination, source tag and meta `{status, pct, direction}`. **The typed price is not logged**, and no user id or email is attached. Sharing logs `check_share`; signup from the page logs `check_signup`. This is first-party event logging, so "without cookies or personal tracking" is not a claim the code supports on its own. The privacy page's existing event-logging paragraph covers it; the Q3 answer should say only what is true (price not saved or sold, no account needed).

## 2. The 48-hour freshness clock

`dealQuality()` measures staleness from `found_at` (falling back to `last_fresh_date`). In the ranking script `found_at` is set to `feed_fetched_at`, the time Sparkfare's scheduled fetch ran, not the time Travelpayouts last saw the fare (the API gives no such time). Example from the checked-in file: `found_at: 2026-10-23T08:29:26Z`. So the accurate wording is "48 hours from when Sparkfare's fetch retrieved the price", not "when the quote was observed". Emails use a wider 72-hour window (`EMAIL_STALENESS_CUTOFF_HOURS`); the site and `/check` use 48.

## 3. `/time-off` fares

`ENABLE_PTO_FARES` is `"false"` in `wrangler.jsonc` on main, and live `/time-off/jfk` shows "Fares appear here as we see them" in every window (8 occurrences) and no prices. So the page shows dates and bridges only. The M6 Q3 answer describes fares the page does not show.

## 4. Report fares: taxes and travelers

The fetch script calls Travelpayouts `/v1/prices/cheap` with only origin, destination and currency (USD); it sets no passenger count and the API response is the cheapest cached fare. The only place a traveler count appears is the booking link builder (`adults=1`), which is the link, not the stored price. Nothing in the repo shows whether the cached price includes taxes and fees, and nothing records a per-person basis. **So "including mandatory taxes and fees" cannot be confirmed from the data and should be removed**, as the Hub advised. Safe wording: "cached round-trip lows from our flight-data partner; not a quote for your dates". Asking Travelpayouts what the `/v1/prices/cheap` price includes would settle it.

## 5. IndexNow

`src/indexNow.js` defines `pingIndexNow()`, but **nothing in the Worker, scripts or workflows calls it** (grep of `.js`, `.mjs`, `.py` and `.yml` outside tests, scratch and `node_modules` finds only its own definition). So no ping has ever been sent, and there is no trigger list or exclusion list yet. The privacy sentence describes behavior that does not exist today. Either wire it with an allowlist (for example sitemap pages only: `/data/*`, `/blog/*`, `/flight/*`, `/how-it-works`, `/check`, `/time-off`) before launch, or soften the sentence. The key file `c07b7b13e9a149c5950d24490f058097.txt` is served.

## 6. FAQ blocks on `/check` and `/time-off`

They are live. A cache-busted fetch on Oct 24 returned HTTP 200 for `/check` and `/time-off`, each with one `FAQPage` JSON-LD block and four `<details>` elements (`/how-it-works`: one `FAQPage`, five `<details>`). The Hub's fetch most likely returned collapsed or stripped content: the answers sit inside `<details>`, which text extractors often drop. `/reports/holiday-2026` returns 404, as expected while `ENABLE_REPORTS` is off.

## Extra findings while reading

- `llms.txt` is live (200, 834 bytes) and lists the report URL, which is a 404 today (the Hub's point is confirmed).
- No code or copy was changed in this pass.

## Proposed copy PR (needs owner go-ahead)

1. M5: replace `holiday-2026-departures.csv` with counts by hub and holiday window (or drop it); fix the headline, hero metric dates, method and thin-hub wording, remove the taxes-and-fees claim, define the two holiday windows, generate the 12/10 split at publish time.
2. M6: `/how-it-works` Q1, Q3, Q4 and body copy; `/check` Q2 and Q3; `/time-off` Q2 and Q3; `llms.txt` and the "Explore" row without the report link while the flag is off.
3. IndexNow: wire the ping with an allowlist, or reword the privacy sentence.
4. Owner/counsel: confirm CC BY for the hub aggregates with Travelpayouts.
