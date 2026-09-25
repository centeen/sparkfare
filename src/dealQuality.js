// The daily email evaluates freshness differently from the live site: see sendDailyAlerts in index.js.
export const EMAIL_STALENESS_CUTOFF_HOURS = 72;
export const EMAIL_DEAL_QUALITY_OPTIONS = { ignoreExpiry: true, stalenessCutoffHours: EMAIL_STALENESS_CUTOFF_HOURS };

// options.ignoreExpiry: skip the expires_at check (a bookability window ~1h after found_at, always
// past by the time a batch email sends; the email labels every price "as of" instead).
// options.stalenessCutoffHours: overrides the 48h default staleness cutoff.
export function dealQuality(observations = [], current_ticket = {}, now_dt = new Date(), options = {}) {
  const prices = observations.map(obs => obs.price);
  const baselineN = prices.length;
  const reasons = [];

  let spanDays = 0;
  if (baselineN > 0) {
    const firstDate = new Date(observations[0].date);
    const lastDate = new Date(observations[baselineN - 1].date);
    spanDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
  }

  const MIN_HISTORY_POINTS = 10;
  const MIN_HISTORY_SPAN_DAYS = 14;
  const STALENESS_CUTOFF_HOURS = options.stalenessCutoffHours ?? 48;

  if (baselineN < MIN_HISTORY_POINTS) {
    reasons.push(`Insufficient observations (${baselineN} < ${MIN_HISTORY_POINTS})`);
  }
  if (spanDays < MIN_HISTORY_SPAN_DAYS) {
    reasons.push(`History span too short (${spanDays} days < ${MIN_HISTORY_SPAN_DAYS})`);
  }

  let staleness_hours = 0;
  // Fix (2026-09-25): `expires_at` is Travelpayouts' own raw fare-quote TTL -- observed on real
  // production JFK data to be roughly 1 hour after `found_at`, and not populated at all for most
  // other-origin routes from the same shared fetch script. It used to be treated as an
  // unconditional hard exclusion the moment it passed, completely bypassing the far more lenient
  // STALENESS_CUTOFF_HOURS (48h default) grace every other record gets. This function is re-run
  // at actual send time (applyDealQualityFilter(), src/index.js) -- hours after the real
  // ~06:00 UTC fetch, e.g. the ~08:00 UTC daily email send -- so this was silently disqualifying
  // every JFK record on a near-daily basis, and would equally have disqualified them on the live
  // site itself for any visitor browsing more than ~1h after that day's fetch. `expires_at` isn't
  // used to lock a live bookable quote anywhere in this product (booking always redirects to
  // Aviasales' own current price), so it no longer independently disqualifies a record for any
  // caller, site or email -- eligibility is judged uniformly by the same `found_at`/staleness
  // check, with `options.stalenessCutoffHours` letting a caller (the daily email uses 72h,
  // see EMAIL_STALENESS_CUTOFF_HOURS above) widen the window without reintroducing expires_at as
  // a separate gate. `options.ignoreExpiry` is accepted but now a no-op, kept only so existing
  // call sites passing it don't need to change. Mirrors the identical fix in
  // "Phase 1 Deal Ranking Script (Step 9 - with fallback).py"'s deal_quality().
  const found_at = current_ticket.found_at || current_ticket.last_fresh_date;
  if (found_at) {
    const found_dt = new Date(found_at);
    staleness_hours = (now_dt - found_dt) / (1000 * 60 * 60);
    if (staleness_hours > STALENESS_CUTOFF_HOURS) {
      reasons.push(`Price older than ${STALENESS_CUTOFF_HOURS}h (${staleness_hours.toFixed(1)}h)`);
    }
  } else {
    reasons.push(`Missing found_at timestamp for staleness check`);
  }

  const eligible = reasons.length === 0;

  // Median calculation
  let baseline = 0;
  let is_rare_find = false;
  let basis_text = "";
  let pct_below_avg = null;

  if (baselineN > 0) {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    baseline = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const mad_vals = prices.map(p => Math.abs(p - baseline)).sort((a, b) => a - b);
    const mad_mid = Math.floor(mad_vals.length / 2);
    const mad = mad_vals.length % 2 !== 0 ? mad_vals[mad_mid] : (mad_vals[mad_mid - 1] + mad_vals[mad_mid]) / 2;

    const current_price = current_ticket.price || 0;
    
    // The previous Python script calculates pct_below_avg against mean, but we might want median? 
    // Requirement says: "keep the current documented mean as a secondary field until the owner approves switching".
    // We'll calculate mean for pct_below_avg to keep it backward compatible, or just use the baseline (median).
    // Let's use the mean to match the python logic precisely, or use what was already passed in current_ticket.
    
    if (eligible && current_price <= baseline - 2 * mad) {
      is_rare_find = true;
    }
    
    if (baseline > 0 && current_price > 0) {
        const pct_diff = Math.round(((baseline - current_price) / baseline) * 100);
        basis_text = `${pct_diff}% below 30-day median, ${baselineN} observations`;
    }
  }

  return {
    eligible,
    baseline,
    baselineN,
    spanDays,
    staleness_hours,
    reasons,
    is_rare_find,
    basis_text
  };
}
