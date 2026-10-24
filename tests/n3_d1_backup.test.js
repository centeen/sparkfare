// N3 (Addendum N): daily D1 backup and the monthly restore drill. Runs against a fake wrangler that talks to real
// in-memory SQLite databases, so export, import and the row-count comparison are exercised for real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import {
  backup, drill, compareCounts, pruneKeys, dailyKey, countsKey, monthlyKey, drillRow, SCRATCH_DB, DB, tableCounts,
} from '../scripts/data/d1-backup.mjs';
import { wranglerStore } from '../scripts/data/upload-raw.mjs';

function memStore() {
  const objs = new Map();
  return {
    objs,
    async fetch(k) { return objs.has(k) ? objs.get(k) : null; },
    async put(k, buf) { objs.set(k, Buffer.from(buf)); },
    async delete(k) { objs.delete(k); },
  };
}

function seed(db) {
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, verified_email INTEGER DEFAULT 0);
           CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, meta TEXT);
           CREATE TABLE consent_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, source TEXT);`);
  for (let i = 0; i < 5; i++) db.exec(`INSERT INTO users (id, email) VALUES ('u${i}', 'person${i}@example.com')`);
  for (let i = 0; i < 40; i++) db.exec(`INSERT INTO events (event_type, meta) VALUES ('signup', '{"n":${i}}')`);
  db.exec(`INSERT INTO consent_log (user_id, source) VALUES ('u1', 'home')`);
}

function dump(db) {
  const out = ['PRAGMA defer_foreign_keys=TRUE;'];
  for (const t of db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    out.push(`${t.sql};`);
    const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map((c) => `quote("${c.name}")`).join(" || ',' || ");
    for (const r of db.prepare(`SELECT ${cols} AS v FROM "${t.name}"`).all()) out.push(`INSERT INTO "${t.name}" VALUES(${r.v});`);
  }
  return out.join('\n');
}

function fakeWrangler(dbs, { exportOverride } = {}) {
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    const [, op, name] = args;
    if (args[0] === 'd1' && op === 'execute') {
      const db = dbs.get(name);
      if (!db) return { code: 1, stdout: '', stderr: `no such database ${name}` };
      const ci = args.indexOf('--command');
      if (ci >= 0) return { code: 0, stdout: JSON.stringify([{ results: db.prepare(args[ci + 1]).all() }]), stderr: '' };
      db.exec(fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8'));
      return { code: 0, stdout: '[]', stderr: '' };
    }
    if (args[0] === 'd1' && op === 'export') {
      fs.writeFileSync(args[args.indexOf('--output') + 1], exportOverride ?? dump(dbs.get(name)));
      return { code: 0, stdout: 'Exporting...', stderr: '' };
    }
    if (args[0] === 'd1' && op === '--remote' || args[1] === 'list') return { code: 0, stdout: JSON.stringify([...dbs.keys()].map((n) => ({ name: n }))), stderr: '' };
    if (args[0] === 'd1' && args[1] === 'create') { dbs.set(args[2], new DatabaseSync(':memory:')); return { code: 0, stdout: '', stderr: '' }; }
    return { code: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
  };
  run.calls = calls;
  return run;
}

const NOW = new Date('2026-10-28T02:10:00Z');
const world = (opts) => {
  const prod = new DatabaseSync(':memory:');
  seed(prod);
  const dbs = new Map([[DB, prod]]);
  return { prod, dbs, run: fakeWrangler(dbs, opts), backupStore: memStore(), rawStore: memStore() };
};

test('table counts come from SQL counts, not row contents', async () => {
  const w = world();
  assert.deepEqual(await tableCounts(w.run, DB), { consent_log: 1, events: 40, users: 5 });
});

test('a backup stores the daily export, the counts file and the latest pointer', async () => {
  const w = world();
  const r = await backup({ ...w, now: NOW });
  assert.deepEqual(r.wrote, ['d1/daily/2026-10-28.sql.gz']);
  const sql = zlib.gunzipSync(w.backupStore.objs.get('d1/daily/2026-10-28.sql.gz')).toString();
  assert.match(sql, /CREATE TABLE users/);
  assert.equal(JSON.parse(w.backupStore.objs.get('d1/daily/2026-10-28.counts.json')).tables.events, 40);
  const latest = JSON.parse(w.rawStore.objs.get('state/d1_backup/latest.json'));
  assert.equal(latest.key, 'd1/daily/2026-10-28.sql.gz');
  assert.equal(latest.tables, 3);
  assert.equal(latest.rows, 46);
  assert.ok(!w.backupStore.objs.has('d1/monthly/2026-10.sql.gz'), 'monthly copies are only made on the 1st');
});

test('on the 1st a monthly copy is made too', async () => {
  const w = world();
  const r = await backup({ ...w, now: new Date('2026-11-01T02:10:00Z') });
  assert.deepEqual(r.wrote.sort(), ['d1/daily/2026-11-01.sql.gz', 'd1/monthly/2026-11.sql.gz']);
});

test('a backup run twice on one day keeps the first export', async () => {
  const w = world();
  await backup({ ...w, now: NOW });
  const first = Buffer.from(w.backupStore.objs.get('d1/daily/2026-10-28.sql.gz'));
  w.prod.exec("INSERT INTO users (id, email) VALUES ('late', 'late@example.com')");
  const r = await backup({ ...w, now: NOW });
  assert.deepEqual(r.wrote, []);
  assert.deepEqual(w.backupStore.objs.get('d1/daily/2026-10-28.sql.gz'), first);
});

test('a database with no tables, or a broken export, is never stored', async () => {
  const empty = world();
  empty.dbs.set(DB, new DatabaseSync(':memory:'));
  await assert.rejects(() => backup({ ...empty, now: NOW }), /no tables/);
  const broken = world({ exportOverride: 'oops' });
  await assert.rejects(() => backup({ ...broken, now: NOW }), /export looks wrong/);
  assert.equal(broken.backupStore.objs.size, 0);
  assert.equal(broken.rawStore.objs.size, 0);
});

test('pruning removes backups past 14 days and monthly ones past 12 months, and keeps newer ones', async () => {
  const w = world();
  for (const d of ['2026-10-23', '2026-10-14', '2026-10-13', '2026-10-06']) {
    w.backupStore.objs.set(`d1/daily/${d}.sql.gz`, Buffer.from('x'));
    w.backupStore.objs.set(`d1/daily/${d}.counts.json`, Buffer.from('{}'));
  }
  for (const m of ['2025-08', '2025-09', '2025-10', '2025-11', '2026-09']) w.backupStore.objs.set(`d1/monthly/${m}.sql.gz`, Buffer.from('x'));
  await backup({ ...w, now: NOW }); // 2026-10-28: dailies older than 14 days (before 10-14) go
  const keys = [...w.backupStore.objs.keys()];
  assert.ok(keys.includes('d1/daily/2026-10-23.sql.gz') && keys.includes('d1/daily/2026-10-14.sql.gz'), 'recent dailies stay');
  assert.ok(!keys.includes('d1/daily/2026-10-13.sql.gz') && !keys.includes('d1/daily/2026-10-06.sql.gz'), 'old dailies go');
  assert.ok(!keys.includes('d1/daily/2026-10-13.counts.json'));
  assert.ok(keys.includes('d1/monthly/2025-10.sql.gz') && keys.includes('d1/monthly/2025-11.sql.gz') && keys.includes('d1/monthly/2026-09.sql.gz'), '12 months back is still kept');
  assert.ok(!keys.includes('d1/monthly/2025-09.sql.gz') && !keys.includes('d1/monthly/2025-08.sql.gz'));
  assert.ok(pruneKeys(NOW).includes(dailyKey(new Date('2026-10-13T00:00:00Z'))));
  assert.ok(!pruneKeys(NOW).includes(dailyKey(new Date('2026-10-14T00:00:00Z'))));
  assert.ok(!pruneKeys(NOW).includes(monthlyKey(new Date('2025-11-01T00:00:00Z'))));
  assert.ok(pruneKeys(NOW).includes(countsKey(new Date('2026-10-13T00:00:00Z'))));
});

test('the restore drill restores the newest backup into the scratch database, passes, and leaves it empty', async () => {
  const w = world();
  await backup({ ...w, now: NOW });
  assert.ok(!w.dbs.has(SCRATCH_DB));
  const out = await drill({ ...w, now: new Date('2026-10-29T02:30:00Z') });
  assert.equal(out.status, 'pass');
  assert.equal(out.tables, 3);
  assert.equal(out.scratch_created, true);
  assert.deepEqual(w.dbs.get(SCRATCH_DB).prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all(), []);
  assert.equal(JSON.parse(w.rawStore.objs.get('state/d1_backup/drill.json')).status, 'pass');
  assert.match(drillRow(out), /^\| 2026-10-29 \| 2026-10-28 \| PASS \| 3 tables restored/);
  assert.ok(w.run.calls.every((c) => !c.includes(`${DB}`) || c[1] !== 'execute' || c.includes('--command') || c[2] !== SCRATCH_DB), 'sanity');
});

test('the drill never writes to production', async () => {
  const w = world();
  await backup({ ...w, now: NOW });
  w.run.calls.length = 0;
  await drill({ ...w, now: NOW });
  const writesToProd = w.run.calls.filter((c) => c[2] === DB && (c.includes('--file') || c[1] === 'create'));
  assert.deepEqual(writesToProd, []);
});

test('a backup that is missing a table fails the drill and names it', async () => {
  const w = world();
  await backup({ ...w, now: NOW });
  const key = 'd1/daily/2026-10-28.sql.gz';
  const sql = zlib.gunzipSync(w.backupStore.objs.get(key)).toString().split('\n').filter((l) => !/consent_log/.test(l)).join('\n');
  w.backupStore.objs.set(key, zlib.gzipSync(sql));
  const out = await drill({ ...w, now: NOW });
  assert.equal(out.status, 'fail');
  assert.deepEqual(out.missing_tables, ['consent_log']);
  assert.match(drillRow(out), /FAIL.*missing: consent_log/);
  assert.deepEqual(w.dbs.get(SCRATCH_DB).prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all(), [], 'scratch is emptied even after a failure');
});

test('a backup with lost rows fails the drill', async () => {
  const w = world();
  await backup({ ...w, now: NOW });
  const key = 'd1/daily/2026-10-28.sql.gz';
  const sql = zlib.gunzipSync(w.backupStore.objs.get(key)).toString().split('\n').filter((l) => !/INSERT INTO "events"/.test(l)).join('\n');
  w.backupStore.objs.set(key, zlib.gzipSync(sql));
  const out = await drill({ ...w, now: NOW });
  assert.equal(out.status, 'fail');
  assert.equal(out.tables_off[0].table, 'events');
});

test('the drill refuses to run when no backup is recorded', async () => {
  const w = world();
  await assert.rejects(() => drill({ ...w, now: NOW }), /no backup is recorded/);
});

test('row-count tolerance: a few rows either way pass, a lost table or a big drop fails', () => {
  assert.equal(compareCounts({ a: 1000 }, { a: 1003 }).ok, true);
  assert.equal(compareCounts({ a: 1000 }, { a: 985 }).ok, true);
  assert.equal(compareCounts({ a: 1000 }, { a: 900 }).ok, false);
  assert.equal(compareCounts({ a: 3 }, { a: 1 }).ok, true);
  assert.equal(compareCounts({ a: 3 }, {}).ok, false);
  assert.equal(compareCounts({ a: 0 }, { a: 0 }).ok, true);
});

test('no row contents reach the results or the logs the scripts produce', async () => {
  const w = world();
  const b = await backup({ ...w, now: NOW });
  const d = await drill({ ...w, now: NOW });
  const text = JSON.stringify([b, d, drillRow(d), [...w.rawStore.objs.values()].map((v) => v.toString())]);
  assert.ok(!/example\.com|person\d/.test(text));
});

test('wrangler store delete: a missing object is fine, a real error is not', async () => {
  const ok = wranglerStore({ run: async () => ({ code: 1, stdout: '', stderr: 'The specified key does not exist. [code: 10007]' }) });
  await ok.delete('x');
  const bad = wranglerStore({ run: async () => ({ code: 1, stdout: '', stderr: 'Authentication error [code: 10000]' }) });
  await assert.rejects(() => bad.delete('x'), /Authentication error/);
});

test('workflow: nightly at an off-peak minute, drill on the 2nd, scoped permissions, nothing prints the export', () => {
  const y = fs.readFileSync('.github/workflows/d1-backup.yml', 'utf8');
  assert.deepEqual([...y.matchAll(/- cron:\s*'([^']+)'/g)].map((m) => m[1]), ['10 2 * * *']);
  assert.match(y, /date -u \+%d\)" = "02"/);
  assert.match(y, /needs\.backup\.outputs\.drill == 'true'/);
  assert.match(y, /contents: read/);
  assert.match(y, /node scripts\/data\/d1-backup\.mjs backup/);
  assert.match(y, /node scripts\/data\/d1-backup\.mjs drill --docs docs\/data\/restore_drills\.md/);
  assert.deepEqual([...y.matchAll(/git add ([^\n]+)/g)].map((m) => m[1].trim()), ['docs/data/restore_drills.md']);
  assert.match(y, /steps\.drill\.outcome == 'failure'/);
  assert.ok(!/\bcat\b|\bhead\b|\btail\b|\.sql\b(?!\.gz)/.test(y.replace(/#.*$/gm, '').replace(/restore_drills\.md/g, '')), 'the workflow must not print the export');
  assert.match(y, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
});

test('the runbook has the restore section with the real commands', () => {
  const r = fs.readFileSync('docs/data/RUNBOOK.md', 'utf8');
  assert.match(r, /^## Restore D1/m);
  assert.match(r, /d1 time-travel info sparkfare-db --timestamp=/);
  assert.match(r, /d1 time-travel restore sparkfare-db --timestamp=/);
  assert.match(r, /sparkfare-backups\/d1\/daily\//);
  assert.match(fs.readFileSync('docs/data/restore_drills.md', 'utf8'), /\| Drill date \| Backup date \| Result \| Notes \|/);
});

// ---- the health check ----------------------------------------------------------------------------------------------------
const { checkBackupState } = await import('../src/backupHealth.js');
const rawBinding = (files) => ({ async get(key) { return key in files ? { text: async () => JSON.stringify(files[key]) } : null; } });
const NOW2 = new Date('2026-10-29T08:00:00Z');
const latestOk = { date: '2026-10-29', key: 'd1/daily/2026-10-29.sql.gz', tables: 31, taken_at: '2026-10-29T02:11:00Z' };

test('backup health: nothing recorded yet, or no binding, reports nothing', async () => {
  assert.deepEqual((await checkBackupState({}, NOW2)).problems, []);
  const r = await checkBackupState({ RAW: rawBinding({}) }, NOW2);
  assert.deepEqual(r.problems, []);
  assert.match(r.details[0].line, /none recorded yet/);
});

test('backup health: a fresh backup and a passing drill are quiet and give readable lines', async () => {
  const env = { RAW: rawBinding({ 'state/d1_backup/latest.json': latestOk, 'state/d1_backup/drill.json': { status: 'pass', checked_at: '2026-10-29T02:30:00Z', backup_date: '2026-10-29' } }) };
  const r = await checkBackupState(env, NOW2);
  assert.deepEqual(r.problems, []);
  assert.match(r.details.map((d) => d.line).join('\n'), /D1 backup: 2026-10-29, 31 tables, 5\.8h old/);
  assert.match(r.details.map((d) => d.line).join('\n'), /restore drill: PASS/);
});

test('backup health: a backup older than 26 hours is a problem', async () => {
  const env = { RAW: rawBinding({ 'state/d1_backup/latest.json': { ...latestOk, taken_at: '2026-10-27T02:11:00Z' } }) };
  const r = await checkBackupState(env, NOW2);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /newest D1 backup is 54 hours old/);
});

test('backup health: a failed drill is a problem and names the missing table; a stale drill is too', async () => {
  const failed = { RAW: rawBinding({ 'state/d1_backup/latest.json': latestOk, 'state/d1_backup/drill.json': { status: 'fail', checked_at: '2026-10-29T02:30:00Z', backup_date: '2026-10-29', missing_tables: ['consent_log'] } }) };
  assert.match((await checkBackupState(failed, NOW2)).problems[0], /FAILED.*consent_log/);
  const stale = { RAW: rawBinding({ 'state/d1_backup/latest.json': latestOk, 'state/d1_backup/drill.json': { status: 'pass', checked_at: '2026-08-01T02:30:00Z', backup_date: '2026-08-01' } }) };
  assert.match((await checkBackupState(stale, NOW2)).problems[0], /drill was \d+ days ago/);
});

test('backup health: an unreadable bucket is a problem, not a crash', async () => {
  const r = await checkBackupState({ RAW: { get: async () => { throw new Error('R2 down'); } } }, NOW2);
  assert.equal(r.problems.length, 1);
});

test('backup health is part of the daily data check', async () => {
  const { checkDataFreshness } = await import('../src/index.js');
  const env = {
    ASSETS: { fetch: async () => new Response('{}') },
    RAW: rawBinding({ 'state/d1_backup/latest.json': { ...latestOk, taken_at: '2026-10-26T02:11:00Z' } }),
  };
  const { problems, details } = await checkDataFreshness(env, NOW2);
  assert.ok(problems.some((p) => /newest D1 backup is/.test(p)));
  assert.ok(details.some((d) => /D1 backup:/.test(d.line ?? '')));
});
