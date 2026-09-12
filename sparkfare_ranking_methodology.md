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

A route is flagged a **deal** when today's cheapest fare is at least a cluster-specific
percentage below that exact route's own trailing 30-day average price — nothing more exotic than
that. There is no external market benchmark, no machine-learning prediction, and no comparison
against any other route or any other traveler's price. The baseline is entirely Sparkfare's own
accumulated observation history for that one origin–destination pair.

## The exact calculation

```
pct_below_avg = (trailing_avg − today's_cheapest_price) / trailing_avg
```

- **`trailing_avg`** — the arithmetic mean (`statistics.mean()`, a straight average, not a
  median and not weighted/decayed toward recent days) of that route's cheapest daily fare over
  the preceding `HISTORY_WINDOW_DAYS = 30` calendar days.
- **`today's_cheapest_price`** — the lowest price returned by today's fetch for that route.
- The route is keyed by **origin + destination together** (e.g. `JFK:Lisbon, Portugal`). A
  JFK-to-Lisbon average and an ORD-to-Lisbon average are entirely separate baselines — multi-origin
  data is never pooled.
- **Today's own price never influences the average it's compared against.** The script classifies
  against history "as it stood before today" and only appends today's price to the history file
  *after* classification — so the threshold can't quietly get easier or harder to hit based on
  today's own number.

## Minimum history requirement

A route needs at least `MIN_HISTORY_POINTS = 7` distinct days of accumulated price history before
it can be classified as a deal (or ruled out as "priced, not a deal"). Below that, it shows as
**"Building history"** — visibly de-emphasized on the live site (`.grid-dimmed`) — rather than
being scored against a statistically unreliable average. A missing day (no fetch result) is
simply skipped, not backfilled with a fake price, since a synthetic zero or repeat value would
corrupt the average.

## Per-cluster thresholds

The "how far below average counts as a deal" bar varies by destination cluster, reflecting how
volatile that cluster's pricing typically is:

| Cluster | Threshold | Rationale |
|---|---|---|
| Cluster 1: Long-Haul Volatility | 25% below average | Long-haul fares swing further on their own, so a smaller dip isn't a meaningfully rare event |
| Cluster 2: Shoulder-Season Cliffs | 15% below average | — |
| Cluster 3: LCC Routing Anomalies | 15% below average | — |
| Cluster 4: Visual Clickbait | *No threshold — see below* | Imagery-driven by design, not deal-driven |

**Cluster 4 is a deliberate exception, not an oversight.** Its destinations are always shown
(status `featured`) whenever data exists, regardless of price — they never compete against a
percentage threshold and never carry a "deal" badge. This is a curation choice (interesting
destinations worth surfacing on their own merits), not a claim about price.

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
