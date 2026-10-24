// N3 (Addendum N, ROADMAP step 151): daily D1 backup and a monthly restore drill.
//   backup : export sparkfare-db, gzip, store in the private bucket sparkfare-backups
//              d1/daily/YYYY-MM-DD.sql.gz      kept 14 days
//              d1/monthly/YYYY-MM.sql.gz       written on the 1st, kept 12 months
//              d1/daily/YYYY-MM-DD.counts.json row counts per table taken just before the export (no row contents)
//            and write state/d1_backup/latest.json in sparkfare-raw (what the health check reads).
//   drill  : import the newest backup into the scratch database sparkfare-restore-drill, compare table row counts with
//            the counts file, empty the scratch database again, and record pass or fail
//            (state/d1_backup/drill.json and one row in docs/data/restore_drills.md).
// Backups contain personal data (emails, consent): the bucket is private, the token is scoped, and this script prints
// counts and table names only, never rows.  Recovery targets and the commands for a real restore are in
// docs/data/RUNBOOK.md ("Restore D1").
//
//   node scripts/data/d1-backup.mjs backup
//   node scripts/data/d1-backup.mjs drill [--docs docs/data/restore_drills.md]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { wranglerStore, wranglerRunner } from './upload-raw.mjs';

export const DB = 'sparkfare-db';
export const SCRATCH_DB = 'sparkfare-restore-drill';
export const KEEP_DAILY_DAYS = 14;
export const KEEP_MONTHLY = 12;
const DAY = 24 * 60 * 60 * 1000;
const TABLES_SQL = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name";
/** The useful part of a wrangler failure: no colour codes, no "database will be unavailable" banner, the last 500 characters. */
export function errText(r) {
  const raw = `${r?.stderr || ''}\n${r?.stdout || ''}`;
  const clean = raw.replace(/\u001b\[[0-9;]*m/g, '').split('\n')
    .filter((l) => l.trim() && !/WARNING|may take some time|will be unavailable|update available|^[─\s]+$/.test(l)).join(' | ');
  // account and database ids appear in Cloudflare API paths; this text can end up in a committed log row, so drop them
  return clean.replace(/\/accounts\/[0-9a-f]{32}/g, '/accounts/<id>').replace(/\/database\/[0-9a-f-]{36}/g, '/database/<id>').slice(-500);
}
const q = (name) => `"${String(name).replace(/"/g, '""')}"`;
const iso = (d) => d.toISOString().slice(0, 10);
const json = (o) => Buffer.from(JSON.stringify(o, null, 2) + '\n');

export const dailyKey = (d) => `d1/daily/${iso(d)}.sql.gz`;
export const countsKey = (d) => `d1/daily/${iso(d)}.counts.json`;
export const monthlyKey = (d) => `d1/monthly/${iso(d).slice(0, 7)}.sql.gz`;

/** Run a SQL command against a D1 database and return the rows of the last statement ([] if none). */
export async function d1Query(run, db, sql) {
  const r = await run(['d1', 'execute', db, '--remote', '--json', '--command', sql]);
  if (r.code !== 0) throw new Error(`d1 execute on ${db} failed (exit ${r.code}): ${errText(r)}`);
  let parsed;
  try { parsed = JSON.parse(r.stdout); } catch { throw new Error(`d1 execute on ${db} returned unreadable output`); }
  const last = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
  return last?.results ?? [];
}

// D1 rejects a compound SELECT with more than a handful of terms ("too many terms in compound SELECT", seen on the
// first real run, 2026-10-24, with 31 tables), so tables are counted a few at a time.
export const COUNT_TERMS_PER_QUERY = 4;

export async function tableCounts(run, db) {
  const tables = (await d1Query(run, db, TABLES_SQL)).map((r) => r.name);
  const counts = {};
  for (let i = 0; i < tables.length; i += COUNT_TERMS_PER_QUERY) {
    const sql = tables.slice(i, i + COUNT_TERMS_PER_QUERY)
      .map((t) => `SELECT '${t.replace(/'/g, "''")}' AS t, COUNT(*) AS n FROM ${q(t)}`).join(' UNION ALL ');
    for (const r of await d1Query(run, db, sql)) counts[r.t] = Number(r.n);
  }
  return counts;
}

/** Which old objects to delete today: daily backups 15 to 22 days old (a few days of slack for missed runs) and monthly ones past 12 months. */
export function pruneKeys(now) {
  const keys = [];
  for (let age = KEEP_DAILY_DAYS + 1; age <= KEEP_DAILY_DAYS + 8; age++) {
    const d = new Date(now.getTime() - age * DAY);
    keys.push(dailyKey(d), countsKey(d));
  }
  for (let back = KEEP_MONTHLY + 1; back <= KEEP_MONTHLY + 4; back++) {
    keys.push(monthlyKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))));
  }
  return keys;
}

export async function backup({ run, backupStore, rawStore, now = new Date(), tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1b-')) }) {
  const counts = await tableCounts(run, DB);
  if (!Object.keys(counts).length) throw new Error('refusing to back up: the database reported no tables');

  const file = path.join(tmpDir, 'export.sql');
  const r = await run(['d1', 'export', DB, '--remote', '--output', file]);
  if (r.code !== 0) throw new Error(`d1 export failed (exit ${r.code}): ${errText(r)}`);
  const sql = fs.readFileSync(file);
  if (sql.length < 200 || !/CREATE TABLE/i.test(sql.subarray(0, 200000).toString('utf8'))) {
    throw new Error(`the export looks wrong (${sql.length} bytes, no CREATE TABLE); not stored`);
  }
  const gz = zlib.gzipSync(sql, { level: 9 });
  fs.rmSync(file, { force: true });

  const key = dailyKey(now);
  const wrote = [];
  if (!(await backupStore.fetch(key))) { await backupStore.put(key, gz, 'application/gzip'); wrote.push(key); }
  await backupStore.put(countsKey(now), json({ taken_at: now.toISOString(), database: DB, tables: counts }), 'application/json');
  if (now.getUTCDate() === 1) {
    const mk = monthlyKey(now);
    if (!(await backupStore.fetch(mk))) { await backupStore.put(mk, gz, 'application/gzip'); wrote.push(mk); }
  }
  for (const k of pruneKeys(now)) await backupStore.delete(k);

  const latest = { date: iso(now), key, bytes: sql.length, gz_bytes: gz.length, tables: Object.keys(counts).length, rows: Object.values(counts).reduce((a, b) => a + b, 0), taken_at: now.toISOString() };
  await rawStore.put('state/d1_backup/latest.json', json(latest), 'application/json');
  return { latest, wrote };
}

/** A restored table passes if it is present and within a small tolerance of the pre-export count (writes land between the two). */
export function compareCounts(expected, got) {
  const missing = Object.keys(expected).filter((t) => !(t in got));
  const off = [];
  for (const [t, n] of Object.entries(expected)) {
    if (!(t in got)) continue;
    const g = got[t];
    if (g < Math.floor(n * 0.98) - 2 || g > Math.ceil(n * 1.05) + 50) off.push({ table: t, expected: n, restored: g });
  }
  return { missing, off, ok: missing.length === 0 && off.length === 0 };
}

async function wipe(run, db, tmpDir) {
  const tables = (await d1Query(run, db, TABLES_SQL)).map((r) => r.name);
  if (!tables.length) return 0;
  const f = path.join(tmpDir, 'wipe.sql');
  fs.writeFileSync(f, ['PRAGMA defer_foreign_keys=TRUE;', ...tables.map((t) => `DROP TABLE IF EXISTS ${q(t)};`)].join('\n'));
  const r = await run(['d1', 'execute', db, '--remote', '--file', f]);
  if (r.code !== 0) throw new Error(`could not empty ${db} (exit ${r.code}): ${errText(r)}`);
  return tables.length;
}

async function ensureScratch(run) {
  const r = await run(['d1', 'list', '--json']);
  if (r.code !== 0) throw new Error(`d1 list failed (exit ${r.code}): ${errText(r)}`);
  let names = [];
  try { names = JSON.parse(r.stdout).map((d) => d.name); } catch { throw new Error('d1 list returned unreadable output'); }
  if (names.includes(SCRATCH_DB)) return false;
  const c = await run(['d1', 'create', SCRATCH_DB]);
  if (c.code !== 0) throw new Error(`could not create ${SCRATCH_DB} (exit ${c.code}): ${errText(c)}`);
  return true;
}

export async function drill({ run, backupStore, rawStore, now = new Date(), tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1d-')) }) {
  const latestBuf = await rawStore.fetch('state/d1_backup/latest.json');
  if (!latestBuf) throw new Error('no backup is recorded yet (state/d1_backup/latest.json is missing)');
  const latest = JSON.parse(latestBuf.toString('utf8'));
  const gz = await backupStore.fetch(latest.key);
  const countsBuf = await backupStore.fetch(latest.key.replace(/\.sql\.gz$/, '.counts.json'));
  if (!gz || !countsBuf) throw new Error(`backup ${latest.key} or its counts file is missing from the bucket`);
  const expected = JSON.parse(countsBuf.toString('utf8')).tables;

  const created = await ensureScratch(run);
  await wipe(run, SCRATCH_DB, tmpDir);
  const sqlFile = path.join(tmpDir, 'restore.sql');
  fs.writeFileSync(sqlFile, zlib.gunzipSync(gz));
  const imp = await run(['d1', 'execute', SCRATCH_DB, '--remote', '--file', sqlFile]);
  fs.rmSync(sqlFile, { force: true });

  let result;
  if (imp.code !== 0) {
    result = { ok: false, error: `import failed (exit ${imp.code}): ${errText(imp)}`, missing: [], off: [] };
  } else {
    result = compareCounts(expected, await tableCounts(run, SCRATCH_DB));
  }
  await wipe(run, SCRATCH_DB, tmpDir);

  const out = {
    status: result.ok ? 'pass' : 'fail', checked_at: now.toISOString(), backup_key: latest.key, backup_date: latest.date,
    tables: Object.keys(expected).length, scratch_created: created, missing_tables: result.missing, tables_off: result.off, error: result.error ?? null,
  };
  await rawStore.put('state/d1_backup/drill.json', json(out), 'application/json');
  return out;
}

export function drillRow(out) {
  const note = out.status === 'pass' ? `${out.tables} tables restored, counts within tolerance` : `missing: ${out.missing_tables.join(', ') || 'none'}; off: ${out.tables_off.map((t) => `${t.table} ${t.expected}->${t.restored}`).join(', ') || 'none'}${out.error ? `; ${out.error}` : ''}`;
  return `| ${out.checked_at.slice(0, 10)} | ${out.backup_date} | ${out.status.toUpperCase()} | ${note} |`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    const [cmd, ...rest] = process.argv.slice(2);
    if (!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set');
    const run = wranglerRunner();
    const backupStore = wranglerStore({ bucket: 'sparkfare-backups', run });
    const rawStore = wranglerStore({ bucket: 'sparkfare-raw', run });
    if (cmd === 'backup') {
      const r = await backup({ run, backupStore, rawStore });
      console.log(JSON.stringify({ stored: r.wrote, ...r.latest }));
    } else if (cmd === 'drill') {
      const out = await drill({ run, backupStore, rawStore });
      const docs = rest[rest.indexOf('--docs') + 1];
      if (rest.includes('--docs') && docs) fs.appendFileSync(docs, drillRow(out) + '\n');
      console.log(JSON.stringify(out));
      if (out.status !== 'pass') process.exit(1);
    } else {
      throw new Error('usage: d1-backup.mjs backup|drill [--docs file]');
    }
  })().catch((e) => { console.error(`D1 BACKUP FAILED: ${e.message}`); process.exit(1); });
}
