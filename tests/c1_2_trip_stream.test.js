// C1.2 / C1.3: trip stream v2. Real SQLite; Resend stubbed at the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { runTripStream, sendDepartingSoonAlerts, sendStressValveAlerts, sendDepartureBriefingAlerts, sendPreDepartureSequenceAlerts, collectDigestAlerts, commitMergedAlerts } from '../src/index.js';
import { stageDueToday, offsetsFor, tripStreamV2Enabled, V2_ANSWER_LABELS } from '../src/tripStream.js';
import { sendAwayModeFollowUpEmail } from '../src/email.js';

const DAY = 86400000;
const iso = (d) => new Date(Date.now() + d * DAY).toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, unsubscribed_at TEXT, paused_until TEXT, partner_id TEXT,
      trip_length TEXT, passenger_count INTEGER, is_subscribed INTEGER DEFAULT 1);
    CREATE TABLE trips (trip_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, destination TEXT NOT NULL, origin_iata TEXT NOT NULL,
      departure_at TEXT NOT NULL, return_at TEXT, price_at_click INTEGER NOT NULL, clicked_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'clicked', price_eur REAL, booking_self_report TEXT, self_reported_at TEXT);
  `);
  const st = (sql, p) => ({
    run: async () => { const r = db.prepare(sql).run(...p); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...p) }),
  });
  return { _db: db, prepare: (sql) => ({ ...st(sql, []), bind: (...p) => st(sql, p) }) };
}
function seed(d1, { id = 't1', dep = 21, ret = null, report = 'booked', tripLength = null, email = 'a@example.com', user = 'u1' } = {}) {
  d1._db.prepare('INSERT OR IGNORE INTO users (id, email, trip_length) VALUES (?, ?, ?)').run(user, email, tripLength);
  d1._db.prepare('INSERT INTO trips (trip_id, user_id, destination, origin_iata, departure_at, return_at, price_at_click, booking_self_report) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, user, 'Lisbon, Portugal', 'JFK', iso(dep), ret === null ? null : iso(ret), 500, report);
}
const env = (d1, extra = {}) => ({ DB: d1, UNSUBSCRIBE_SECRET: 's', ENABLE_TRIP_SELF_REPORT: 'true', ENABLE_TRIP_STREAM_V2: 'true', RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com', ...extra });

async function withResend(fn) {
  const real = globalThis.fetch; const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'e' + sent.length }), { status: 200, headers: { 'content-type': 'application/json' } }); }
    return real(url, init);
  };
  try { return await fn(sent); } finally { globalThis.fetch = real; }
}

test('schedule: 21, 7, 1 for a short trip; 30, 14, 7 for 2+ weeks and 30_plus; return day', () => {
  assert.deepEqual(offsetsFor(null), [21, 7, 1]);
  assert.deepEqual(offsetsFor('7-10'), [21, 7, 1]);
  assert.deepEqual(offsetsFor('2+ weeks'), [30, 14, 7]);
  assert.deepEqual(offsetsFor('30_plus'), [30, 14, 7]);
  const t = '2026-11-01';
  const dep = (n) => new Date(Date.parse(t + 'T00:00:00Z') + n * DAY).toISOString();
  assert.equal(stageDueToday({ departure_at: dep(21) }, t).stage, 'd21');
  assert.equal(stageDueToday({ departure_at: dep(7) }, t).position, 1);
  assert.equal(stageDueToday({ departure_at: dep(1) }, t).position, 2);
  assert.equal(stageDueToday({ departure_at: dep(14) }, t), null);
  assert.equal(stageDueToday({ departure_at: dep(30), trip_length: '30_plus' }, t).stage, 'd30');
  assert.equal(stageDueToday({ departure_at: dep(21), trip_length: '30_plus' }, t), null);
  assert.equal(stageDueToday({ departure_at: dep(-8), return_at: dep(0) }, t).stage, 'return');
  assert.equal(stageDueToday({ departure_at: 'junk' }, t), null);
});

test('flag: off unless the exact string and the self-report flag are both on; labels are Yes / Still deciding / Not going', () => {
  assert.equal(tripStreamV2Enabled({ ENABLE_TRIP_STREAM_V2: 'true' }), false);
  assert.equal(tripStreamV2Enabled({ ENABLE_TRIP_SELF_REPORT: 'true', ENABLE_TRIP_STREAM_V2: 'yes' }), false);
  assert.equal(tripStreamV2Enabled({ ENABLE_TRIP_SELF_REPORT: 'true', ENABLE_TRIP_STREAM_V2: 'true' }), true);
  assert.deepEqual(V2_ANSWER_LABELS, { booked: 'Yes', not_yet: 'Still deciding', not_going: 'Not going' });
});

test('only a Yes starts the stream: still deciding, not going and no answer get nothing', async () => {
  const d1 = makeD1();
  seed(d1, { id: 'a', report: 'booked', user: 'u1', email: 'a@example.com' });
  seed(d1, { id: 'b', report: 'not_yet', user: 'u2', email: 'b@example.com' });
  seed(d1, { id: 'c', report: 'not_going', user: 'u3', email: 'c@example.com' });
  seed(d1, { id: 'd', report: null, user: 'u4', email: 'd@example.com' });
  await withResend(async (sent) => {
    const r = await runTripStream(env(d1));
    assert.equal(r.sent, 1);
    assert.deepEqual(sent.map((m) => m.to).flat(), ['a@example.com']);
    assert.match(sent[0].subject, /Lisbon, Portugal is 21 days out/);
    assert.doesNotMatch(sent[0].html, /\b2026-/);
  });
});

test('a stage is sent once; a second run the same day sends nothing', async () => {
  const d1 = makeD1(); seed(d1);
  await withResend(async (sent) => {
    assert.equal((await runTripStream(env(d1))).sent, 1);
    assert.equal((await runTripStream(env(d1))).sent, 0);
    assert.equal(sent.length, 1);
  });
});

test('return day sends the welcome-back note with no partner link', async () => {
  const d1 = makeD1(); seed(d1, { dep: -8, ret: 0 });
  await withResend(async (sent) => {
    assert.equal((await runTripStream(env(d1))).sent, 1);
    assert.match(sent[0].subject, /Welcome back from Lisbon, Portugal/);
    assert.doesNotMatch(sent[0].html, /\/out\/|\/go\//);
  });
});

test('flag off: nothing sent and the legacy emails still run their own logic', async () => {
  const d1 = makeD1(); seed(d1);
  await withResend(async (sent) => {
    const off = env(d1, { ENABLE_TRIP_STREAM_V2: 'false' });
    assert.equal((await runTripStream(off)).sent, 0);
    assert.equal(sent.length, 0);
    assert.notEqual((await sendDepartingSoonAlerts(off)).reason, 'replaced by the trip stream (ENABLE_TRIP_STREAM_V2)');
  });
});

test('flag on: the four legacy trip emails are replaced', async () => {
  const d1 = makeD1(); seed(d1, { dep: 2 });
  await withResend(async (sent) => {
    const on = env(d1, { ENABLE_T2B_SEQUENCE: 'true' });
    for (const fn of [sendDepartingSoonAlerts, sendStressValveAlerts, sendDepartureBriefingAlerts, sendPreDepartureSequenceAlerts]) {
      const r = await fn(on);
      assert.equal(r.sent, 0); assert.match(r.reason, /trip stream/);
    }
    assert.equal(sent.length, 0);
  });
});

test('checklist email asks "Got your ticket?" with three tap links when on, and not when off', async () => {
  const d1 = makeD1();
  const args = { email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: iso(40), return_at: iso(47), origin_iata: 'JFK', price_at_click: 500, booking_link: 'https://www.aviasales.com/search/x', trip_id: 't1' };
  await withResend(async (sent) => {
    await sendAwayModeFollowUpEmail(args, env(d1));
    const html = sent[0].html;
    assert.match(html, /Got your ticket\?/);
    assert.equal((html.match(/\/api\/trip-status\?token=/g) || []).length, 3);
    for (const l of ['Yes', 'Still deciding', 'Not going']) assert.ok(html.includes(l));
    await sendAwayModeFollowUpEmail(args, env(d1, { ENABLE_TRIP_STREAM_V2: 'false' }));
    assert.doesNotMatch(sent[1].html, /Got your ticket/);
  });
});

test('digest day: the due stage is a top block of the digest and the separate email is skipped once committed', async () => {
  const d1 = makeD1(); seed(d1);
  const e = env(d1, { ENABLE_EMAIL_V2: 'true' });
  const merged = await collectDigestAlerts(e);
  const entry = merged.get('a@example.com');
  assert.equal(entry.tripDue.length, 1);
  assert.match(entry.blocks[0].heading, /21 days out/);
  await withResend(async (sent) => {
    await commitMergedAlerts(e, entry);
    assert.equal((await runTripStream(e)).sent, 0);
    assert.equal(sent.length, 0);
  });
});

test('migration 0046 matches the runtime table', () => {
  const sql = fs.readFileSync(new URL('../migrations/0046_trip_stream_deliveries.sql', import.meta.url), 'utf8');
  assert.match(sql, /PRIMARY KEY \(trip_id, stage\)/);
});
