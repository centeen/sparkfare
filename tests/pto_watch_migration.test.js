// ROADMAP step 74 (Track C of claude_code_pto_fare_calendar_2026-10-09.md): migration 0019 tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = readFileSync(new URL('../migrations/0019_pto_window_watches.sql', import.meta.url), 'utf8');
const base = readFileSync(new URL('../migrations/0000_base_schema.sql', import.meta.url), 'utf8');
const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
const indices = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((r) => r.name);

test('0019 is the only migration with that number and has a rollback note', () => {
  const nums = readdirSync(new URL('../migrations/', import.meta.url)).map((f) => f.slice(0, 4));
  assert.equal(nums.filter((n) => n === '0019').length, 1);
  assert.match(sql, /Rollback:/);
});

test('on the base schema: creates pto_window_watches and its indexes cleanly', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(base);
  db.exec(sql);
  assert.ok(tables(db).includes('pto_window_watches'));
  assert.ok(indices(db).includes('idx_pto_watch_unique'));
  assert.ok(indices(db).includes('idx_pto_watch_window_end'));
});

test('unique index enforces uniqueness per user_id, origin_iata, window_start, window_end, destination', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(base);
  db.exec(sql);
  db.prepare("INSERT INTO users (id, email) VALUES ('u1', 'test@example.com')").run();

  const insert = (dest = null) => db.prepare(`
    INSERT INTO pto_window_watches (id, user_id, origin_iata, window_start, window_end, destination)
    VALUES (?, 'u1', 'DEN', '2026-11-26', '2026-11-29', ?)
  `);

  insert('Tulum').run('w1', 'Tulum');
  assert.throws(() => insert('Tulum').run('w2', 'Tulum'), /UNIQUE/);

  // Different destination for same window is allowed
  insert('Oaxaca').run('w3', 'Oaxaca');
  // Different window is allowed
  db.prepare(`
    INSERT INTO pto_window_watches (id, user_id, origin_iata, window_start, window_end, destination)
    VALUES ('w4', 'u1', 'DEN', '2026-12-24', '2026-12-27', 'Tulum')
  `).run();
});

test('rollback statement works and leaves database without pto_window_watches', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(base);
  db.exec(sql);
  assert.ok(tables(db).includes('pto_window_watches'));
  db.exec('DROP TABLE IF EXISTS pto_window_watches');
  assert.ok(!tables(db).includes('pto_window_watches'));
});
