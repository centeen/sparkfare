// N11 (Addendum N, ROADMAP step 158): every KPI defined once.
//
// Each definition has an id, a label, a unit, a kind ('flow' counts something that happened in a window, 'stock' reads the
// state at the moment it is run), a dimension, the owner decision it serves, a minimum sample, whether bots are excluded, and
// `run(env, window)`: the query, which is the single place its SQL lives. `run` returns the rows exactly as the page or email
// that uses them needs them, and it THROWS on a database error: each caller keeps its own failure behaviour (the standup shows
// "n/a", the growth page shows an empty table, the revenue report adds a note), so a missing table changes nothing it did before.
//
// A window is { from, to, month }. `from` and `to` are Dates or strings already in SQLite's datetime format; `to` may be left out
// for an open-ended window (the growth page's "since" cohorts). The daily job (src/metrics/daily.js) stores a subset of these in
// `metrics_daily`; the pages and the standup read them live so their windows (7 days ending now, a calendar month) stay exact.

// ---------- shared helpers --------------------------------------------------------------------------------------------

/** SQLite's datetime('now') format, which is what events.ts, trips.clicked_at and friends hold. */
export const sqlTs = (d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 19).replace('T', ' '));
const isoTs = (d) => (typeof d === 'string' ? d : d.toISOString());
const dateKey = (d) => sqlTs(d).slice(0, 10);

/** Outbound clicks flagged as a bot (src/botClass.js) are left out of every count; rows from before the class existed count. */
// N12: the visitor class is the typed column `ua_class`. Rows written before the column existed (or by a Worker that has not been redeployed yet) have it only
// in meta, so the column wins and meta is the fallback; once nothing older than migration 0044 matters the fallback can go.
const UA = "COALESCE(ua_class, json_extract(meta, '$.ua_class'))";
export const NOT_BOT = `(${UA} IS NULL OR ${UA} != 'bot')`;
export const IS_BOT = `${UA} = 'bot'`;

/** The meter flag went live on 2026-10-13 (F0): clicks before it carry no meter data, so meter metrics start here ("tracked era"). */
export const TRACKED_ERA_START = '2026-10-13 00:00:00';

/** The same-day data alert (N8) first ran on 2026-10-25; before that no day has a data-SLO measurement. */
export const DATA_ALERTS_START = '2026-10-25';

async function all(env, sql, binds = []) {
  return (await env.DB.prepare(sql).bind(...binds).all())?.results || [];
}

/** First column of the first row as a number: null when there is no row, 0 for a SQL NULL (the old standup `one`). */
async function scalar(env, sql, binds = []) {
  const row = await env.DB.prepare(sql).bind(...binds).first();
  if (!row) return null;
  const v = Object.values(row)[0];
  return typeof v === 'number' ? v : (v == null ? 0 : Number(v));
}

const upper = (col, to) => (to ? ` AND ${col} < ?` : '');
const binds = (from, to, fmt = sqlTs) => (to ? [fmt(from), fmt(to)] : [fmt(from)]);

import { srcToStream } from './../emailStreams.js';
export const METRICS = {};
function define(def) {
  if (METRICS[def.id]) throw new Error(`metric ${def.id} defined twice`);
  METRICS[def.id] = { kind: 'flow', unit: 'count', dimension: null, bots: 'n/a', minSample: 1, ...def };
  return METRICS[def.id];
}

/** Count of one event type in [from, to), optionally with an extra filter (a bot filter, for clicks). */
function eventCount(id, label, type, { extra = '', decision, bots = 'n/a' } = {}) {
  return define({
    id, label, decision, bots,
    run: (env, w) => scalar(env, `SELECT COUNT(*) FROM events WHERE event_type = ? AND ts >= ? AND ts < ? ${extra}`, [type, sqlTs(w.from), sqlTs(w.to)]),
  });
}

// ---------- acquisition ------------------------------------------------------------------------------------------------

define({
  id: 'landings', label: 'Landings (one per browser session, bots excluded)', dimension: 'channel', decision: 'D-036 hard gate 3 (signup source tagging); N5',
  bots: 'excluded', minSample: 30,
  run: (env, w) => all(env, `SELECT channel, SUM(count) AS landings FROM landings_daily WHERE date >= ?${upper('date', w.to)} GROUP BY channel`, binds(w.from, w.to, dateKey)),
});

define({
  id: 'signups', label: 'Signups (users created) with how many have confirmed so far', dimension: 'signup_source', decision: 'D-036 M1 acceptance',
  minSample: 30,
  run: (env, w) => all(env,
    `SELECT COALESCE(signup_source, 'unknown') AS source, COUNT(*) AS signups, SUM(CASE WHEN verified_email = 1 THEN 1 ELSE 0 END) AS confirmed
       FROM users WHERE created_at >= ?${upper('created_at', w.to)} GROUP BY COALESCE(signup_source, 'unknown') ORDER BY signups DESC`, binds(w.from, w.to)),
});

define({
  id: 'signups_by_channel', label: 'Signups by first-touch channel, with confirmed', dimension: 'signup_channel', decision: 'Growth plan: landing-to-signup by channel (N5)',
  minSample: 30,
  run: (env, w) => all(env,
    `SELECT COALESCE(signup_channel, 'unknown') AS channel, COUNT(*) AS signups,
            SUM(CASE WHEN verified_email = 1 THEN 1 ELSE 0 END) AS confirmed
       FROM users WHERE created_at >= ?${upper('created_at', w.to)} GROUP BY COALESCE(signup_channel, 'unknown')`, binds(w.from, w.to)),
});

define({
  id: 'signups_by_day_source', label: 'Signups per day and source', dimension: 'day,signup_source', decision: 'D-036 M1 acceptance',
  run: (env, w) => all(env,
    `SELECT substr(created_at, 1, 10) AS day, COALESCE(signup_source, 'unknown') AS source, COUNT(*) AS signups
       FROM users WHERE created_at >= ? GROUP BY day, source ORDER BY day DESC, signups DESC`, [sqlTs(w.from)]),
});

define({
  id: 'confirmations_by_day_source', label: 'Confirmations per day and source (email_verified events)', dimension: 'day,source', decision: 'D-036 M1 acceptance',
  run: (env, w) => all(env,
    `SELECT substr(ts, 1, 10) AS day, COALESCE(source, 'unknown') AS source, COUNT(*) AS confirmations
       FROM events WHERE event_type = 'email_verified' AND ts >= ? GROUP BY day, source ORDER BY day DESC`, [sqlTs(w.from)]),
});

define({
  id: 'signups_by_utm', label: 'Signups by campaign tag, with confirmed', dimension: 'utm', decision: 'Growth plan: channel measurement',
  run: (env, w) => all(env,
    `SELECT json_extract(e.meta, '$.utm') AS utm, COUNT(*) AS signups, SUM(CASE WHEN u.verified_email = 1 THEN 1 ELSE 0 END) AS confirmed
       FROM events e LEFT JOIN users u ON u.id = e.user_id
      WHERE e.event_type = 'signup' AND e.ts >= ? AND json_extract(e.meta, '$.utm') IS NOT NULL
      GROUP BY utm ORDER BY signups DESC`, [sqlTs(w.from)]),
});

define({
  id: 'referrals', label: 'Referrals sent and confirmed', decision: 'M2 referral prompt',
  run: async (env, w) => (await all(env,
    `SELECT COUNT(*) AS sent, SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed
       FROM referrals WHERE created_at >= ?${upper('created_at', w.to)}`, binds(w.from, w.to))),
});

define({
  id: 'verified_signups', label: 'Users created in the window who have confirmed', decision: 'D-036 M1 acceptance', minSample: 30,
  run: (env, w) => scalar(env, 'SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ? AND verified_email = 1', [sqlTs(w.from), sqlTs(w.to)]),
});

eventCount('signup_events', 'Signup events', 'signup', { decision: 'Weekly standup' });
eventCount('referral_signup_events', 'Signups that came through a referral link', 'referral_signup', { decision: 'M2 referral prompt' });
define({
  id: 'signup_sources_top', label: 'Top signup sources (events)', dimension: 'source', decision: 'Weekly standup',
  run: (env, w) => all(env, `SELECT COALESCE(source, partner, 'direct') AS label, COUNT(*) AS n FROM events
    WHERE event_type = 'signup' AND ts >= ? AND ts < ? GROUP BY label ORDER BY n DESC LIMIT 5`, [sqlTs(w.from), sqlTs(w.to)]),
});

// ---------- tools: price check, time-off planner, airport requests -------------------------------------------------------

eventCount('check_runs', 'Price checks run', 'check_run', { decision: 'Step 49 /check' });
eventCount('check_shares', 'Price-check shares', 'check_share', { decision: 'Step 49 /check' });
eventCount('check_signups', 'Signups from the price check', 'check_signup', { decision: 'Step 49 /check' });
define({
  id: 'check_routes_top', label: 'Most-checked routes', dimension: 'route', decision: 'Step 49 /check',
  run: (env, w) => all(env, `SELECT route AS label, COUNT(*) AS n FROM events
    WHERE event_type = 'check_run' AND ts >= ? AND ts < ? AND route IS NOT NULL GROUP BY route ORDER BY n DESC LIMIT 3`, [sqlTs(w.from), sqlTs(w.to)]),
});
eventCount('pto_views', 'Time-off planner views', 'pto_view', { decision: 'Step 72 /time-off' });
eventCount('pto_ics_downloads', 'Time-off .ics downloads', 'pto_ics_download', { decision: 'Step 72 /time-off' });
eventCount('pto_shares', 'Time-off planner shares', 'pto_share', { decision: 'Step 72 /time-off' });
eventCount('pto_signups', 'Signups from the time-off planner', 'pto_signup', { decision: 'Step 72 /time-off' });
eventCount('origin_requests', 'Airport requests', 'origin_request', { decision: 'Step 50 origin requests' });
define({
  id: 'origin_requests_top', label: 'Most-requested airports', dimension: 'origin', decision: 'Step 50 origin requests',
  run: (env, w) => all(env, `SELECT COALESCE(origin, route) AS label, COUNT(*) AS n FROM events
    WHERE event_type = 'origin_request' AND ts >= ? AND ts < ? AND COALESCE(origin, route) IS NOT NULL GROUP BY label ORDER BY n DESC LIMIT 5`, [sqlTs(w.from), sqlTs(w.to)]),
});

// ---------- email ------------------------------------------------------------------------------------------------------

eventCount('alert_email_sent_events', 'Digest and alert emails sent', 'alert_email_sent', { decision: 'D-036 gate; email health' });
eventCount('email_open_events', 'Email opens', 'email_open', { decision: '45-day sunset policy (engaged subscribers)' });
eventCount('email_bounce_events', 'Email bounces', 'email_bounce', { decision: 'Email guard' });
eventCount('email_complaint_events', 'Spam complaints', 'email_complaint', { decision: 'Email guard' });
define({
  id: 'unsubscribes', label: 'Unsubscribes', decision: 'Email health',
  run: (env, w) => scalar(env, "SELECT COUNT(*) FROM email_suppressions WHERE reason = 'unsubscribed' AND created_at >= ? AND created_at < ?", [sqlTs(w.from), sqlTs(w.to)]),
});
// Q8 (Addendum Q): per email stream. Resend returns the `stream` tag on every webhook event and the handler stores it in events.meta, so each of these counts one event
// type per stream. Events from before the tags (no stream) are left out. One definition each; rates are derived where they are shown (src/emailStreams.js).
const streamCount = (id, label, type, extra = '') => define({
  id, label, dimension: 'stream', decision: 'Q8 per-stream guardrails (Framework)',
  run: (env, w) => all(env, `SELECT json_extract(meta, '$.stream') AS stream, COUNT(*) AS n FROM events WHERE event_type = ? AND ts >= ? AND ts < ? AND json_extract(meta, '$.stream') IS NOT NULL ${extra} GROUP BY stream`,
    [type, sqlTs(w.from), sqlTs(w.to)]),
});
streamCount('stream_delivered', 'Emails delivered, by stream', 'email_delivered');
streamCount('stream_complaints', 'Spam complaints, by stream', 'email_complaint');
streamCount('stream_hard_bounces', 'Hard (permanent) bounces, by stream', 'email_bounce', "AND json_extract(meta, '$.bounce_type') = 'Permanent'");
define({
  id: 'stream_clickers', label: 'Unique people who clicked, by stream (scanner-speed clicks left out)', dimension: 'stream', decision: 'Q8 per-stream guardrails (Framework)',
  run: (env, w) => all(env, `SELECT json_extract(meta, '$.stream') AS stream, COUNT(DISTINCT COALESCE(user_id, json_extract(meta, '$.email_id'))) AS n FROM events
    WHERE event_type = 'email_click' AND ts >= ? AND ts < ? AND json_extract(meta, '$.stream') IS NOT NULL AND COALESCE(json_extract(meta, '$.scanner_suspect'), 0) = 0 GROUP BY stream`, [sqlTs(w.from), sqlTs(w.to)]),
});
streamCount('stream_unsubscribes', 'Unsubscribes, by stream (one-click header unsubscribes carry the stream; link clicks in the body do not)', 'email_unsubscribe');
define({
  id: 'stream_partner_clicks', label: 'Partner clicks from email links, by stream (the link\'s src)', dimension: 'stream', decision: 'Q8 per-stream guardrails (Framework)', bots: 'excluded',
  run: async (env, w) => {
    const rows = await all(env, `SELECT COALESCE(NULLIF(source, ''), '') AS src, COUNT(*) AS n FROM events WHERE event_type = 'outbound_click' AND partner IS NOT NULL AND ts >= ? AND ts < ? AND ${NOT_BOT} GROUP BY src`, [sqlTs(w.from), sqlTs(w.to)]);
    const out = {};
    for (const r of rows) { const s = srcToStream(r.src); if (s) out[s] = (out[s] || 0) + r.n; }
    return Object.entries(out).map(([stream, n]) => ({ stream, n }));
  },
});

define({
  id: 'engaged_subscribers', kind: 'stock', label: 'Engaged subscribers (subscribed, opened an email in the last 45 days)', dimension: null,
  decision: 'Business Plan V2.0: active/engaged subscribers replace raw list size', minSample: 100,
  // Stock: the state when it is run. `n` for the daily row is the subscribed list this is a share of.
  run: async (env, w) => {
    const since = sqlTs(new Date(new Date(isoTs(w.asOf || new Date())).getTime() - 45 * 86400000));
    const row = await env.DB.prepare(
      `SELECT SUM(CASE WHEN last_opened_at >= ? THEN 1 ELSE 0 END) AS engaged, COUNT(*) AS subscribed
         FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND COALESCE(is_subscribed, 1) = 1`).bind(since).first();
    return { engaged: row?.engaged || 0, subscribed: row?.subscribed || 0 };
  },
});

// ---------- partner clicks and revenue ---------------------------------------------------------------------------------------

eventCount('outbound_clicks', 'Outbound clicks (human)', 'outbound_click', { extra: `AND ${NOT_BOT}`, bots: 'excluded', decision: 'Meter tracking (F0)' });
eventCount('outbound_clicks_bot', 'Outbound clicks flagged as bots', 'outbound_click', { extra: `AND ${IS_BOT}`, bots: 'only', decision: 'Bot class (2026-10-07)' });
define({
  id: 'partner_clicks_top', label: 'Top partners by human clicks', dimension: 'partner', decision: 'Weekly standup', bots: 'excluded',
  run: (env, w) => all(env, `SELECT partner AS label, COUNT(*) AS n FROM events
    WHERE event_type = 'outbound_click' AND ts >= ? AND ts < ? AND partner IS NOT NULL AND ${NOT_BOT} GROUP BY partner ORDER BY n DESC LIMIT 3`, [sqlTs(w.from), sqlTs(w.to)]),
});
define({
  id: 'partner_clicks_by_bucket', label: 'Human clicks by partner and trip-length bucket', dimension: 'partner,trip_length_bucket', decision: 'D-004 leave-signal gate', bots: 'excluded',
  run: (env, w) => all(env, `SELECT partner, json_extract(meta, '$.trip_length_bucket') AS bucket, COUNT(*) AS n FROM events
    WHERE event_type = 'outbound_click' AND ts >= ? AND ts < ? AND partner IS NOT NULL AND ${NOT_BOT} GROUP BY partner, bucket`, [sqlTs(w.from), sqlTs(w.to)]),
});
define({
  id: 'partner_clicks_by_bucket_unclassified', label: 'Human clicks by partner and bucket, with how many predate the bot class', dimension: 'partner,trip_length_bucket',
  decision: 'Revenue report (F0)', bots: 'excluded',
  run: (env, w) => all(env, `
    SELECT partner, json_extract(meta, '$.trip_length_bucket') AS bucket, count(*) AS n,
           sum(CASE WHEN COALESCE(ua_class, json_extract(meta, '$.ua_class')) IS NULL THEN 1 ELSE 0 END) AS unclassified
    FROM events
    WHERE event_type = 'outbound_click' AND partner IS NOT NULL AND ts >= ? AND ts < ? AND ${NOT_BOT}
    GROUP BY partner, bucket`, [sqlTs(w.from), sqlTs(w.to)]),
});
define({
  id: 'partner_clicks_by_src', label: 'Human clicks by surface (src) and partner', dimension: 'src,partner', decision: 'Revenue report (F0)', bots: 'excluded',
  run: (env, w) => all(env, `
    SELECT COALESCE(NULLIF(source, ''), '(none)') AS src, partner, count(*) AS n
    FROM events
    WHERE event_type = 'outbound_click' AND partner IS NOT NULL AND ts >= ? AND ts < ? AND ${NOT_BOT}
    GROUP BY src, partner`, [sqlTs(w.from), sqlTs(w.to)]),
});
define({
  id: 'signups_by_trip_length', label: 'Signups by trip-length bucket', dimension: 'trip_length_bucket', decision: 'D-004 leave-signal gate', minSample: 30,
  run: (env, w) => all(env, 'SELECT trip_length AS bucket, COUNT(*) AS n FROM users WHERE created_at >= ? AND created_at < ? GROUP BY trip_length', [sqlTs(w.from), sqlTs(w.to)]),
});
define({
  id: 'payout_rows', label: 'Partner payouts as entered (by partner, source and month)', dimension: 'partner_id,source', decision: 'Revenue report (F0); payouts by meter and tier',
  run: (env, w) => all(env, `SELECT month, partner_id, amount_usd, conversions, source, note, entered_at
     FROM partner_payouts WHERE month = ? ORDER BY partner_id, source`, [w.month]),
});
define({
  id: 'bookings_reported', kind: 'stock', label: 'Purchases reported by Travelpayouts', decision: 'Weekly standup',
  run: (env) => scalar(env, "SELECT COUNT(*) FROM trips WHERE status = 'booked'"),
});
define({
  id: 'booking_revenue_eur', kind: 'stock', unit: 'EUR', label: 'Purchase revenue reported by Travelpayouts (EUR)', decision: 'Weekly standup',
  run: (env) => scalar(env, "SELECT COALESCE(SUM(price_eur), 0) FROM trips WHERE status = 'booked'"),
});
define({
  id: 'partner_conversions_month', kind: 'stock', label: 'Partner conversion rows entered for the month', decision: 'Revenue health',
  run: (env, w) => scalar(env, 'SELECT COUNT(*) FROM partner_conversions WHERE month = ?', [w.month]),
});
define({
  id: 'partner_payouts_month', kind: 'stock', label: 'Partner payout rows entered for the month', decision: 'Revenue health',
  run: (env, w) => scalar(env, 'SELECT COUNT(*) FROM partner_payouts WHERE month = ?', [w.month]),
});

// ---------- product use ------------------------------------------------------------------------------------------------------

define({ id: 'trips_tracked', label: 'Trips tracked (booking-link clicks by signed-in users)', decision: 'Weekly standup',
  run: (env, w) => scalar(env, 'SELECT COUNT(*) FROM trips WHERE clicked_at >= ? AND clicked_at < ?', [sqlTs(w.from), sqlTs(w.to)]) });
define({ id: 'watchlists_created', label: 'Watchlists created', decision: 'Business Plan V2.0 (watchlist CTR)',
  run: (env, w) => scalar(env, 'SELECT COUNT(*) FROM watchlists WHERE created_at >= ? AND created_at < ?', [sqlTs(w.from), sqlTs(w.to)]) });
define({ id: 'watchlists_notified', label: 'Watchlists that reached their target', decision: 'Business Plan V2.0 (watchlist CTR)',
  run: (env, w) => scalar(env, 'SELECT COUNT(*) FROM watchlists WHERE notified_at >= ? AND notified_at < ?', [sqlTs(w.from), sqlTs(w.to)]) });
define({ id: 'digest_editions', label: 'Digest editions stored', decision: 'SparkLoop gate (E3)',
  // created_at on this table is an ISO-8601 string, not SQLite's datetime format
  run: (env, w) => scalar(env, 'SELECT COUNT(*) FROM digest_editions WHERE created_at >= ? AND created_at < ?', [isoTs(w.from), isoTs(w.to)]) });
define({ id: 'users_total', kind: 'stock', label: 'Users (all)', decision: 'Weekly standup', run: (env) => scalar(env, 'SELECT COUNT(*) FROM users') });
define({ id: 'users_verified_total', kind: 'stock', label: 'Users who have confirmed', decision: 'Weekly standup', run: (env) => scalar(env, 'SELECT COUNT(*) FROM users WHERE verified_email = 1') });
define({ id: 'users_unsubscribed_total', kind: 'stock', label: 'Users who have unsubscribed', decision: 'Weekly standup', run: (env) => scalar(env, 'SELECT COUNT(*) FROM users WHERE unsubscribed_at IS NOT NULL') });
define({ id: 'digest_editions_stored', kind: 'stock', label: 'Digest editions stored (all)', decision: 'Weekly standup', run: (env) => scalar(env, 'SELECT COUNT(*) FROM digest_editions') });

// ---------- data quality (N8) ----------------------------------------------------------------------------------------------------

define({
  id: 'data_alert_days', label: 'Days with a data alert, and the breaches they listed', dimension: 'date', decision: 'DR-24 same-day data SLO',
  // data_alert_log holds one row per day on which the 09:30 UTC check found at least one breach (date, breaches).
  run: (env, w) => all(env, 'SELECT date, breaches FROM data_alert_log WHERE date >= ? AND date < ? ORDER BY date', [dateKey(w.from), dateKey(w.to)]),
});

/**
 * The KPIs Addendum N lists for the daily store, each once. `stored` names the rows metrics_daily holds for it (src/metrics/daily.js writes
 * them with the queries above); a KPI with `derive` is a ratio computed when read, from the stored sums of its parts, so a ratio is never
 * stored on its own and never averaged across days. `minSample` is the denominator below which a reader must say "too small", not show a rate.
 */
export const KPI_CATALOG = [
  { id: 'landings', label: 'Landings', unit: 'count', dimension: 'channel', stored: ['landings'], decision: 'D-036 hard gate 3; N5', bots: 'excluded', minSample: 30 },
  { id: 'signups', label: 'Signups', unit: 'count', dimension: 'channel', stored: ['signups'], decision: 'D-036 M1 acceptance', bots: 'n/a', minSample: 30 },
  { id: 'confirmed', label: 'Confirmed signups', unit: 'count', dimension: 'channel', stored: ['confirmed'], decision: 'D-036 M1 acceptance', bots: 'n/a', minSample: 30,
    note: 'Of the users created that day, how many have confirmed as of the last run; the job rewrites the last 7 days each day so recent days catch up' },
  { id: 'confirm_rate', label: 'Confirm rate', unit: 'percent', dimension: 'channel', derive: { numerator: 'confirmed', denominator: 'signups', scale: 100 }, decision: 'D-036 M1 acceptance', bots: 'n/a', minSample: 30 },
  { id: 'landing_to_signup', label: 'Landing to signup, by channel', unit: 'percent', dimension: 'channel', derive: { numerator: 'signups', denominator: 'landings', scale: 100 },
    decision: 'Growth plan: channel measurement', bots: 'excluded', minSample: 30, note: 'An upper bound: people who block sessionStorage or scripts are not counted as landings' },
  { id: 'engaged_subscribers', kind: 'stock', label: 'Engaged subscribers (opened in the last 45 days)', unit: 'count', dimension: null, stored: ['engaged_subscribers'], decision: 'Business Plan V2.0', bots: 'n/a', minSample: 100,
    note: 'Stock, stored once a day as of the run; n is the subscribed list it is a share of' },
  { id: 'outbound_clicks_by_meter_surface', label: 'Outbound clicks by meter and surface (human, tracked era)', unit: 'count', dimension: 'meter/surface', stored: ['outbound_clicks_by_meter_surface'],
    decision: 'F0 meter tracking', bots: 'excluded', minSample: 30, note: `Starts ${TRACKED_ERA_START.slice(0, 10)}, when the meter flag went live` },
  { id: 'leave_clicks_per_100_signups', label: 'Leave clicks per 100 signups, by trip-length bucket', unit: 'per_100', dimension: 'trip_length_bucket',
    derive: { numerator: 'leave_clicks_by_bucket', denominator: 'signups_by_trip_length', scale: 100 }, decision: 'D-004 leave-signal gate (Dec 11)', bots: 'excluded', minSample: 30,
    note: 'A bucket with fewer than 30 signups is too small to read' },
  { id: 'flight_clicks_per_100_signups', label: 'Flight clicks per 100 signups, by trip-length bucket', unit: 'per_100', dimension: 'trip_length_bucket',
    derive: { numerator: 'flight_clicks_by_bucket', denominator: 'signups_by_trip_length', scale: 100 }, decision: 'Fare Search arm comparison (Dec 11, Feb 12)', bots: 'excluded', minSample: 30 },
  { id: 'payouts_by_meter_tier', kind: 'stock', label: 'Payouts by meter and tier (network_confirmed rows as entered)', unit: 'usd', dimension: 'month/meter/source', stored: ['payouts_by_meter_tier'],
    decision: 'F0 revenue report', bots: 'n/a', minSample: 1, note: 'Snapshot of the current and previous month; tier is the payout source; the allocated estimate stays on /admin/revenue' },
  { id: 'data_slo_attainment', label: 'Data-quality SLO attainment (share of days with no data alert)', unit: 'percent', dimension: null, derive: { numerator: 'data_slo_day', denominator: 'data_slo_day', scale: 100, rowCount: true },
    decision: 'DR-24 same-day data SLO', bots: 'n/a', minSample: 7, note: `Counted from ${DATA_ALERTS_START}, the first day the same-day alert ran; earlier days have no measurement` },
  { id: 'data_incidents', label: 'Data incidents (breaches listed by the 09:30 UTC alert)', unit: 'count', dimension: null, stored: ['data_incidents'], decision: 'DR-24 same-day data SLO', bots: 'n/a', minSample: 1 },
];

/** Run one definition. Throws on a database error (see the header). */
export function runMetric(env, id, window = {}) {
  const def = METRICS[id];
  if (!def) throw new Error(`unknown metric ${id}`);
  return def.run(env, window);
}
