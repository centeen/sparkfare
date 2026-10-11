// The route retrospective ("Hope X was worth the trip") only goes to trips known to be booked: a confirmed paid
// booking (trips.status = 'booked') or a traveler who said they booked, never a plain click and never a trip they
// said they are not taking. Runs the real query text against real SQLite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { allBookedTrips } from '../src/tripSelfReport.js';

function envFor(db) {
  return {
    DB: {
      prepare(sql) {
        return { all: async () => ({ results: db.prepare(sql).all() }) };
      },
    },
  };
}

const BASE = `
  SELECT trips.trip_id AS trip_id FROM trips
  JOIN users ON users.id = trips.user_id
  WHERE users.unsubscribed_at IS NULL AND trips.return_at IS NOT NULL
`;

function seed({ withSelfReport = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, unsubscribed_at TEXT)`);
  db.exec(`CREATE TABLE trips (trip_id TEXT PRIMARY KEY, user_id TEXT, status TEXT, return_at TEXT${withSelfReport ? ', booking_self_report TEXT' : ''})`);
  db.prepare(`INSERT INTO users (id, email) VALUES ('u1', 'a@example.com')`).run();
  const rows = [
    ['clicked_only', 'clicked', null],
    ['paid', 'booked', null],
    ['said_booked', 'clicked', 'booked'],
    ['said_not_yet', 'clicked', 'not_yet'],
    ['said_not_going', 'clicked', 'not_going'],
    ['paid_then_not_going', 'booked', 'not_going'],
  ];
  for (const [id, status, report] of rows) {
    if (withSelfReport) db.prepare(`INSERT INTO trips (trip_id, user_id, status, return_at, booking_self_report) VALUES (?, 'u1', ?, '2026-11-01', ?)`).run(id, status, report);
    else db.prepare(`INSERT INTO trips (trip_id, user_id, status, return_at) VALUES (?, 'u1', ?, '2026-11-01')`).run(id, status);
  }
  return db;
}

test('only paid or self-reported bookings are selected; clicks and not-going are left out', async () => {
  const r = await allBookedTrips(envFor(seed()), BASE);
  assert.deepEqual(r.results.map((x) => x.trip_id).sort(), ['paid', 'said_booked']);
});

test('if booking_self_report does not exist yet, falls back to confirmed bookings only', async () => {
  const r = await allBookedTrips(envFor(seed({ withSelfReport: false })), BASE);
  assert.deepEqual(r.results.map((x) => x.trip_id).sort(), ['paid', 'paid_then_not_going']);
});

test('an unrelated database error is not swallowed', async () => {
  const env = { DB: { prepare() { return { all: async () => { throw new Error('D1 is down'); } }; } } };
  await assert.rejects(() => allBookedTrips(env, BASE), /D1 is down/);
});

test('sendRouteRetrospectives selects its trips through allBookedTrips', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = src.indexOf('export async function sendRouteRetrospectives');
  const end = src.indexOf('\nexport async function ', start + 10) > 0 ? src.indexOf('\nexport async function ', start + 10) : start + 4000;
  const body = src.slice(start, Math.min(end, start + 6000));
  assert.match(body, /await allBookedTrips\(env,/);
  assert.doesNotMatch(body.slice(0, body.indexOf('trips.return_at IS NOT NULL')), /env\.DB\.prepare\(`\s*SELECT trips\.trip_id/);
});
