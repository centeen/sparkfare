// Away Move 2 (ROADMAP step 70): one-tap trip self-report. Runs real SQL against an in-memory SQLite D1 wrapper.
// The answer lives in two new trips columns and never in trips.status, so Travelpayouts reconciliation is unaffected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleRequest, reconcileBookings, sendDepartureBriefingAlerts, sendDepartingSoonAlerts, sendPreDepartureSequenceAlerts, computeKPIs } from '../src/index.js';
import { sendStressValveEmail } from '../src/email.js';
import {
  signTripTapToken, verifyTripTapToken, signUnsubscribeToken, verifyUnsubscribeToken, signReactivateToken, verifyReactivateToken,
} from '../src/postClickEmail.js';

const SECRET = 'test-secret-do-not-use';
const DAY = 86400000;

function makeD1({ withColumns = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, unsubscribed_at TEXT, paused_until TEXT, partner_id TEXT,
      trip_length TEXT, passenger_count INTEGER, is_subscribed INTEGER DEFAULT 1);
    CREATE TABLE trips (trip_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, destination TEXT NOT NULL, origin_iata TEXT NOT NULL,
      departure_at TEXT NOT NULL, return_at TEXT, price_at_click INTEGER NOT NULL, clicked_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'clicked', price_eur REAL${withColumns ? ", booking_self_report TEXT CHECK (booking_self_report IN ('booked','not_yet','not_going')), self_reported_at TEXT" : ''});
    CREATE TABLE away_mode_email_log (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, partner_id TEXT, email_type TEXT, sent_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT,
      partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')));
  `);
  const stmt = (sql, params) => ({
    run: async () => { const r = db.prepare(sql).run(...params); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
  });
  return { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

function seed(d1, { tripId = 't1', departInDays = 30, status = 'clicked', selfReport = null, email = 'a@example.com', userId = 'u1' } = {}) {
  d1._db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').run(userId, email);
  d1._db.prepare('INSERT INTO trips (trip_id, user_id, destination, origin_iata, departure_at, price_at_click, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(tripId, userId, 'Lisbon, Portugal', 'JFK', new Date(Date.now() + departInDays * DAY).toISOString(), 500, status);
  if (selfReport) d1._db.prepare('UPDATE trips SET booking_self_report = ? WHERE trip_id = ?').run(selfReport, tripId);
}

const trip = (d1, id = 't1') => ({ ...d1._db.prepare('SELECT * FROM trips WHERE trip_id = ?').get(id) });
const envOn = (d1, extra = {}) => ({ DB: d1, UNSUBSCRIBE_SECRET: SECRET, ENABLE_TRIP_SELF_REPORT: 'true', APP_URL: 'https://sparkfare.com', ...extra });
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function call(env, method, token, headers = {}) {
  const req = new Request(`https://sparkfare.com/api/trip-status${token === undefined ? '' : `?token=${encodeURIComponent(token)}`}`, { method, headers: { 'user-agent': BROWSER, accept: 'text/html', ...headers } });
  return handleRequest(req, env, {});
}

// ---- tokens ------------------------------------------------------------------------------------

test('token round trip carries only trip id, answer and an expiry, never an email', async () => {
  const token = await signTripTapToken('t1', 'booked', SECRET);
  assert.deepEqual(await verifyTripTapToken(token, SECRET), { tripId: 't1', answer: 'booked' });
  const payload = Buffer.from(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  assert.doesNotMatch(payload, /@/);
  assert.deepEqual(Object.keys(JSON.parse(payload)).sort(), ['a', 'e', 't']);
});

test('tampering, a wrong secret, a bad answer and expiry are all rejected', async () => {
  const token = await signTripTapToken('t1', 'booked', SECRET);
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ t: 'other', a: 'booked', e: 9999999999 })).toString('base64url');
  assert.equal(await verifyTripTapToken(`${forged}.${sig}`, SECRET), null, 'payload swapped, signature kept');
  assert.equal(await verifyTripTapToken(`${payload}.${sig.slice(0, -2)}AA`, SECRET), null, 'signature altered');
  assert.equal(await verifyTripTapToken(token, 'another-secret'), null);
  assert.equal(await verifyTripTapToken('', SECRET), null);
  assert.equal(await verifyTripTapToken('not-a-token', SECRET), null);
  assert.equal(await verifyTripTapToken(token, ''), null);
  await assert.rejects(() => signTripTapToken('t1', 'maybe', SECRET));
  const now = Date.now();
  const old = await signTripTapToken('t1', 'booked', SECRET, now - 121 * DAY);
  assert.equal(await verifyTripTapToken(old, SECRET, now), null, 'older than 120 days');
  const fresh = await signTripTapToken('t1', 'booked', SECRET, now - 119 * DAY);
  assert.ok(await verifyTripTapToken(fresh, SECRET, now), 'inside 120 days');
});

test('a token made for one purpose never validates as another', async () => {
  const trip1 = await signTripTapToken('a@example.com', 'booked', SECRET);
  const unsub = await signUnsubscribeToken('a@example.com', SECRET);
  const react = await signReactivateToken('a@example.com', SECRET);
  assert.equal(await verifyTripTapToken(unsub, SECRET), null);
  assert.equal(await verifyTripTapToken(react, SECRET), null);
  assert.equal(await verifyUnsubscribeToken(trip1, SECRET), null);
  assert.equal(await verifyReactivateToken(trip1, SECRET), null);
});

// ---- route -------------------------------------------------------------------------------------

test('flag off: both methods 404 and nothing is written', async () => {
  const d1 = makeD1(); seed(d1);
  const token = await signTripTapToken('t1', 'booked', SECRET);
  const env = envOn(d1, { ENABLE_TRIP_SELF_REPORT: 'false' });
  assert.equal((await call(env, 'GET', token)).status, 404);
  assert.equal((await call(env, 'POST', token)).status, 404);
  assert.equal(trip(d1).booking_self_report, null);
});

test('GET shows the three choices on a noindex page and never changes state', async () => {
  const d1 = makeD1(); seed(d1);
  const token = await signTripTapToken('t1', 'not_going', SECRET);
  const res = await call(envOn(d1), 'GET', token);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /name="robots" content="noindex"/);
  for (const label of ['Booked', 'Not yet', 'Not going']) assert.match(html, new RegExp(`>${label}</button>`));
  assert.match(html, /your trip to Lisbon, Portugal/);
  assert.equal((html.match(/<form method="POST"/g) || []).length, 3);
  assert.equal(trip(d1).booking_self_report, null);
  assert.equal(trip(d1).self_reported_at, null);
  assert.equal(d1._db.prepare('SELECT COUNT(*) n FROM events').get().n, 0);
  // every form's token verifies and covers each answer once
  const answers = [];
  for (const m of html.matchAll(/action="\/api\/trip-status\?token=([^"]+)"/g)) answers.push((await verifyTripTapToken(decodeURIComponent(m[1]), SECRET)).answer);
  assert.deepEqual(answers.sort(), ['booked', 'not_going', 'not_yet']);
});

test('POST writes only the two new columns, logs the event, and is idempotent; the last answer wins', async () => {
  const d1 = makeD1(); seed(d1, { status: 'clicked' });
  const env = envOn(d1);
  const booked = await signTripTapToken('t1', 'booked', SECRET);
  assert.equal((await call(env, 'POST', booked)).status, 200);
  let row = trip(d1);
  assert.equal(row.booking_self_report, 'booked');
  assert.ok(row.self_reported_at);
  assert.equal(row.status, 'clicked', 'trips.status untouched');
  assert.equal(row.price_eur, null);
  assert.equal((await call(env, 'POST', booked)).status, 200);
  assert.equal(d1._db.prepare("SELECT COUNT(*) n FROM trips WHERE booking_self_report = 'booked'").get().n, 1);
  const notYet = await signTripTapToken('t1', 'not_yet', SECRET);
  const json = await call(env, 'POST', notYet, { accept: 'application/json' });
  assert.deepEqual(await json.json(), { ok: true, answer: 'not_yet' });
  assert.equal(trip(d1).booking_self_report, 'not_yet');
  const events = d1._db.prepare("SELECT sub_id, meta FROM events WHERE event_type = 'trip_self_report' ORDER BY rowid").all();
  assert.equal(events.length, 3);
  assert.equal(events[0].sub_id, 't1');
  assert.deepEqual(JSON.parse(events[0].meta), { answer: 'booked' });
});

test('POST ignores bots, rejects invalid tokens and unknown trips, and survives a missing column', async () => {
  const d1 = makeD1(); seed(d1);
  const env = envOn(d1);
  const token = await signTripTapToken('t1', 'booked', SECRET);
  const bot = await call(env, 'POST', token, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: 'application/json' });
  assert.deepEqual(await bot.json(), { ok: true, ignored: true });
  assert.equal(trip(d1).booking_self_report, null);
  assert.equal(d1._db.prepare('SELECT COUNT(*) n FROM events').get().n, 0);
  assert.equal((await call(env, 'POST', 'garbage')).status, 400);
  assert.equal((await call(env, 'POST', undefined)).status, 400);
  const unknown = await signTripTapToken('no-such-trip', 'booked', SECRET);
  assert.equal((await call(env, 'POST', unknown)).status, 400);
  const noCols = makeD1({ withColumns: false }); seed(noCols);
  const res = await call(envOn(noCols), 'POST', token, { accept: 'application/json' });
  assert.equal(res.status, 503);
});

test('a later paid action still flips clicked to booked after a self-report of booked', async () => {
  const d1 = makeD1(); seed(d1);
  await call(envOn(d1), 'POST', await signTripTapToken('t1', 'booked', SECRET));
  assert.equal(trip(d1).status, 'clicked');
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('travelpayouts.com')) return new Response(JSON.stringify({ results: [{ sub_id: 't1', state: 'paid', price_eur: 123.4 }] }), { status: 200 });
    return original(url);
  };
  try {
    const out = await reconcileBookings({ DB: d1, TRAVELPAYOUTS_TOKEN: 'tok' });
    assert.equal(out.updated, 1);
  } finally { globalThis.fetch = original; }
  const row = trip(d1);
  assert.equal(row.status, 'booked');
  assert.equal(row.price_eur, 123.4);
  assert.equal(row.booking_self_report, 'booked', 'the self-report is kept');
});

// ---- email -------------------------------------------------------------------------------------

async function stressHtml(env) {
  const original = globalThis.fetch;
  let html = null;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('api.resend.com/emails')) { html = JSON.parse(options.body).html; return new Response(JSON.stringify({ id: 'x' }), { status: 200 }); }
    return original(url, options);
  };
  try {
    await sendStressValveEmail({ email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-11-27T10:00:00-05:00', trip_id: 't1' }, { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', ...env });
    return html;
  } finally { globalThis.fetch = original; }
}

test('stress-valve email: links only with the flag on, the secret and a trip id; unchanged otherwise', async () => {
  const baseline = await stressHtml({});
  assert.doesNotMatch(baseline, /Did this trip happen|trip-status/);
  assert.doesNotMatch(await stressHtml({ UNSUBSCRIBE_SECRET: SECRET, ENABLE_TRIP_SELF_REPORT: 'false' }), /Did this trip happen/);
  assert.doesNotMatch(await stressHtml({ ENABLE_TRIP_SELF_REPORT: 'true' }), /Did this trip happen/, 'no secret, no links');
  const on = await stressHtml({ UNSUBSCRIBE_SECRET: SECRET, ENABLE_TRIP_SELF_REPORT: 'true' });
  assert.match(on, /Did this trip happen\?/);
  assert.match(on, /One tap, so we only send what's useful\./);
  const answers = [];
  for (const m of on.matchAll(/href="https:\/\/sparkfare\.com\/api\/trip-status\?token=([^"]+)"/g)) answers.push((await verifyTripTapToken(decodeURIComponent(m[1]), SECRET)).answer);
  assert.deepEqual(answers.sort(), ['booked', 'not_going', 'not_yet']);
  assert.ok(on.indexOf('Sparkfare may earn a commission') < on.indexOf('Did this trip happen'), 'disclosure stays first');
  assert.ok(on.indexOf('Did this trip happen') < on.search(/href="[^"]*\/(out|go)\//), 'the question sits above the partner list');
  assert.doesNotMatch(on, /secured|locked in|guaranteed/i);
});

// ---- suppression -------------------------------------------------------------------------------

function deliveries(d1, table) {
  try { return d1._db.prepare(`SELECT trip_id FROM ${table} ORDER BY trip_id`).all().map((r) => r.trip_id); } catch { return []; }
}

test('departure briefing, departing soon and the pre-departure sequence skip not_going trips only', async () => {
  const d1 = makeD1();
  seed(d1, { tripId: 'brief-ok', userId: 'u1', email: 'a@example.com', departInDays: 7 });
  seed(d1, { tripId: 'brief-no', userId: 'u2', email: 'b@example.com', departInDays: 7, selfReport: 'not_going' });
  seed(d1, { tripId: 'brief-yet', userId: 'u3', email: 'c@example.com', departInDays: 7, selfReport: 'not_yet' });
  const env = { DB: d1, ENABLE_T2B_SEQUENCE: 'true' };
  await sendDepartureBriefingAlerts(env);
  assert.deepEqual(deliveries(d1, 'departure_briefing_deliveries'), ['brief-ok', 'brief-yet']);
  await sendPreDepartureSequenceAlerts(env);
  assert.deepEqual(deliveries(d1, 'pre_departure_sequence_deliveries'), ['brief-ok', 'brief-yet']);

  const soon = makeD1();
  seed(soon, { tripId: 'soon-ok', userId: 'u1', email: 'a@example.com', departInDays: 2 });
  seed(soon, { tripId: 'soon-no', userId: 'u2', email: 'b@example.com', departInDays: 2, selfReport: 'not_going' });
  await sendDepartingSoonAlerts({ DB: soon });
  assert.deepEqual(deliveries(soon, 'departing_soon_deliveries'), ['soon-ok']);
});

test('without the migration the alert queries still run (no filter, no crash)', async () => {
  const d1 = makeD1({ withColumns: false });
  seed(d1, { tripId: 'brief-ok', departInDays: 7 });
  await sendDepartureBriefingAlerts({ DB: d1 });
  assert.deepEqual(deliveries(d1, 'departure_briefing_deliveries'), ['brief-ok']);
});

// ---- metrics -----------------------------------------------------------------------------------

test('/admin metrics count self-reports next to the Travelpayouts booked figure', async () => {
  const d1 = makeD1();
  seed(d1, { tripId: 'a', userId: 'u1', email: 'a@example.com', selfReport: 'booked', status: 'booked' });
  seed(d1, { tripId: 'b', userId: 'u2', email: 'b@example.com', selfReport: 'booked' });
  seed(d1, { tripId: 'c', userId: 'u3', email: 'c@example.com', selfReport: 'not_yet' });
  seed(d1, { tripId: 'd', userId: 'u4', email: 'd@example.com', selfReport: 'not_going' });
  const kpi = await computeKPIs({ DB: d1 });
  assert.deepEqual(kpi.trip_self_reports, {
    booked: 2, not_yet: 1, not_going: 1, self_booked_and_travelpayouts_booked: 1, self_booked_not_yet_confirmed: 1, travelpayouts_booked: 1,
  });
  const noCols = await computeKPIs({ DB: makeD1({ withColumns: false }) });
  assert.equal(noCols.trip_self_reports.booked, 0, 'missing columns degrade to zero');
});
