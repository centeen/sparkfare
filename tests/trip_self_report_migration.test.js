// Away Move 2 (ROADMAP step 70), migration 0016: two nullable columns on trips, nothing else touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = readFileSync(new URL('../migrations/0016_trip_self_report.sql', import.meta.url), 'utf8');
const LIVE_TRIPS = `CREATE TABLE trips (trip_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, destination TEXT NOT NULL,
  origin_iata TEXT NOT NULL, departure_at TEXT NOT NULL, return_at TEXT, price_at_click INTEGER NOT NULL,
  clicked_at TEXT DEFAULT (datetime('now')), status TEXT DEFAULT 'clicked', price_eur REAL, hotel_name TEXT,
  tour_name TEXT, event_name TEXT, is_open INTEGER DEFAULT 0)`;
const cols = (db) => db.prepare("SELECT name FROM pragma_table_info('trips')").all().map((r) => r.name);

test('0016 is the next free migration number and has a rollback note', () => {
  const nums = readdirSync(new URL('../migrations/', import.meta.url)).map((f) => f.slice(0, 4));
  assert.equal(nums.filter((n) => n === '0016').length, 1);
  assert.match(sql, /Rollback:/);
});

test('on a live-shaped trips table: adds exactly the two columns, keeps rows, changes no other column', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(LIVE_TRIPS);
  db.exec("INSERT INTO trips (trip_id,user_id,destination,origin_iata,departure_at,price_at_click,status,price_eur) VALUES ('t1','u1','Lisbon','JFK','2026-11-27',500,'booked',412.5)");
  const before = cols(db);
  db.exec(sql);
  assert.deepEqual(cols(db).filter((c) => !before.includes(c)).sort(), ['booking_self_report', 'self_reported_at']);
  const row = db.prepare('SELECT * FROM trips').get();
  assert.equal(row.status, 'booked');
  assert.equal(row.price_eur, 412.5);
  assert.equal(row.booking_self_report, null);
  assert.equal(row.self_reported_at, null);
});

test('on a fresh database (no trips table) the file still applies', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  assert.ok(cols(db).includes('booking_self_report'));
});

test('only booked, not_yet, not_going (or NULL) can be stored; a self-report never needs trips.status', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  db.exec("INSERT INTO trips (trip_id,user_id,destination,origin_iata,departure_at,price_at_click) VALUES ('t1','u1','X','JFK','2026-11-27',1)");
  for (const v of ['booked', 'not_yet', 'not_going', null]) {
    db.prepare('UPDATE trips SET booking_self_report = ? WHERE trip_id = ?').run(v, 't1');
  }
  assert.throws(() => db.prepare("UPDATE trips SET booking_self_report = 'maybe' WHERE trip_id = 't1'").run(), /CHECK/);
  assert.equal(db.prepare('SELECT status FROM trips').get().status, 'clicked');
  assert.doesNotMatch(sql, /\bstatus\s*=|UPDATE\s+trips/i, 'the migration must not write trips.status or any row');
});

test('the rollback statements in the file work', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  db.exec('ALTER TABLE trips DROP COLUMN self_reported_at');
  db.exec('ALTER TABLE trips DROP COLUMN booking_self_report');
  assert.ok(!cols(db).includes('booking_self_report') && !cols(db).includes('self_reported_at'));
});
