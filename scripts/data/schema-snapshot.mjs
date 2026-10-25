// N7 (Addendum N, ROADMAP step 154; framework DR-04): one expected schema, and a way to prove production still matches it.
//
// The snapshot (schema/schema.snapshot.sql) is the structure of a database built from migrations/ alone: every table with its
// columns (sorted by name, so the order a column was added in does not matter), every index, nothing else. CI applies all
// migrations to a fresh database and fails if the result differs from the checked-in snapshot, so a schema change needs a
// migration AND a deliberate snapshot update in the same pull request.
//
//   node scripts/data/schema-snapshot.mjs write        regenerate the snapshot from the migrations (after adding a migration)
//   node scripts/data/schema-snapshot.mjs check-prod   read-only: compare production (via wrangler) with the snapshot
//
// BOOLEAN is read as INTEGER: SQLite stores both as 0 or 1, and production has users.is_subscribed as INTEGER (added by hand on
// 2026-09-13) where migration 0001 says BOOLEAN. Editing an applied migration to match would change nothing in production.
//
// Limits (stated, not hidden): it compares tables, column names, types, NOT NULL, defaults, primary keys, and indexes with their
// columns and uniqueness. It does not compare CHECK, UNIQUE or FOREIGN KEY clauses written inside a CREATE TABLE, or data.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SNAPSHOT_PATH = path.join(ROOT, 'schema', 'schema.snapshot.sql');
// Tables that exist in a Cloudflare database but are not ours: wrangler's migration bookkeeping, SQLite and Cloudflare internals.
const IGNORED = (name) => /^(sqlite_|_cf_)/.test(name) || name === 'd1_migrations';

export function migrationFiles() {
  return fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
}

export function freshDatabaseFromMigrations() {
  const db = new DatabaseSync(':memory:');
  for (const f of migrationFiles()) db.exec(fs.readFileSync(path.join(ROOT, 'migrations', f), 'utf8'));
  return db;
}

const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const normalizeType = (type) => (/^BOOLEAN$/i.test(type || '') ? 'INTEGER' : (type || ''));

/** Canonical, order-independent description of a database's structure. */
export function describeSchema(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name).filter((n) => !IGNORED(n));
  const out = [
    '-- Expected database schema: what migrations/ builds. Regenerate with `node scripts/data/schema-snapshot.mjs write`.',
    '-- Columns are sorted by name. See the header of scripts/data/schema-snapshot.mjs for what is and is not compared.',
    '',
  ];
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info(${q(t)})`).all().sort((a, b) => a.name.localeCompare(b.name));
    const lines = cols.map((c) => `  ${q(c.name)} ${normalizeType(c.type)}${c.pk ? ` PRIMARY KEY(${c.pk})` : ''}${c.notnull ? ' NOT NULL' : ''}${c.dflt_value != null ? ` DEFAULT ${c.dflt_value}` : ''}`.replace(/\s+$/, ''));
    out.push(`CREATE TABLE ${q(t)} (`, lines.join(',\n'), ');');
    const indexes = db.prepare(`PRAGMA index_list(${q(t)})`).all().filter((i) => i.origin === 'c').sort((a, b) => a.name.localeCompare(b.name));
    for (const i of indexes) {
      const cols2 = db.prepare(`PRAGMA index_info(${q(i.name)})`).all().sort((a, b) => a.seqno - b.seqno).map((c) => q(c.name)).join(', ');
      out.push(`CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX ${q(i.name)} ON ${q(t)} (${cols2});`);
    }
    out.push('');
  }
  return out.join('\n');
}

/** Production's structure, rebuilt locally from its sqlite_master (read-only: one SELECT through wrangler). */
export function describeProduction() {
  const wrangler = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const raw = execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'sparkfare-db', '--remote', '--json', '--command',
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type DESC, name"],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const rows = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;
  const db = new DatabaseSync(':memory:');
  for (const r of rows.filter((x) => x.type === 'table')) db.exec(r.sql);
  for (const r of rows.filter((x) => x.type === 'index')) db.exec(r.sql);
  return describeSchema(db);
}

export function readSnapshot() {
  return fs.readFileSync(SNAPSHOT_PATH, 'utf8').replace(/\r\n/g, '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cmd = process.argv[2];
  if (cmd === 'write') {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, describeSchema(freshDatabaseFromMigrations()));
    console.log(`wrote ${path.relative(ROOT, SNAPSHOT_PATH)}`);
  } else if (cmd === 'check-prod') {
    const prod = describeProduction();
    const expected = readSnapshot();
    if (prod === expected) {
      console.log('production matches the snapshot');
    } else {
      const a = new Set(expected.split('\n')); const b = new Set(prod.split('\n'));
      console.error('PRODUCTION DOES NOT MATCH THE SNAPSHOT');
      for (const l of expected.split('\n')) if (l && !b.has(l)) console.error(`  only in the snapshot:   ${l}`);
      for (const l of prod.split('\n')) if (l && !a.has(l)) console.error(`  only in production:     ${l}`);
      process.exit(1);
    }
  } else {
    console.error('usage: schema-snapshot.mjs write | check-prod');
    process.exit(2);
  }
}
