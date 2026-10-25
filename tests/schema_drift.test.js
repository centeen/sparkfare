// N7 (Addendum N): the schema lives in migrations/. A database built from them must match the checked-in snapshot, and nothing in
// src/ may create a table or add a column that the migrations do not also define. Production is compared with the same
// snapshot by hand (`node scripts/data/schema-snapshot.mjs check-prod`, read-only) because CI has no production access.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describeSchema, freshDatabaseFromMigrations, readSnapshot, migrationFiles } from '../scripts/data/schema-snapshot.mjs';

const db = freshDatabaseFromMigrations();
const tablesIn = () => new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
const columnsOf = (t) => new Set(db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name));

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(js|mjs)$/.test(e.name) ? [p] : [];
  });
}
const SRC = sourceFiles('src').map((p) => [p, fs.readFileSync(p, 'utf8')]);

test('a database built from the migrations matches the checked-in snapshot', () => {
  const built = describeSchema(db);
  if (built !== readSnapshot()) {
    const a = new Set(readSnapshot().split('\n')); const b = new Set(built.split('\n'));
    const onlySnapshot = [...a].filter((l) => l && !b.has(l));
    const onlyBuilt = [...b].filter((l) => l && !a.has(l));
    assert.fail(`The migrations no longer build the schema in schema/schema.snapshot.sql. If you changed the schema on purpose, run \`node scripts/data/schema-snapshot.mjs write\` and commit the new snapshot with your migration.\n  only in the snapshot: ${onlySnapshot.slice(0, 6).join(' | ')}\n  only from the migrations: ${onlyBuilt.slice(0, 6).join(' | ')}`);
  }
});

test('the eight tables that used to exist only in production are now created by a migration', () => {
  const have = tablesIn();
  for (const t of ['away_mode_clicks', 'away_mode_email_log', 'daily_alert_deliveries', 'departing_soon_deliveries', 'departure_briefing_deliveries', 'early_bird_snapshots', 'route_retrospective_deliveries', 'stress_valve_deliveries']) {
    assert.ok(have.has(t), `${t} must be created by a migration`);
  }
});

test('every table src/ creates at runtime is also created by a migration', () => {
  const have = tablesIn();
  const missing = [];
  for (const [file, text] of SRC) {
    for (const m of text.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)\s*\(/gi)) {
      if (!have.has(m[1])) missing.push(`${m[1]} (${file})`);
    }
  }
  assert.deepEqual(missing, [], `A table is created in src/ but no migration creates it. Add a migration (then \`node scripts/data/schema-snapshot.mjs write\`): ${missing.join(', ')}`);
});

test('every column src/ adds at runtime is also added by a migration', () => {
  const missing = [];
  for (const [file, text] of SRC) {
    for (const m of text.matchAll(/ALTER TABLE\s+([a-z_][a-z0-9_]*)\s+ADD COLUMN\s+([a-z_][a-z0-9_]*)/gi)) {
      if (!tablesIn().has(m[1]) || !columnsOf(m[1]).has(m[2])) missing.push(`${m[1]}.${m[2]} (${file})`);
    }
  }
  assert.deepEqual(missing, [], `A column is added in src/ but no migration adds it: ${missing.join(', ')}`);
});

test('the snapshot ignores only wrangler and SQLite bookkeeping, and covers every table and index', () => {
  const snap = readSnapshot();
  assert.doesNotMatch(snap, /d1_migrations|sqlite_|_cf_/);
  assert.equal((snap.match(/^CREATE TABLE /gm) || []).length, [...tablesIn()].filter((t) => !/^(sqlite_|_cf_)/.test(t)).length);
  assert.ok((snap.match(/^CREATE (UNIQUE )?INDEX /gm) || []).length >= 11, 'the indexes are part of the snapshot');
});

test('migration files are numbered without gaps or duplicates', () => {
  const nums = migrationFiles().map((f) => Number(f.slice(0, 4)));
  assert.ok(nums.every((n) => Number.isInteger(n)));
  assert.equal(new Set(nums).size, nums.length, 'two migrations share a number');
  nums.forEach((n, i) => assert.equal(n, i, `migration numbering has a gap or an extra file near ${String(n).padStart(4, '0')}`));
});

test('BOOLEAN and INTEGER columns compare equal (production has users.is_subscribed as INTEGER, migration 0001 says BOOLEAN)', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const a = new DatabaseSync(':memory:'); const b = new DatabaseSync(':memory:');
  a.exec('CREATE TABLE t (id TEXT PRIMARY KEY, flag BOOLEAN DEFAULT 1)');
  b.exec('CREATE TABLE t (id TEXT PRIMARY KEY, flag INTEGER DEFAULT 1)');
  assert.equal(describeSchema(a), describeSchema(b));
  b.exec('CREATE TABLE u (x TEXT)'); // a real difference still shows
  assert.notEqual(describeSchema(a), describeSchema(b));
});
