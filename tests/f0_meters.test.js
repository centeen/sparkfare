// F0: revenue per departure. Runs the real SQL against in-memory SQLite (a D1-shaped wrapper), the same
// approach as tests/t7_deliverability.test.js, so the report's joins and grouping are exercised for real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import {
  computeMeterReport, meterForClick, bucketTripLength, FARE_ALLOCATION_RATE, TRIP_LENGTH_BUCKETS,
} from '../src/meters.js';

const SECRET = 'admin-secret-for-tests';

function makeD1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, params) => ({
    run: async () => { db.prepare(sql).run(...params); return { success: true }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params).map((r) => ({ ...r })) }),
  });
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, trip_length TEXT);
    CREATE TABLE trips (trip_id TEXT PRIMARY KEY, user_id TEXT, status TEXT DEFAULT 'clicked', price_eur REAL,
                        clicked_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE partners (slug TEXT PRIMARY KEY, name TEXT, category TEXT, url_template TEXT, status TEXT);
    CREATE TABLE partner_conversions (id TEXT PRIMARY KEY, slug TEXT, month TEXT, reported_conversions INTEGER DEFAULT 0,
                                      reported_revenue REAL DEFAULT 0, UNIQUE(slug, month));
    CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT,
                         route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')));
  `);
  return { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

function seed(d1) {
  const db = d1._db;
  db.prepare("INSERT INTO partners VALUES ('us-global-mail','US Global Mail','Virtual mailbox','https://example.test/usgm','live')").run();
  db.prepare("INSERT INTO partners VALUES ('bounce','Bounce','Luggage storage','https://example.test/bounce','live')").run();
  db.prepare("INSERT INTO partners VALUES ('safetywing','SafetyWing','Travel insurance','https://example.test/sw','live')").run();
  db.prepare("INSERT INTO users VALUES ('u_long','long@example.com','11-14')").run();
  db.prepare("INSERT INTO users VALUES ('u_short','short@example.com','weekend')").run();
  db.prepare("INSERT INTO trips (trip_id, user_id) VALUES ('trip_long','u_long')").run();
  db.prepare("INSERT INTO trips (trip_id, user_id) VALUES ('trip_short','u_short')").run();
}

async function hit(path, env, headers = {}) {
  const pending = [];
  const res = await worker.fetch(new Request(`https://sparkfare.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', ...headers }, redirect: 'manual' }),
    env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}

const lastClick = (d1) => {
  const r = d1._db.prepare("SELECT sub_id, partner, meta FROM events WHERE event_type = 'outbound_click' ORDER BY rowid DESC LIMIT 1").get();
  return r && { ...r, meta: JSON.parse(r.meta) };
};

const AVIA = encodeURIComponent('https://www.aviasales.com/search/JFK1511LIS2211?marker=314524.trip_long');

test('flag off: outbound clicks carry no meter or trip length (events unchanged)', async () => {
  const d1 = makeD1(); seed(d1);
  const env = { DB: d1, ENABLE_METER_TRACKING: 'false' };
  await hit(`/out/aviasales?url=${AVIA}&trip_id=trip_long`, env);
  assert.deepEqual(Object.keys(lastClick(d1).meta), ['ua_class']);
  await hit('/out/us-global-mail?trip_id=trip_long', env);
  assert.deepEqual(Object.keys(lastClick(d1).meta), ['ua_class']);
});

test('flag on: a fare click and a leave click record the meter and the trip-length bucket', async () => {
  const d1 = makeD1(); seed(d1);
  const env = { DB: d1, ENABLE_METER_TRACKING: 'true' };
  await hit(`/out/aviasales?url=${AVIA}&trip_id=trip_long`, env);
  let c = lastClick(d1);
  assert.equal(c.meta.meter, 'fare');
  assert.equal(c.meta.trip_length, '11-14');
  assert.equal(c.sub_id, 'trip_long', 'the sub_id is still only the opaque trip id');
  await hit('/out/bounce?trip_id=trip_short', env);
  c = lastClick(d1);
  assert.equal(c.meta.meter, 'leave');
  assert.equal(c.meta.trip_length, 'weekend');
});

test('traveler data never appears in the redirect target', async () => {
  const d1 = makeD1(); seed(d1);
  const env = { DB: d1, ENABLE_METER_TRACKING: 'true' };
  const a = await hit(`/out/aviasales?url=${AVIA}&trip_id=trip_long`, env);
  assert.equal(a.headers.get('Location'), decodeURIComponent(AVIA));
  const b = await hit('/out/us-global-mail?trip_id=trip_long', env);
  assert.equal(b.headers.get('Location'), 'https://example.test/usgm');
  assert.doesNotMatch(`${a.headers.get('Location')} ${b.headers.get('Location')}`, /11-14|trip_length|long@example/);
});

test('an anonymous click is tagged but lands in the unknown bucket', async () => {
  const d1 = makeD1(); seed(d1);
  await hit('/out/us-global-mail', { DB: d1, ENABLE_METER_TRACKING: 'true' });
  const c = lastClick(d1);
  assert.equal(c.meta.meter, 'leave');
  assert.equal(c.meta.trip_length, 'unknown');
});

test('insurance gets no new tracking while step 19 is open, even with the flag on', async () => {
  const d1 = makeD1(); seed(d1);
  await hit('/out/safetywing?trip_id=trip_long', { DB: d1, ENABLE_METER_TRACKING: 'true' });
  assert.deepEqual(Object.keys(lastClick(d1).meta), ['ua_class']);
  assert.equal(meterForClick('safetywing'), null);
  assert.equal(meterForClick('x', 'Travel Insurance'), null);
  assert.equal(meterForClick('aviasales'), 'fare');
  assert.equal(meterForClick('bounce', 'Luggage storage'), 'leave');
});

test('bucketTripLength accepts the six signup buckets and nothing else', () => {
  for (const b of TRIP_LENGTH_BUCKETS) assert.equal(bucketTripLength(b), b);
  assert.deepEqual(TRIP_LENGTH_BUCKETS, ['weekend', '4-6', '7-10', '11-14', '2+ weeks', '30+ days']);
  assert.equal(bucketTripLength('free text'), 'unknown');
  assert.equal(bucketTripLength(null), 'unknown');
});

function addClick(d1, { partner, meter, trip_length, month = null, ua = 'human' }) {
  const ts = month ? `${month}-15 12:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);
  const meta = { ua_class: ua };
  if (meter) { meta.meter = meter; meta.trip_length = trip_length; }
  d1._db.prepare("INSERT INTO events (id, event_type, partner, meta, ts) VALUES (?, 'outbound_click', ?, ?, ?)")
    .run(crypto.randomUUID(), partner, JSON.stringify(meta), ts);
}

test('report: a click is never revenue, and every figure is labelled with its tier', async () => {
  const d1 = makeD1(); seed(d1);
  addClick(d1, { partner: 'bounce', meter: 'leave', trip_length: '11-14' });
  addClick(d1, { partner: 'aviasales', meter: 'fare', trip_length: '11-14' });
  const r = await computeMeterReport({ DB: d1 }, { sinceDays: 90 });
  assert.equal(r.meters.leave.clicks_only.clicks, 1);
  assert.equal(r.meters.fare.clicks_only.clicks, 1);
  assert.equal(r.meters.leave.network_confirmed.reported_revenue, 0);
  assert.equal(r.meters.leave.allocated_estimate.revenue, 0);
  assert.equal(r.meters.fare.allocated_estimate.revenue_eur, 0);
  assert.deepEqual(Object.keys(r.tiers), ['clicks_only', 'network_confirmed', 'allocated_estimate']);
  assert.equal(r.by_trip_length['11-14'].per_departure.leave_allocated_revenue, 0);
});

test('report: payouts are spread over that partner\'s clicks by bucket, bots and other partners excluded', async () => {
  const d1 = makeD1(); seed(d1);
  const month = new Date().toISOString().slice(0, 7);
  addClick(d1, { partner: 'us-global-mail', meter: 'leave', trip_length: '11-14' });
  addClick(d1, { partner: 'us-global-mail', meter: 'leave', trip_length: '11-14' });
  addClick(d1, { partner: 'us-global-mail', meter: 'leave', trip_length: 'weekend' });
  addClick(d1, { partner: 'us-global-mail', meter: 'leave', trip_length: 'weekend', ua: 'bot' });
  addClick(d1, { partner: 'bounce', meter: 'leave', trip_length: 'weekend' });
  d1._db.prepare("INSERT INTO partner_conversions (id, slug, month, reported_conversions, reported_revenue) VALUES ('p1','us-global-mail',?,1,60)").run(month);
  const r = await computeMeterReport({ DB: d1 });
  // 60 over 3 human clicks: 2 in 11-14 (40), 1 in weekend (20). Bounce had no payout.
  assert.equal(r.by_trip_length['11-14'].leave.allocated_revenue, 40);
  assert.equal(r.by_trip_length.weekend.leave.allocated_revenue, 20);
  assert.equal(r.meters.leave.network_confirmed.reported_revenue, 60);
  assert.equal(r.meters.leave.allocated_estimate.unallocated_revenue, 0);
  // Departures: one tracked trip per bucket, so per-departure equals the bucket's allocation.
  assert.equal(r.by_trip_length['11-14'].departures, 1);
  assert.equal(r.by_trip_length['11-14'].per_departure.leave_allocated_revenue, 40);
});

test('report: a payout month with no clicks is reported as unallocated, not invented', async () => {
  const d1 = makeD1(); seed(d1);
  const month = new Date().toISOString().slice(0, 7);
  d1._db.prepare("INSERT INTO partner_conversions (id, slug, month, reported_conversions, reported_revenue) VALUES ('p1','bounce',?,1,25)").run(month);
  const r = await computeMeterReport({ DB: d1 });
  assert.equal(r.meters.leave.allocated_estimate.revenue, 0);
  assert.equal(r.meters.leave.allocated_estimate.unallocated_revenue, 25);
  assert.equal(r.meters.leave.network_confirmed.payouts[0].allocated, false);
});

test('report: fare revenue is confirmed ticket value x the assumed rate, labelled as an estimate', async () => {
  const d1 = makeD1(); seed(d1);
  d1._db.prepare("UPDATE trips SET status = 'booked', price_eur = 630 WHERE trip_id = 'trip_long'").run();
  d1._db.prepare("UPDATE trips SET status = 'booked', price_eur = 100 WHERE trip_id = 'trip_short'").run();
  d1._db.prepare("INSERT INTO trips (trip_id, user_id, status, price_eur) VALUES ('t3','u_long','clicked',900)").run();
  const r = await computeMeterReport({ DB: d1 });
  assert.equal(r.meters.fare.network_confirmed.paid_bookings, 2);
  assert.equal(r.meters.fare.network_confirmed.ticket_value_eur, 730);
  assert.equal(r.meters.fare.allocated_estimate.rate_assumed, FARE_ALLOCATION_RATE);
  assert.equal(r.meters.fare.allocated_estimate.revenue_eur, Math.round(730 * FARE_ALLOCATION_RATE * 100) / 100);
  assert.equal(r.by_trip_length['11-14'].fare.confirmed_bookings, 1, 'an unbooked click is not a booking');
  assert.equal(r.by_trip_length['11-14'].departures, 2);
});

test('report: missing tables degrade to notes instead of throwing; unmeasured meters say so', async () => {
  const db = new DatabaseSync(':memory:');
  const d1 = { prepare: (sql) => ({ bind: () => ({ all: async () => ({ results: db.prepare(sql).all() }) }) }) };
  const r = await computeMeterReport({ DB: d1 });
  assert.ok(r.notes.some((n) => /not available/.test(n)));
  assert.match(r.meters.membership.status, /not measured/);
  assert.match(r.meters.audience.status, /not measured/);
  assert.match(r.meters.data.status, /not measured/);
});

test('/admin/meters: 404 with the flag off, 401 without the Bearer secret (even with it in the URL), 200 with it', async () => {
  const d1 = makeD1(); seed(d1);
  const call = async (env, path = '/admin/meters', headers = {}) => hit(path, { DB: d1, ADMIN_SECRET: SECRET, ...env }, headers);
  assert.equal((await call({ ENABLE_METER_TRACKING: 'false' }, '/admin/meters', { Authorization: `Bearer ${SECRET}` })).status, 404);
  assert.equal((await call({ ENABLE_METER_TRACKING: 'true' })).status, 401);
  assert.equal((await call({ ENABLE_METER_TRACKING: 'true' }, `/admin/meters?secret=${SECRET}`)).status, 401);
  const ok = await call({ ENABLE_METER_TRACKING: 'true' }, '/admin/meters?days=30', { Authorization: `Bearer ${SECRET}` });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.window_days, 30);
  assert.ok(body.meters.fare && body.meters.leave);
});

test('the flag ships off in wrangler.jsonc', async () => {
  const { readFileSync } = await import('node:fs');
  const cfg = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_METER_TRACKING":\s*"false"/);
});
