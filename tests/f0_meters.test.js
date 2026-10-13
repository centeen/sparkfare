// F0 (Task B): outbound click enrichment, partner payouts, and the revenue report. Runs the repo's real migrations
// against in-memory SQLite (tests/helpers/sqliteD1.js), so the joins, grouping and upserts are the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { allocate, computeRevenueReport, validatePayoutRows, SMALL_BUCKET_SIGNUPS } from '../src/meters.js';
import { computeWeeklyStandup, renderWeeklyStandup } from '../src/weeklyStandup.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const SECRET = 'admin-secret-for-tests';
const AVIA = 'https://www.aviasales.com/search/JFK1511LIS2211?marker=314524';

function setup() {
  const DB = makeSqliteD1(MIGRATIONS);
  const db = DB.raw;
  db.prepare("INSERT INTO users (id, email, trip_length, passenger_count, origin_iata) VALUES ('u1','known@example.com','11-14',3,'LAX')").run();
  db.prepare("INSERT INTO trips (trip_id, user_id, destination, origin_iata, departure_at, price_at_click) VALUES ('trip1','u1','Lisbon, Portugal','JFK','2026-11-15',500)").run();
  return { DB, db };
}

async function hit(path, env, { headers = {}, method = 'GET', body } = {}) {
  const pending = [];
  const res = await worker.fetch(new Request(`https://sparkfare.com${path}`, {
    method, redirect: 'manual', body,
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone) AppleWebKit Safari', ...headers },
  }), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}
const admin = { Authorization: `Bearer ${SECRET}` };
const lastClick = (db, partner) => {
  const r = db.prepare("SELECT sub_id, source, partner, meta FROM events WHERE event_type = 'outbound_click' AND partner = ? ORDER BY rowid DESC LIMIT 1").get(partner);
  return r && { ...r, meta: JSON.parse(r.meta) };
};

// ---------- /out event enrichment (B2) ----------

test('flag off: outbound clicks carry only the bot class (events unchanged)', async () => {
  const { DB, db } = setup();
  await hit('/out/us-global-mail?trip_id=trip1&src=email_v2&slot=2', { DB });
  assert.deepEqual(Object.keys(lastClick(db, 'us-global-mail').meta).sort(), ['slot', 'ua_class']);
});

test('flag on, trip known: meter, category, bucket, origin, party size, src, slot, trip id and user_known are recorded', async () => {
  const { DB, db } = setup();
  const res = await hit('/out/us-global-mail?trip_id=trip1&src=email_v2&slot=2', { DB, ENABLE_METER_TRACKING: 'true' });
  assert.equal(res.status, 302);
  const { meta, sub_id, source } = lastClick(db, 'us-global-mail');
  assert.equal(meta.meter, 'leave');
  assert.equal(meta.category, 'mail');
  assert.equal(meta.trip_length_bucket, '11-14');
  assert.equal(meta.origin, 'LAX', "the user's home origin wins over the route origin");
  assert.equal(meta.party_size, 3);
  assert.equal(meta.src, 'email_v2');
  assert.equal(meta.slot, '2');
  assert.equal(meta.trip_id, 'trip1');
  assert.equal(meta.user_known, true);
  assert.equal(meta.ua_class, 'human', 'the existing bot classification is kept');
  assert.equal(sub_id, 'trip1');
  assert.equal(source, 'email_v2');
});

test('flag on, anonymous click: traveler fields are null and user_known is false', async () => {
  const { DB, db } = setup();
  await hit('/out/bounce?src=away_mode', { DB, ENABLE_METER_TRACKING: 'true' });
  const { meta, sub_id } = lastClick(db, 'bounce');
  assert.equal(meta.meter, 'leave');
  assert.equal(meta.category, 'luggage_storage');
  for (const k of ['trip_length_bucket', 'origin', 'party_size', 'trip_id']) assert.equal(meta[k], null, k);
  assert.equal(meta.user_known, false);
  assert.equal(meta.src, 'away_mode');
  assert.equal(sub_id, 'anon');
});

test('an unknown trip id is treated as anonymous, not an error', async () => {
  const { DB, db } = setup();
  const res = await hit('/out/bounce?trip_id=does-not-exist', { DB, ENABLE_METER_TRACKING: 'true' });
  assert.equal(res.status, 302);
  assert.equal(lastClick(db, 'bounce').meta.user_known, false);
});

test('the fare click is tagged as the fare meter with the route origin when the user has none', async () => {
  const { DB, db } = setup();
  db.prepare("UPDATE users SET origin_iata = NULL WHERE id = 'u1'").run();
  await hit(`/out/aviasales?url=${encodeURIComponent(AVIA)}&trip_id=trip1&src=interstitial`, { DB, ENABLE_METER_TRACKING: 'true' });
  const { meta } = lastClick(db, 'aviasales');
  assert.equal(meta.meter, 'fare');
  assert.equal(meta.category, 'flights');
  assert.equal(meta.origin, 'JFK');
  assert.equal(meta.src, 'interstitial');
});

test('the redirect target is unchanged and no traveler data appears in it', async () => {
  const { DB } = setup();
  const env = { DB, ENABLE_METER_TRACKING: 'true' };
  const a = await hit(`/out/aviasales?url=${encodeURIComponent(AVIA)}&trip_id=trip1`, env);
  assert.equal(a.headers.get('Location'), AVIA);
  const b = await hit('/out/us-global-mail?trip_id=trip1', env);
  assert.equal(b.headers.get('Location'), 'https://www.usglobalmail.com/?via=coby');
  assert.doesNotMatch(`${a.headers.get('Location')} ${b.headers.get('Location')}`, /11-14|trip_length|known@example|passenger|party/);
});

test('insurance is not enriched while Step 19 is open, and is still redirected', async () => {
  const { DB, db } = setup();
  const res = await hit('/out/safetywing?trip_id=trip1&src=email_v2', { DB, ENABLE_METER_TRACKING: 'true' });
  assert.equal(res.status, 302);
  assert.deepEqual(Object.keys(lastClick(db, 'safetywing').meta), ['ua_class']);
});

test('parking-access never builds a URL with travel dates, even if the request carries them', async () => {
  const { DB } = setup();
  const res = await hit('/out/parking-access?iata=JFK&arrival=2026-11-15&exit=2026-11-22', { DB });
  const loc = res.headers.get('Location');
  assert.match(loc, /parkingaccess\.com\/go\/JFK/);
  assert.doesNotMatch(loc, /2026-11|arrival|exit/);
});

// ---------- payouts (B4, B5) ----------

const post = (env, body, headers = admin) => hit('/admin/payouts', env, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ON = (DB) => ({ DB, ENABLE_METER_TRACKING: 'true', ADMIN_SECRET: SECRET });

test('payouts: 404 with the flag off, 401 without the Bearer secret (also when it is in the URL)', async () => {
  const { DB } = setup();
  assert.equal((await post({ DB, ADMIN_SECRET: SECRET }, { month: '2026-10', partner_id: 'bounce', amount_usd: 5 })).status, 404);
  assert.equal((await post(ON(DB), { month: '2026-10', partner_id: 'bounce', amount_usd: 5 }, {})).status, 401);
  assert.equal((await hit(`/admin/payouts?month=2026-10&secret=${SECRET}`, ON(DB))).status, 401);
  assert.equal((await hit('/admin/revenue?month=2026-10', ON(DB))).status, 401);
});

test('payouts: a row is stored, and re-posting the same month, partner and source overwrites it', async () => {
  const { DB, db } = setup();
  assert.equal((await post(ON(DB), { month: '2026-10', partner_id: 'us-global-mail', amount_usd: 50, conversions: 2, source: 'partner_dashboard', note: 'first' })).status, 200);
  assert.equal((await post(ON(DB), { month: '2026-10', partner_id: 'us-global-mail', amount_usd: 62.5, conversions: 3, source: 'partner_dashboard', note: 'corrected' })).status, 200);
  const rows = db.prepare('SELECT * FROM partner_payouts').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount_usd, 62.5);
  assert.equal(rows[0].conversions, 3);
  assert.equal(rows[0].note, 'corrected');
  // a different source for the same partner and month is a separate row
  await post(ON(DB), { month: '2026-10', partner_id: 'us-global-mail', amount_usd: 10, source: 'manual' });
  assert.equal(db.prepare('SELECT count(*) AS n FROM partner_payouts').get().n, 2);
  const got = await (await hit('/admin/payouts?month=2026-10', ON(DB), { headers: admin })).json();
  assert.equal(got.payouts.length, 2);
});

test('payouts: an array is accepted, and any bad row rejects the whole request', async () => {
  const { DB, db } = setup();
  const ok = await post(ON(DB), [{ month: '2026-10', partner_id: 'bounce', amount_usd: 4 }, { month: '2026-10', partner_id: 'airhelp', amount_usd: 9, source: 'travelpayouts_api' }]);
  assert.equal((await ok.json()).written, 2);
  const bad = await post(ON(DB), [{ month: '2026-11', partner_id: 'bounce', amount_usd: 4 }, { month: '2026-13', partner_id: 'bounce', amount_usd: 4 }]);
  assert.equal(bad.status, 400);
  assert.equal(db.prepare("SELECT count(*) AS n FROM partner_payouts WHERE month = '2026-11'").get().n, 0, 'nothing from a rejected request is written');
});

test('payouts: bad month, unknown partner, negative or non-numeric amount and bad source are rejected', () => {
  const bad = (row) => validatePayoutRows(row).errors.length > 0;
  assert.ok(bad({ month: '2026-1', partner_id: 'bounce', amount_usd: 1 }));
  assert.ok(bad({ month: '26-10', partner_id: 'bounce', amount_usd: 1 }));
  assert.ok(bad({ month: '2026-00', partner_id: 'bounce', amount_usd: 1 }));
  assert.ok(bad({ month: '2026-10', partner_id: 'not-a-partner', amount_usd: 1 }));
  assert.ok(bad({ month: '2026-10', partner_id: 'bounce', amount_usd: -1 }));
  assert.ok(bad({ month: '2026-10', partner_id: 'bounce', amount_usd: 'lots' }));
  assert.ok(bad({ month: '2026-10', partner_id: 'bounce' }));
  assert.ok(bad({ month: '2026-10', partner_id: 'bounce', amount_usd: 1, source: 'guess' }));
  assert.ok(bad({ month: '2026-10', partner_id: 'bounce', amount_usd: 1, conversions: 1.5 }));
  assert.ok(bad([]));
  assert.ok(!bad({ month: '2026-10', partner_id: 'bounce', amount_usd: 0 }), 'zero is a valid payout');
  assert.ok(!bad({ month: '2026-10', partner_id: 'aviasales', amount_usd: 12.34 }), 'aviasales is a known partner');
});

test('payouts over HTTP: bad month and unknown partner return 400', async () => {
  const { DB } = setup();
  assert.equal((await post(ON(DB), { month: 'October', partner_id: 'bounce', amount_usd: 1 })).status, 400);
  assert.equal((await post(ON(DB), { month: '2026-10', partner_id: 'mystery', amount_usd: 1 })).status, 400);
  assert.equal((await hit('/admin/payouts?month=oct', ON(DB), { headers: admin })).status, 400);
});

// ---------- revenue report (B6) ----------

function click(db, { partner, bucket = null, ua = 'human', month = '2026-10', day = '10' }) {
  const meta = { ua_class: ua };
  if (bucket !== undefined) meta.trip_length_bucket = bucket;
  db.prepare("INSERT INTO events (id, event_type, partner, meta, ts) VALUES (?, 'outbound_click', ?, ?, ?)")
    .run(crypto.randomUUID(), partner, JSON.stringify(meta), `${month}-${day} 12:00:00`);
}

test('allocate: the parts add back to the payout to the cent', () => {
  for (const [amount, weights] of [[50, { a: 1, b: 1, c: 1 }], [100.01, { a: 7, b: 3, c: 3 }], [0.07, { a: 1, b: 2 }], [12345.67, { w: 13, x: 7, y: 5, z: 1 }]]) {
    const parts = allocate(amount, weights);
    const sum = Object.values(parts).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - amount) < 0.005, `${amount}: ${sum}`);
  }
  assert.deepEqual(allocate(10, {}), {});
});

test('report: allocation sums back to each partner payout; bots are excluded; every tier is labelled', async () => {
  const { DB, db } = setup();
  for (let i = 0; i < 6; i++) click(db, { partner: 'us-global-mail', bucket: '11-14' });
  for (let i = 0; i < 3; i++) click(db, { partner: 'us-global-mail', bucket: 'weekend' });
  for (let i = 0; i < 1; i++) click(db, { partner: 'us-global-mail', bucket: null });
  for (let i = 0; i < 40; i++) click(db, { partner: 'us-global-mail', bucket: '11-14', ua: 'bot' });
  for (let i = 0; i < 4; i++) click(db, { partner: 'aviasales', bucket: '11-14' });
  click(db, { partner: 'bounce', bucket: 'weekend' });
  click(db, { partner: 'us-global-mail', bucket: '11-14', month: '2026-09' }); // another month
  await post(ON(DB), [
    { month: '2026-10', partner_id: 'us-global-mail', amount_usd: 100.01, conversions: 4, source: 'partner_dashboard' },
    { month: '2026-10', partner_id: 'aviasales', amount_usd: 20, source: 'manual' },
  ]);
  const r = await (await hit('/admin/revenue?month=2026-10', ON(DB), { headers: admin })).json();

  assert.equal(r.bots_excluded, true);
  const usgm = r.by_partner.find((p) => p.partner_id === 'us-global-mail');
  assert.equal(usgm.human_clicks, 10, 'bots and other months are left out');
  assert.equal(usgm.meter, 'leave');
  assert.equal(usgm.payout_usd, 100.01);
  assert.equal(usgm.revenue_per_click_usd, 10.001);
  assert.equal(r.by_meter.fare.human_clicks, 4);
  assert.equal(r.by_meter.leave.human_clicks, 11);

  const parts = r.allocated_estimate.rows.filter((a) => a.partner_id === 'us-global-mail');
  assert.equal(r.allocated_estimate.label, 'estimate');
  const sum = parts.reduce((a, b) => a + b.amount_usd, 0);
  assert.ok(Math.abs(sum - 100.01) < 0.005, `allocation sums back: ${sum}`);
  const bySeg = Object.fromEntries(parts.map((a) => [a.segment, a.amount_usd]));
  assert.ok(bySeg['11-14'] > bySeg.weekend && bySeg.weekend > bySeg.unknown, 'in proportion to clicks (6, 3, 1)');

  for (const k of ['network_confirmed', 'allocated_estimate', 'clicks_only']) assert.ok(r.tiers[k], `tier ${k} is described`);
  assert.match(r.tiers.allocated_estimate, /ESTIMATE/);
  // Bounce has clicks and no payout: clicks only. A partner with a payout is not listed there.
  assert.deepEqual(r.clicks_only.map((c) => c.partner_id), ['bounce']);
  assert.equal(r.network_confirmed.length, 2, 'payout rows are returned exactly as entered');
});

test('report: one payout per partner and month is counted, by source precedence', async () => {
  const { DB, db } = setup();
  click(db, { partner: 'bounce', bucket: 'weekend' });
  await post(ON(DB), [
    { month: '2026-10', partner_id: 'bounce', amount_usd: 8, source: 'manual' },
    { month: '2026-10', partner_id: 'bounce', amount_usd: 20, source: 'partner_dashboard' },
  ]);
  const r = await computeRevenueReport({ DB }, { month: '2026-10' });
  assert.equal(r.by_partner.find((p) => p.partner_id === 'bounce').payout_usd, 20);
  assert.equal(r.network_confirmed.length, 2);
  assert.equal(r.by_meter.leave.payout_usd, 20, 'not 28');
});

test('report: a payout with no human clicks is not allocated or invented', async () => {
  const { DB } = setup();
  await post(ON(DB), { month: '2026-10', partner_id: 'airhelp', amount_usd: 30, source: 'manual' });
  const r = await computeRevenueReport({ DB }, { month: '2026-10' });
  assert.equal(r.allocated_estimate.rows.length, 0);
  assert.equal(r.by_partner.find((p) => p.partner_id === 'airhelp').revenue_per_click_usd, null);
  assert.equal(r.network_confirmed.length, 1);
});

test('report gate view: per bucket signups, clicks per 100, allocated leave revenue per 100, small buckets flagged', async () => {
  const { DB, db } = setup();
  // 30 signups in 11-14 (enough), 2 in weekend (too small), all created in October.
  for (let i = 0; i < 30; i++) db.prepare("INSERT INTO users (id, email, trip_length, created_at) VALUES (?, ?, '11-14', '2026-10-05 10:00:00')").run(`g${i}`, `g${i}@example.com`);
  for (let i = 0; i < 2; i++) db.prepare("INSERT INTO users (id, email, trip_length, created_at) VALUES (?, ?, 'weekend', '2026-10-06 10:00:00')").run(`w${i}`, `w${i}@example.com`);
  db.prepare("UPDATE users SET created_at = '2026-09-01 00:00:00' WHERE id = 'u1'").run(); // not an October signup
  for (let i = 0; i < 15; i++) click(db, { partner: 'us-global-mail', bucket: '11-14' });
  for (let i = 0; i < 6; i++) click(db, { partner: 'aviasales', bucket: '11-14' });
  await post(ON(DB), { month: '2026-10', partner_id: 'us-global-mail', amount_usd: 60, source: 'manual' });
  const r = await computeRevenueReport({ DB }, { month: '2026-10' });
  const big = r.gate_view.find((g) => g.trip_length_bucket === '11-14');
  assert.equal(big.signups, 30);
  assert.equal(big.leave_clicks_per_100_signups, 50);
  assert.equal(big.flight_clicks_per_100_signups, 20);
  assert.equal(big.allocated_leave_revenue_usd, 60);
  assert.equal(big.allocated_leave_revenue_per_100_signups_usd, 200);
  assert.equal(big.too_small, false);
  const small = r.gate_view.find((g) => g.trip_length_bucket === 'weekend');
  assert.equal(small.signups, 2);
  assert.equal(small.too_small, true);
  assert.match(small.note, /too small/);
  assert.equal(SMALL_BUCKET_SIGNUPS, 30);
  const none = r.gate_view.find((g) => g.trip_length_bucket === '4-6');
  assert.equal(none.leave_clicks_per_100_signups, null, 'no signups means no ratio, not zero');
  assert.equal(none.too_small, true);
});

test('report: a missing table degrades to a note instead of an error', async () => {
  const DB = makeSqliteD1([]); // no migrations at all
  const r = await computeRevenueReport({ DB }, { month: '2026-10' });
  assert.ok(r.notes.some((n) => /not available/.test(n)));
  assert.deepEqual(r.by_partner, []);
});

// ---------- metrics and standup (B7) ----------

test('standup: leave clicks per 100 signups by bucket, bots excluded, meter from the registry, small buckets flagged', async () => {
  const { DB, db } = setup();
  const now = new Date('2026-10-12T09:00:00Z');
  const recent = '2026-10-10 12:00:00';
  const ev = (partner, bucket, ua = 'human') => db.prepare("INSERT INTO events (id, event_type, partner, meta, ts) VALUES (?, 'outbound_click', ?, ?, ?)")
    .run(crypto.randomUUID(), partner, JSON.stringify({ ua_class: ua, trip_length_bucket: bucket }), recent);
  for (let i = 0; i < 3; i++) ev('us-global-mail', '11-14');
  ev('bounce', '11-14', 'bot');
  ev('aviasales', '11-14');
  for (let i = 0; i < 4; i++) db.prepare("INSERT INTO users (id, email, trip_length, created_at) VALUES (?, ?, '11-14', ?)").run(`s${i}`, `s${i}@example.com`, recent);
  const m = await computeWeeklyStandup({ DB }, { now });
  assert.equal(m.leavePer100.leave_clicks, 3);
  assert.equal(m.leavePer100.flight_clicks, 1);
  const b = m.leavePer100.buckets.find((x) => x.bucket === '11-14');
  assert.equal(b.signups, 4);
  assert.equal(b.per_100, 75);
  assert.equal(b.too_small, true);
  const text = renderWeeklyStandup(m).text || renderWeeklyStandup(m);
  assert.match(String(text), /Leave clicks per 100 signups \(by bucket\)/);
  assert.match(String(text), /too small/);
});

test('metrics: outbound clicks carry the meter from the registry', async () => {
  const { DB, db } = setup();
  db.prepare("INSERT INTO events (id, event_type, partner, meta, ts) VALUES ('e1','outbound_click','bounce','{\"ua_class\":\"human\"}', datetime('now'))").run();
  db.prepare("INSERT INTO events (id, event_type, partner, meta, ts) VALUES ('e2','outbound_click','aviasales','{\"ua_class\":\"human\"}', datetime('now'))").run();
  const res = await hit('/admin/metrics', { DB, ADMIN_SECRET: SECRET }, { headers: admin });
  const body = await res.json();
  const byPartner = Object.fromEntries(body.outbound_clicks.map((r) => [r.partner, r.meter]));
  assert.equal(byPartner.bounce, 'leave');
  assert.equal(byPartner.aviasales, 'fare');
});

test('meter tracking is on (owner, 2026-10-13); fare routing still ships off', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_METER_TRACKING":\s*"true"/);
  assert.match(cfg, /"ENABLE_FARE_ROUTING":\s*"false"/);
});
