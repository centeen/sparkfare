import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ensureUserRow } from '../src/index.js';

// /api/trips inserts into trips, whose user_id REFERENCES users(id). A signed-in Clerk user with no
// users row (never submitted the alert form, or a new production-instance id) used to fail the
// foreign key and the frontend showed "Something went wrong tracking this trip". Runs against real
// SQLite with foreign keys enforced, like D1.

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, verified_email INTEGER DEFAULT 0);
    CREATE TABLE trips (trip_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), destination TEXT);
  `);
  const stmt = (sql, params) => ({
    run: async () => { db.prepare(sql).run(...params); return { success: true }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    _exec: () => db.prepare(sql).run(...params),
  });
  return {
    _db: db,
    prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }),
    batch: async (stmts) => {
      db.exec('BEGIN');
      try { stmts.forEach((s) => s._exec()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

const session = (id, email = null) => ({ authenticated: true, user: { id, email } });
const insertTrip = (d1, userId) =>
  d1._db.prepare("INSERT INTO trips (trip_id, user_id, destination) VALUES ('t1', ?, 'Lisbon')").run(userId);

test('without a users row the trip insert fails the foreign key (the bug)', () => {
  const d1 = makeD1();
  assert.throws(() => insertTrip(d1, 'user_new'), /FOREIGN KEY/);
});

test('ensureUserRow creates the row, looking the email up when the token has none', async () => {
  const d1 = makeD1();
  await ensureUserRow({ DB: d1 }, session('user_new'), async () => 'New@Example.com');
  assert.deepEqual({ ...d1._db.prepare('SELECT * FROM users').get() }, { id: 'user_new', email: 'new@example.com', verified_email: 1 });
  insertTrip(d1, 'user_new');
});

test('ensureUserRow is a no-op when the row exists and never calls the lookup', async () => {
  const d1 = makeD1();
  d1._db.prepare("INSERT INTO users (id, email) VALUES ('user_a', 'a@example.com')").run();
  await ensureUserRow({ DB: d1 }, session('user_a'), async () => { throw new Error('should not look up'); });
  assert.equal(d1._db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
});

test('same email under an old id: re-keys the user and its trips to the new id', async () => {
  const d1 = makeD1();
  d1._db.prepare("INSERT INTO users (id, email) VALUES ('user_old', 'me@example.com')").run();
  insertTrip(d1, 'user_old');
  await ensureUserRow({ DB: d1 }, session('user_new', 'me@example.com'), async () => null);
  assert.deepEqual(d1._db.prepare('SELECT id FROM users').all().map((r) => r.id), ['user_new']);
  assert.equal(d1._db.prepare("SELECT user_id FROM trips WHERE trip_id = 't1'").get().user_id, 'user_new');
});

test('throws when no email can be determined', async () => {
  await assert.rejects(ensureUserRow({ DB: makeD1() }, session('user_x'), async () => null), /email/);
});

test('no DB configured is a no-op', async () => {
  await ensureUserRow({}, session('user_x'));
});
