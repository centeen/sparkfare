// ROADMAP step 49: the "Is this a good price?" checker. Pure scoring, no I/O, so it is unit-testable
// and the Worker route stays thin.
//
// What the data can honestly answer: each route's history is ONE cheapest cached fare per day for
// origin -> destination. It is not tied to travel dates or an itinerary, so the result compares a
// visitor's price to the median of those daily lows and nothing else. No prediction, no "good
// deal" verdict: just the percentage and the basis it rests on.
import { dealQuality } from './dealQuality.js';

// Same bar as dealQuality / the route pages' thin-page rule (10 points over 14 days).
export const CHECK_MIN_POINTS = 10;
export const CHECK_MIN_SPAN_DAYS = 14;
export const CHECK_MAX_PRICE = 100000;
// A price at least this far above the route's median is called High (the mirror of the 15% deal floor, D-021).
export const VERDICT_HIGH_PCT = 15;

// Parses the price a visitor typed. Returns a positive number (cents allowed) or null.
export function parseCheckPrice(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > CHECK_MAX_PRICE) return null;
  return value;
}

// A non-JFK record is called "delayed" when it is old enough to have come through the 24-hour free-tier delay. Judged from
// the record's own found_at (the time Sparkfare retrieved the data) so the note disappears by itself if the delay is
// set to 0 (ROADMAP step 58). A record with no usable found_at keeps the previous rule.
export const DELAY_NOTICE_HOURS = 20;
export function isDelayedRecord(record, now = new Date()) {
  if (!record || record.origin === 'JFK') return false;
  const t = Date.parse(record.found_at || '');
  if (!Number.isFinite(t)) return true;
  return (now.getTime() - t) / 3600000 >= DELAY_NOTICE_HOURS;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// record: a ranked-deals record (any bucket) with an `observations` array of {date, price}.
// Returns the payload for GET /api/check. `status` is one of: ok, not_enough_history, no_data.
export function computePriceCheck(record, price, now = new Date()) {
  const observations = Array.isArray(record?.observations) ? record.observations : [];
  const dq = dealQuality(observations, { price, found_at: now.toISOString() }, now);

  const base = {
    origin: record?.origin || null,
    destination: record?.display_name || null,
    price,
    n: dq.baselineN,
    span_days: dq.spanDays,
    delayed: isDelayedRecord(record, now),
  };

  if (observations.length === 0) return { ...base, status: 'no_data' };

  if (dq.baselineN < CHECK_MIN_POINTS || dq.spanDays < CHECK_MIN_SPAN_DAYS) {
    return { ...base, status: 'not_enough_history', min_points: CHECK_MIN_POINTS, min_span_days: CHECK_MIN_SPAN_DAYS };
  }

  const prices = observations.map((o) => o.price);
  const median = dq.baseline;
  const pct = ((median - price) / median) * 100;
  const pctRounded = Math.round(Math.abs(pct));
  const direction = pctRounded === 0 ? 'about_equal' : pct > 0 ? 'below' : 'above';

  // K-B4 (D-021, D-027): the verdict word. A Deal is exactly what the board calls a deal (at least 15% below the median AND a rare
  // find, with enough history); High is the mirror image (at least 15% above); everything else is Typical. Describes the price, never
  // predicts, never says "you save".
  const verdict = dq.is_rare_find ? 'deal' : pct <= -VERDICT_HIGH_PCT ? 'high' : 'typical';

  return {
    ...base,
    status: 'ok',
    verdict,
    median: Math.round(median),
    pct_diff: pctRounded,
    pct_diff_exact: round1(Math.abs(pct)),
    direction,
    low: Math.min(...prices),
    high: Math.max(...prices),
    window_start: observations[0].date,
    window_end: observations[observations.length - 1].date,
    cached_price_today: record.price ?? null,
  };
}

// Whether /api/check could put a percentage on this route (the same bar computePriceCheck applies). Used to mark destinations in the
// selector that have no history yet (K-B4, scan C-2).
export function routeHasHistory(record, now = new Date()) {
  const observations = Array.isArray(record?.observations) ? record.observations : [];
  if (observations.length === 0) return false;
  const dq = dealQuality(observations, { price: 1, found_at: now.toISOString() }, now);
  return dq.baselineN >= CHECK_MIN_POINTS && dq.spanDays >= CHECK_MIN_SPAN_DAYS;
}
