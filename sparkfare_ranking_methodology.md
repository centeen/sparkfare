# Sparkfare — Deal Ranking Methodology

Workplan Step 98. This document exists so the "X% below average" figure shown on every deal
card has a stated, defensible basis — the same discipline every benchmarked competitor already
follows (Hopper states an explicit percentile of a defined historical set; Expedia states its
comparison is against an ML-estimated "typical price" computed across a named daily flight
volume). This isn't new logic — it's writing down what
`Phase 1 Deal Ranking Script (Step 9 - with fallback).py` already does, verified against that
file directly, not paraphrased from memory. If the script changes, update this doc to match —
don't let this become the stale copy.

## The core rule

A route is flagged a **deal** when today's cheapest fare is at least a robust threshold below that exact route's own trailing 30-day median price. There is no external market benchmark, no machine-learning prediction, and no comparison against any other route or any other traveler's price. The baseline is entirely Sparkfare's own accumulated observation history for that one origin–destination pair.

## The exact calculation

```
mad = median(|x - median| for x in price_history)
threshold = median - 2 * mad
is_deal = today's_cheapest_price <= threshold
```

- **`baseline`** — the median of that route's cheapest daily fare over the preceding `HISTORY_WINDOW_DAYS = 30` calendar days. (Previously a straight arithmetic mean).
- **`mad`** — the Median Absolute Deviation, a robust measure of pricing volatility.
- **`today's_cheapest_price`** — the lowest price returned by today's fetch for that route.
- The route is keyed by **origin + destination together** (e.g. `JFK:Lisbon, Portugal`). A
  JFK-to-Lisbon average and an ORD-to-Lisbon average are entirely separate baselines — multi-origin
  data is never pooled.
- **Today's own price never influences the average it's compared against.** The script classifies
  against history "as it stood before today" and only appends today's price to the history file
  *after* classification — so the threshold can't quietly get easier or harder to hit based on
  today's own number.

## Guardrails and Minimums

A route needs at least `MIN_HISTORY_POINTS = 10` distinct days of accumulated price history AND a minimum history span of `MIN_HISTORY_SPAN_DAYS = 14` days before it can be classified as a deal (or ruled out as "priced, not a deal"). Below that, it shows as **"Building history"** — visibly de-emphasized on the live site (`.grid-dimmed`) — rather than being scored against a statistically unreliable baseline.

Additionally, prices are aggressively suppressed if they are older than the airline's stated `expires_at` (if provided) or older than `STALENESS_CUTOFF_HOURS = 48` hours when no expiry is given.

## Per-cluster thresholds

Historically, the "how far below average counts as a deal" bar varied by destination cluster (e.g. 25% or 15%), reflecting how volatile that cluster's pricing typically is. By moving to a standard MAD-based threshold (which inherently scales to a route's observed volatility), we enforce a more robust, statistically sound definition of a "Rare Find" across all clusters.

**Cluster 4 is a deliberate exception.** Its destinations are always shown (status `featured`) whenever data exists, regardless of price — they never compete against a threshold and never carry a "deal" badge. This is a curation choice (interesting destinations worth surfacing on their own merits), not a claim about price.

## Stale fallback — what an older badge means

If today's fetch has no usable price for a route (or that route hasn't cleared the 7-day minimum
yet), the display layer may carry forward the most recent day that *did* have a real,
successfully-classified price — tagged `is_stale_fallback: true` with a `last_fresh_date`. This
carried-forward record's `pct_below_avg` reflects that earlier day's calculation, not today's.
**The price-history file itself is never touched by this fallback** — it only ever accumulates
genuinely fresh, real fetch results, so a stretch of fallback days doesn't corrupt the average
once fresh data resumes.

## What this methodology deliberately does not do

Stated plainly, in the same spirit as the rest of Sparkfare's "priced honestly" positioning:

- No external market-wide benchmark (unlike Expedia's ML model over a stated multi-million-flight
  daily volume) — the baseline is only ever this route's own history.
- No prediction of future prices (unlike fare-prediction features some competitors offer).
- No weighting toward recent days — every day in the 30-day window counts equally toward the
  average.
- No cross-route or cross-origin comparison — a route is only ever compared against itself.

## Source of truth

`Phase 1 Deal Ranking Script (Step 9 - with fallback).py`, specifically:
`HISTORY_WINDOW_DAYS`, `MIN_HISTORY_POINTS`, `CLUSTER_THRESHOLDS` (module-level constants), and
the calculation inside `classify_destination()`.

## Changelog
- **2026-09-22 (T1):** Upgraded `MIN_HISTORY_POINTS` to 10. Added `MIN_HISTORY_SPAN_DAYS = 14`. Changed baseline to median and `is_deal` threshold to `median - 2*MAD`. Added strict 48h staleness and `expires_at` checks for honesty.
