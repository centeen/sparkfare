// Away Move 3, migration 0017: one nullable JSON column on users, nothing else touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = readFileSync(new URL('../migrations/0017_leave_answers.sql', import.meta.url), 'utf8');
const base = readFileSync(new URL('../migrations/0000_base_schema.sql', import.meta.url), 'utf8');
const cols = (db) => db.prepare("SELECT name FROM pragma_table_info('users')").all().map((r) => r.name);

test('0017 is the only migration with that number and has a rollback note', () => {
  const nums = readdirSync(new URL('../migrations/', import.meta.url)).map((f) => f.slice(0, 4));
  assert.equal(nums.filter((n) => n === '0017').length, 1);
  assert.match(sql, /Rollback:/);
});

test('on the base users table: adds exactly leave_answers, keeps rows, changes nothing else', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(base);
  db.prepare("INSERT INTO users (id, email) VALUES ('u1', 'a@example.com')").run();
  const before = cols(db);
  db.exec(sql);
  assert.deepEqual(cols(db).filter((c) => !before.includes(c)), ['leave_answers']);
  assert.deepEqual({ ...db.prepare('SELECT id, email, leave_answers FROM users').get() }, { id: 'u1', email: 'a@example.com', leave_answers: null });
});

test('only NULL or valid JSON can be stored', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(base);
  db.exec(sql);
  db.prepare("INSERT INTO users (id, email) VALUES ('u1', 'a@example.com')").run();
  const set = (v) => db.prepare("UPDATE users SET leave_answers = ? WHERE id = 'u1'").run(v);
  set(JSON.stringify({ length: 'month_plus', pets: 'yes', plants: 'no', checkin: 'yes', mail: 'no', water: 'yes' }));
  set(null);
  assert.throws(() => set('not json {'), /CHECK/);
});

test('the rollback statement in the file works', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(base);
  db.exec(sql);
  db.exec('ALTER TABLE users DROP COLUMN leave_answers');
  assert.ok(!cols(db).includes('leave_answers'));
});
