// N11 (Addendum N, ROADMAP step 158): the daily metrics job. Computes the KPIs in KPI_CATALOG for each UTC day from the queries in
// definitions.js and upserts them into `metrics_daily` (migration 0037). Idempotent: running it again for the same day overwrites that
// day's rows with the same values. Counts only: no email, no user id.
//
// What a run writes, for a run at time `now`:
//   * flow KPIs for each of the last `days` COMPLETE days (default 7), so a cohort that confirms a few days after signing up catches up;
//   * stock KPIs (engaged subscribers, payout snapshots) under today's date, as of the run;
//   * the data-SLO KPIs for the same complete days.
// It runs inside the existing 09:30 UTC cron (src/index.js), after the data alert, failure-isolated.
import { runMetric, KPI_CATALOG, TRACKED_ERA_START, DATA_ALERTS_START } from './definitions.js';
import { meterForPartner, TRIP_LENGTH_BUCKETS, UNKNOWN_BUCKET } from '../meters.js';

const DAY_MS = 86400000;
export const DEFAULT_DAYS = 7;
const ROWS_PER_STATEMENT = 40;

const dayStart = (key) => `${key} 00:00:00`;
const addDays = (key, n) => new Date(new Date(`${key}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const bucketOf = (b) => (TRIP_LENGTH_BUCKETS.includes(b) ? b : UNKNOWN_BUCKET);

/** The complete UTC days before `now`, oldest first. */
export function completeDays(now, days = DEFAULT_DAYS) {
  const today = now.toISOString().slice(0, 10);
  return Array.from({ length: days }, (_, i) => addDays(today, -(days - i)));
}

const row = (date, metric_id, dimension, value, n) => ({ date, metric_id, dimension: dimension ?? '', value: Number(value) || 0, n: Number(n) || 0 });

/** The rows for one complete day. Each part is isolated: a failure in one KPI is reported, the others still go in. */
export async function flowRowsForDay(env, date, failed = []) {
  const w = { from: dayStart(date), to: dayStart(addDays(date, 1)) };
  const out = [];
  const part = async (name, fn) => {
    try { out.push(...(await fn())); } catch (error) { failed.push(`${name}: ${error.message || error}`); }
  };
  await part('landings', async () => (await runMetric(env, 'landings', w)).map((r) => row(date, 'landings', r.channel, r.landings, r.landings)));
  await part('signups', async () => {
    const rows = await runMetric(env, 'signups_by_channel', w);
    return rows.flatMap((r) => [row(date, 'signups', r.channel, r.signups, r.signups), row(date, 'confirmed', r.channel, r.confirmed || 0, r.signups)]);
  });
  await part('signups_by_trip_length', async () => {
    const sums = {};
    for (const r of await runMetric(env, 'signups_by_trip_length', w)) sums[bucketOf(r.bucket)] = (sums[bucketOf(r.bucket)] || 0) + r.n;
    return Object.entries(sums).map(([b, n]) => row(date, 'signups_by_trip_length', b, n, n));
  });
  // Meter metrics start when meter tracking went live: before it, a click carries no meter data.
  const eraFrom = w.from < TRACKED_ERA_START ? TRACKED_ERA_START : w.from;
  const inEra = w.to > TRACKED_ERA_START;
  await part('outbound_clicks_by_meter_surface', async () => {
    if (!inEra) return [];
    const sums = {};
    for (const r of await runMetric(env, 'partner_clicks_by_src', { from: eraFrom, to: w.to })) {
      const key = `${meterForPartner(r.partner) || 'unknown'}/${r.src}`;
      sums[key] = (sums[key] || 0) + r.n;
    }
    return Object.entries(sums).map(([k, n]) => row(date, 'outbound_clicks_by_meter_surface', k, n, n));
  });
  await part('clicks_by_bucket', async () => {
    if (!inEra) return [];
    const leave = {}; const fare = {};
    for (const r of await runMetric(env, 'partner_clicks_by_bucket', { from: eraFrom, to: w.to })) {
      const meter = meterForPartner(r.partner);
      const target = meter === 'leave' ? leave : (meter === 'fare' ? fare : null);
      if (target) target[bucketOf(r.bucket)] = (target[bucketOf(r.bucket)] || 0) + r.n;
    }
    return [
      ...Object.entries(leave).map(([b, n]) => row(date, 'leave_clicks_by_bucket', b, n, n)),
      ...Object.entries(fare).map(([b, n]) => row(date, 'flight_clicks_by_bucket', b, n, n)),
    ];
  });
  await part('data_slo', async () => {
    if (date < DATA_ALERTS_START) return []; // no monitoring existed yet: no measurement, not a pass
    const alerts = await runMetric(env, 'data_alert_days', w);
    const breaches = alerts.reduce((a, r) => a + (Number(r.breaches) || 0), 0);
    return [row(date, 'data_slo_day', '', alerts.length === 0 ? 1 : 0, 1), row(date, 'data_incidents', '', breaches, breaches)];
  });
  return out;
}

/** Rows that describe the state at the moment of the run, stored under today's date. */
export async function stockRows(env, now, failed = []) {
  const today = now.toISOString().slice(0, 10);
  const out = [];
  try {
    const e = await runMetric(env, 'engaged_subscribers', { asOf: now });
    out.push(row(today, 'engaged_subscribers', '', e.engaged, e.subscribed));
  } catch (error) { failed.push(`engaged_subscribers: ${error.message || error}`); }
  try {
    // Payout snapshot for the current and the previous month: the amount entered, by meter and source (the tier). Entered by hand, so a stock.
    const months = [today.slice(0, 7), addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)];
    for (const month of months) {
      const sums = {};
      for (const r of await runMetric(env, 'payout_rows', { month })) {
        const key = `${month}|${meterForPartner(r.partner_id) || 'unknown'}|${r.source}`;
        const e = (sums[key] = sums[key] || { amount: 0, conversions: 0 });
        e.amount += Number(r.amount_usd) || 0;
        e.conversions += Number(r.conversions) || 0;
      }
      for (const [k, e] of Object.entries(sums)) out.push(row(today, 'payouts_by_meter_tier', k, Math.round(e.amount * 100) / 100, e.conversions));
    }
  } catch (error) { failed.push(`payouts_by_meter_tier: ${error.message || error}`); }
  return out;
}

function lit(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  const s = String(v);
  if (s.includes('\0')) throw new Error('NUL in a metric value');
  return `'${s.replace(/'/g, "''")}'`;
}

/** Upsert rows as multi-row INSERTs with inline literals (D1 caps bound parameters at 100 per statement). */
export function upsertStatements(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const values = rows.slice(i, i + ROWS_PER_STATEMENT).map((r) => `(${lit(r.date)}, ${lit(r.metric_id)}, ${lit(r.dimension)}, ${lit(r.value)}, ${lit(r.n)})`).join(',\n  ');
    out.push(`INSERT INTO metrics_daily (date, metric_id, dimension, value, n) VALUES\n  ${values}\nON CONFLICT(date, metric_id, dimension) DO UPDATE SET value = excluded.value, n = excluded.n, computed_at = datetime('now')`);
  }
  return out;
}

/**
 * Compute and store. `dryRun` computes and returns without writing. Returns counts only.
 * A database error while reading one KPI is reported in `failed` and the rest still go in; an error while writing throws.
 */
export async function writeMetricsDaily(env, { now = new Date(), days = DEFAULT_DAYS, dryRun = false } = {}) {
  if (!env?.DB) return { ok: true, written: 0, reason: 'DB not configured' };
  const failed = [];
  const rows = [];
  for (const date of completeDays(now, days)) rows.push(...(await flowRowsForDay(env, date, failed)));
  rows.push(...(await stockRows(env, now, failed)));
  if (!dryRun) {
    for (const sql of upsertStatements(rows)) await env.DB.prepare(sql).run();
  }
  const byMetric = {};
  for (const r of rows) byMetric[r.metric_id] = (byMetric[r.metric_id] || 0) + 1;
  return { ok: true, dryRun, days, written: dryRun ? 0 : rows.length, rows: rows.length, byMetric, failed, ...(dryRun ? { sample: rows.slice(0, 5) } : {}) };
}

export { KPI_CATALOG };
