// A seeded database for the metrics tests (N11). It is built from the repo's real migrations on a real in-memory SQLite, then filled with a
// small, fully deterministic set of rows that touches every table and every filter the standup, /admin/growth and /admin/revenue read:
// bot and human clicks, clicks with and without a trip-length bucket, signups with and without a source or channel, confirmed and
// unconfirmed users, unsubscribes, bookings, watchlists, digest editions, payouts and landings. `NOW` is fixed so a run is reproducible.
import fs from 'node:fs';
import { makeSqliteD1 } from './sqliteD1.js';

export const NOW = new Date('2026-10-26T12:00:00Z');
export const MONTH = '2026-10';

export function migrationFiles() {
  return fs.readdirSync(new URL('../../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
}

const day = (offset, hour = 10) => new Date(NOW.getTime() + offset * 86400000 + (hour - 12) * 3600000).toISOString().slice(0, 19).replace('T', ' ');
const iso = (offset) => new Date(NOW.getTime() + offset * 86400000).toISOString();

export function makeMetricsDb() {
  const d1 = makeSqliteD1(migrationFiles());
  const db = d1.raw;
  const run = (sql, ...params) => db.prepare(sql).run(...params);

  // ---- users: 24, created across the last 40 days; some confirmed, some unsubscribed, varied source, channel and trip length
  const sources = ['home', 'pto', 'check', 'widget', null, 'home'];
  const channels = ['organic_search', 'direct', 'x', null, 'newsletter', 'direct'];
  const buckets = ['weekend', '4-6', '7-10', '11-14', '2+ weeks', '30_plus', null, 'odd'];
  for (let i = 0; i < 24; i++) {
    run(`INSERT INTO users (id, email, created_at, verified_email, signup_source, signup_channel, trip_length, unsubscribed_at, last_opened_at, is_subscribed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    `u${i}`, `u${i}@example.test`, day(-(i * 40) / 24 - 0.3, 9), i % 3 === 0 ? 0 : 1, sources[i % sources.length], channels[i % channels.length],
    buckets[i % buckets.length], i % 11 === 0 ? day(-2) : null, i % 4 === 0 ? day(-3) : (i % 4 === 1 ? day(-60) : null), i % 13 === 0 ? 0 : 1);
  }

  // ---- events
  let n = 0;
  const ev = (type, offset, { user = null, source = null, partner = null, route = null, origin = null, meta = null, sub = null } = {}) =>
    run('INSERT INTO events (id, event_type, user_id, source, partner, route, origin, meta, sub_id, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      `e${n++}`, type, user, source, partner, route, origin, meta == null ? null : JSON.stringify(meta), sub, day(offset, 8 + (n % 9)));
  const offsets = [-0.2, -1, -2, -3, -5, -6, -7.5, -9, -11, -13, -15, -20, -27, -30];
  offsets.forEach((o, i) => {
    ev('signup', o, { user: `u${i}`, source: i % 2 ? 'home' : null, partner: i % 3 === 0 ? 'pseo' : null, meta: i % 4 === 0 ? { utm: 'launch_test' } : (i % 4 === 1 ? { utm: 'x_post' } : {}) });
    if (i % 3 === 0) ev('referral_signup', o);
    ev('email_verified', o, { user: `u${i}`, source: i % 2 ? 'home' : 'pto' });
    ev('check_run', o, { route: ['JFK:Lisbon', 'LAX:Tokyo', 'JFK:Lisbon'][i % 3] });
    if (i % 2 === 0) ev('check_share', o);
    if (i % 5 === 0) ev('check_signup', o);
    ev('pto_view', o);
    if (i % 3 === 0) ev('pto_ics_download', o);
    if (i % 4 === 0) ev('pto_share', o);
    if (i % 5 === 0) ev('pto_signup', o);
    if (i % 2 === 1) ev('origin_request', o, { origin: ['SAN', 'PDX', null][i % 3], route: i % 3 === 2 ? 'RDU' : null });
    ev('alert_email_sent', o);
    if (i % 2 === 0) ev('email_open', o);
    if (i === 3 || i === 9) ev('email_bounce', o);
    if (i === 5) ev('email_complaint', o);
  });
  // outbound clicks: human, bot, and rows from before the bot class; with and without a trip-length bucket and a src
  const clicks = [
    ['safetywing', { ua_class: 'human', trip_length_bucket: '7-10' }], ['safetywing', { ua_class: 'human', trip_length_bucket: '7-10' }],
    ['bounce', { ua_class: 'human', trip_length_bucket: 'weekend' }], ['us-global-mail', { ua_class: 'human', trip_length_bucket: '2+ weeks' }],
    ['us-global-mail', { ua_class: 'bot' }], ['aviasales', { ua_class: 'human', trip_length_bucket: '4-6' }], ['aviasales', { ua_class: 'human' }],
    ['aviasales', { ua_class: 'none' }], ['yesim', null], ['airhelp', { ua_class: 'human', trip_length_bucket: 'weird' }],
    ['bounce', { ua_class: 'bot' }], ['tiqets', { ua_class: 'human' }], [null, { ua_class: 'human' }],
  ];
  clicks.forEach(([partner, meta], i) => {
    ev('outbound_click', -0.5 - i * 0.9, { partner, source: i % 3 === 0 ? 'away_mode' : (i % 3 === 1 ? 'route_page' : ''), meta });
    ev('outbound_click', -9 - i * 0.7, { partner, source: i % 2 ? 'leave_long' : 'away_mode', meta });
  });
  ev('weekly_standup_sent', -7, { sub: '2026-10-19' });

  // ---- other tables
  run("INSERT INTO email_suppressions (email, reason, created_at) VALUES ('a@example.test','unsubscribed',?),('b@example.test','unsubscribed',?),('c@example.test','bounce',?),('d@example.test','unsubscribed',?)", day(-1), day(-4), day(-5), day(-12));
  const trip = (id, user, clicked, status, eur) => run('INSERT INTO trips (trip_id, user_id, destination, origin_iata, departure_at, price_at_click, clicked_at, status, price_eur) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, user, 'Lisbon', 'JFK', '2027-03-01T10:00:00Z', 500, clicked, status, eur);
  trip('t1', 'u1', day(-1), 'clicked', null); trip('t2', 'u2', day(-3), 'booked', 412.5); trip('t3', 'u3', day(-10), 'booked', 300); trip('t4', 'u4', day(-20), 'clicked', null);
  run('INSERT INTO watchlists (id, user_id, destination, origin_iata, target_price, created_at, notified_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'w1', 'u1', 'Lisbon', 'JFK', 400, day(-2), day(-1));
  run('INSERT INTO watchlists (id, user_id, destination, origin_iata, target_price, created_at, notified_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'w2', 'u2', 'Tokyo', 'LAX', 700, day(-9), null);
  run('INSERT INTO watchlists (id, user_id, destination, origin_iata, target_price, created_at, notified_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'w3', 'u3', 'Rome', 'JFK', 500, day(-12), day(-10));
  const ed = (id, offset, kind) => run('INSERT INTO digest_editions (id, origin, edition_date, edition_number, kind, subject, deals_json, html_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, 'JFK', iso(offset).slice(0, 10), 1, kind, 's', '[]', '<p></p>', iso(offset));
  ed('de1', -1, 'daily'); ed('de2', -2, 'daily'); ed('de3', -9, 'daily'); ed('de4', -3, 'weekly');
  run("INSERT INTO partner_conversions (id, month, reported_conversions, reported_revenue, slug) VALUES ('pc1', ?, 2, 40, 'safetywing')", MONTH);
  const pay = (month, partner, source, amount, conv) => run('INSERT INTO partner_payouts (month, partner_id, source, amount_usd, conversions, entered_at) VALUES (?, ?, ?, ?, ?, ?)', month, partner, source, amount, conv, '2026-10-20 09:00:00');
  pay(MONTH, 'safetywing', 'manual', 120, 4); pay(MONTH, 'safetywing', 'partner_dashboard', 100, 3); pay(MONTH, 'bounce', 'manual', 33.33, 1); pay(MONTH, 'aviasales', 'travelpayouts_api', 12.5, 1); pay('2026-09', 'bounce', 'manual', 9, 1);
  const land = (offset, channel, count) => run("INSERT INTO landings_daily (date, channel, page_class, campaign, count) VALUES (?, ?, 'home', '', ?)", iso(offset).slice(0, 10), channel, count);
  for (const o of [-1, -3, -6, -10, -20, -27]) { land(o, 'organic_search', 40 + Math.abs(o)); land(o, 'direct', 25); land(o, 'x', 8); }
  const ref = (id, created, status) => run('INSERT INTO referrals (id, referrer_id, referred_id, status, created_at) VALUES (?, ?, ?, ?, ?)', id, 'u0', `u${id}`, status, created);
  ref('r1', day(-2), 'pending'); ref('r2', day(-5), 'confirmed'); ref('r3', day(-15), 'confirmed'); ref('r4', day(-26), 'pending');
  run("INSERT INTO data_alert_log (date, breaches) VALUES (?, 2), (?, 1), (?, 3)", iso(-2).slice(0, 10), iso(-9).slice(0, 10), iso(-20).slice(0, 10));

  return { DB: d1, raw: db };
}

export const PIPELINE = { problems: ['The JFK daily file is 30 hours old.'], guard: { tripped: false }, details: [{ name: 'daily_jfk', ageHours: 30 }] };
