#!/usr/bin/env node
// Addendum J, J0 item 2 (owner decision D-021; ROADMAP step 106): a READ-ONLY dry run of the proposed deal floor over the checked-in
// ranked-deals files. It changes nothing and publishes nothing: it only prints tables.
//
//   node scripts/deal-floor-dry-run.mjs [--markdown]
//
// D-021: a fare is a deal only if it is at least 15% below the median AND the route has at least 10 distinct observation days, with the
// median computed over distinct observation days only. The steps are applied one at a time so each rule's effect can be seen on its own.
import fs from 'node:fs';

export const FLOOR = { MIN_PCT_BELOW: 0.15, MIN_DISTINCT_DAYS: 10, MIN_SPAN_DAYS: 14, FRESH_HOURS: 48, STALE_DAYS: 3, DEPARTURE_BUFFER_HOURS: 48 };
const BUCKETS = ['deals', 'featured', 'priced_no_deal', 'insufficient_history', 'no_data'];

export const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// One price per distinct calendar date (cheapest wins, as update_history does for a same-day repeat).
export function distinctDays(rec) {
  const byDate = new Map();
  for (const o of rec.observations || []) {
    if (!o || typeof o.date !== 'string' || typeof o.price !== 'number') continue;
    const d = o.date.slice(0, 10);
    byDate.set(d, Math.min(byDate.get(d) ?? Infinity, o.price));
  }
  const dates = [...byDate.keys()].sort();
  const spanDays = dates.length > 1 ? Math.round((Date.parse(dates.at(-1)) - Date.parse(dates[0])) / 86400000) : 0;
  return { n: byDate.size, prices: [...byDate.values()], dates, spanDays };
}

export function evaluate(rec, generatedAt) {
  const gen = Date.parse(generatedAt);
  const dd = distinctDays(rec);
  const med = median(dd.prices);
  const pctBelow = med > 0 ? (med - rec.price) / med : 0;
  const mad = med > 0 ? median(dd.prices.map((p) => Math.abs(p - med))) : 0;
  const foundMs = rec.found_at ? Date.parse(rec.found_at) : NaN;
  const ageHours = Number.isNaN(foundMs) ? null : (gen - foundMs) / 3600000;
  const lastFresh = rec.last_fresh_date ? Date.parse(rec.last_fresh_date + 'T00:00:00Z') : NaN;
  // Calendar days: a price last fresh on Oct 14 is 3 days old on any time of Oct 17, so only Oct 13 or earlier is "more than 3 days".
  const genDay = Date.parse(generatedAt.slice(0, 10) + 'T00:00:00Z');
  const staleDays = Number.isNaN(lastFresh) ? null : (genDay - lastFresh) / 86400000;
  const dep = rec.departure_at ? Date.parse(rec.departure_at) : NaN;
  const departsInHours = Number.isNaN(dep) ? null : (dep - gen) / 3600000;
  return {
    distinct: dd.n, rawObs: (rec.observations || []).length, history: rec.history_points ?? null, span: dd.spanDays,
    median: med, pctBelow, rare: med > 0 && rec.price <= med - 2 * mad,
    ageHours, staleDays, departsInHours,
    stale: Boolean(rec.is_stale_fallback) || (staleDays !== null && staleDays > FLOOR.STALE_DAYS),
    pastOrNear: departsInHours !== null && departsInHours < FLOOR.DEPARTURE_BUFFER_HOURS,
  };
}

export function load(root = '.') {
  const read = (f) => JSON.parse(fs.readFileSync(`${root}/${f}`, 'utf8'));
  const files = [read('sparkfare_ranked_deals.json'), read('sparkfare_ranked_deals_other_origins.json')];
  const rows = [];
  for (const file of files) {
    for (const bucket of BUCKETS) for (const rec of file[bucket] || []) rows.push({ rec, bucket, generatedAt: file.generated_at });
  }
  return rows;
}

// The steps, cumulative. Each returns true if the record is still called a deal after that step.
export const STEPS = [
  ['today (status = deal)', (r, e) => r.rec.status === 'deal'],
  ['A. 15% below the stored median', (r, e) => r.rec.status === 'deal' && ((r.rec.median_baseline - r.rec.price) / r.rec.median_baseline) >= FLOOR.MIN_PCT_BELOW],
  ['B. A, recomputed over distinct days (>= 10 days, >= 15%)', (r, e) => e.distinct >= FLOOR.MIN_DISTINCT_DAYS && e.pctBelow >= FLOOR.MIN_PCT_BELOW && r.rec.status === 'deal'],
  ['C. B and not stale (fallback, or last fresh > 3 days)', (r, e) => STEPS[2][1](r, e) && !e.stale],
  ['D. C and not departing within 48 hours', (r, e) => STEPS[3][1](r, e) && !e.pastOrNear],
];
// Variant: D-021 replaces the existing rare-find (MAD) test for any priced, fresh, non-stale record, so a record the current rule missed can qualify.
export const REPLACE_STEP = ['E. (variant) D-021 replaces the rare-find test: any priced, non-featured route that clears it, with the existing freshness and span gates', (r, e) =>
  (r.bucket === 'deals' || r.bucket === 'priced_no_deal') && e.distinct >= FLOOR.MIN_DISTINCT_DAYS && e.pctBelow >= FLOOR.MIN_PCT_BELOW && e.span >= FLOOR.MIN_SPAN_DAYS
  && !e.stale && !e.pastOrNear && (e.ageHours === null || e.ageHours <= FLOOR.FRESH_HOURS)];

export function run(root = '.') {
  const rows = load(root).map((r) => ({ ...r, e: evaluate(r.rec, r.generatedAt) }));
  const origins = [...new Set(rows.map((r) => r.rec.origin || 'JFK'))].sort();
  const us = origins.filter((o) => o !== 'TLV');
  const table = [];
  for (const [label, fn] of [...STEPS, REPLACE_STEP]) {
    const perOrigin = {};
    for (const o of origins) perOrigin[o] = rows.filter((r) => (r.rec.origin || 'JFK') === o && fn(r, r.e)).length;
    table.push({ label, perOrigin, us: us.reduce((n, o) => n + perOrigin[o], 0), tlv: perOrigin.TLV || 0 });
  }
  return { rows, origins, us, table };
}

function main() {
  const { rows, origins, us, table } = run();
  const md = process.argv.includes('--markdown');
  const gen = [...new Set(rows.map((r) => r.generatedAt))];
  console.log(`generated_at: ${gen.join(' | ')}`);
  console.log(`records: ${rows.length} (${rows.filter((r) => (r.rec.origin || 'JFK') !== 'TLV').length} US + ${rows.filter((r) => (r.rec.origin || 'JFK') === 'TLV').length} TLV)\n`);
  console.log(md ? `| Step | ${us.join(' | ')} | US total | TLV |\n|---|${us.map(() => '---:').join('|')}|---:|---:|` : '');
  for (const t of table) console.log(md ? `| ${t.label} | ${us.map((o) => t.perOrigin[o]).join(' | ')} | **${t.us}** | ${t.tlv} |` : `${t.label.padEnd(88)} US ${String(t.us).padStart(3)}  TLV ${t.tlv}`);
}

if (process.argv[1] && process.argv[1].endsWith('deal-floor-dry-run.mjs')) main();
