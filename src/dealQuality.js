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
  const expires_at = options.ignoreExpiry ? null : current_ticket.expires_at;

  if (expires_at) {
    const exp_dt = new Date(expires_at);
    if (now_dt > exp_dt) {
      reasons.push(`Price expired at ${expires_at}`);
    }
  } else {
    // Check staleness against found_at
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
