// N1 (Addendum N): the raw archive in R2 is write-once, keyed by run time, and carries counts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  archive, archiveFile, detectRunTime, countRoutes, stamp, runTimeFromSnapshotName, wranglerStore, ConflictError, sha256,
} from '../scripts/data/upload-raw.mjs';
import { snapshotJobs, historyJobs, runJobs } from '../scripts/data/backfill-raw.mjs';

function memStore() {
  const objs = new Map();
  const puts = [];
  return {
    objs, puts,
    async fetch(k) { return objs.has(k) ? objs.get(k) : null; },
    async put(k, buf, ct) { puts.push(k); objs.set(k, Buffer.from(buf)); assert.ok(ct); },
  };
}
const feed = (price = 810) => JSON.stringify({
  'JFK:Bali, Indonesia': { origin: 'JFK', fetched_at: '2026-10-24T14:38:35.043637+00:00', results: [{ price, airline: 'OZ' }] },
  'JFK:Tokyo, Japan': { origin: 'JFK', fetched_at: '2026-10-24T14:38:35.043637+00:00', results: [] },
});
const tmpFile = (text) => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'n1-')), 'feed.json'); fs.writeFileSync(f, text); return f; };

test('run time comes from the newest fetched_at, else generated_at', () => {
  assert.equal(detectRunTime(JSON.parse(feed())).toISOString(), '2026-10-24T14:38:35.043Z');
  assert.equal(detectRunTime({ windows: {}, generated_at: '2026-10-24T09:36:41.650248+00:00' }).toISOString(), '2026-10-24T09:36:41.650Z');
  assert.equal(detectRunTime({ a: 1 }), null);
  assert.equal(stamp(new Date('2026-10-24T14:38:35.043Z')), '20261024T143835Z');
});

test('counts are routes only, never prices', () => {
  assert.deepEqual(countRoutes(JSON.parse(feed())), { routes: 2, routes_with_results: 1 });
  assert.equal(countRoutes({ windows: {} }), null);
});

test('uploads data then manifest under the documented key', async () => {
  const s = memStore();
  const r = await archiveFile(s, { pipeline: 'multi_origin', file: tmpFile(feed()) });
  assert.equal(r.status, 'uploaded');
  assert.equal(r.dataKey, 'raw/fares/multi_origin/date=2026-10-24/run=20261024T143835Z.json.gz');
  assert.deepEqual(s.puts, [r.dataKey, 'raw/fares/multi_origin/date=2026-10-24/run=20261024T143835Z.manifest.json']);
  assert.equal(zlib.gunzipSync(s.objs.get(r.dataKey)).toString(), feed());
  const m = JSON.parse(s.objs.get(s.puts[1]).toString());
  assert.equal(m.input_sha256, sha256(Buffer.from(feed())));
  assert.equal(m.pipeline, 'multi_origin');
  assert.equal(m.backfill, false);
  assert.deepEqual(m.counts, { routes: 2, routes_with_results: 1 });
  assert.ok(!/price|airline|810/.test(JSON.stringify(m)), 'manifest must hold counts only');
});

test('the same input twice is a no-op', async () => {
  const s = memStore();
  const f = tmpFile(feed());
  await archiveFile(s, { pipeline: 'multi_origin', file: f });
  s.puts.length = 0;
  const r = await archiveFile(s, { pipeline: 'multi_origin', file: f });
  assert.equal(r.status, 'skipped');
  assert.deepEqual(s.puts, []);
});

test('different data under an existing key is a conflict and nothing is overwritten', async () => {
  const s = memStore();
  const a = await archiveFile(s, { pipeline: 'multi_origin', file: tmpFile(feed(810)) });
  const before = Buffer.from(s.objs.get(a.dataKey));
  s.puts.length = 0;
  await assert.rejects(() => archiveFile(s, { pipeline: 'multi_origin', file: tmpFile(feed(999)) }), ConflictError);
  assert.deepEqual(s.puts, []);
  assert.deepEqual(s.objs.get(a.dataKey), before);
});

test('a data object left without a manifest gets only its manifest; different data is a conflict', async () => {
  const s = memStore();
  const base = { base: 'raw/fares/multi_origin', label: 'run=20261024T143835Z', runTime: new Date('2026-10-24T14:38:35Z') };
  const dataKey = 'raw/fares/multi_origin/date=2026-10-24/run=20261024T143835Z.json.gz';
  s.objs.set(dataKey, zlib.gzipSync(Buffer.from(feed())));
  const r = await archive(s, { ...base, bytes: Buffer.from(feed()) });
  assert.equal(r.status, 'manifest_added');
  assert.deepEqual(s.puts, [dataKey.replace('.json.gz', '.manifest.json')]);
  const s2 = memStore();
  s2.objs.set(dataKey, zlib.gzipSync(Buffer.from(feed(1))));
  await assert.rejects(() => archive(s2, { ...base, bytes: Buffer.from(feed(2)) }), ConflictError);
  assert.deepEqual(s2.puts, []);
});

test('a dry run writes nothing', async () => {
  const s = memStore();
  const r = await archiveFile(s, { pipeline: 'daily_jfk', file: tmpFile(feed()), dryRun: true });
  assert.equal(r.status, 'dry_run_uploaded');
  assert.deepEqual(s.puts, []);
});

test('unknown pipeline names are refused', async () => {
  await assert.rejects(() => archiveFile(memStore(), { pipeline: 'nope', file: tmpFile(feed()) }), /unknown pipeline/);
});

test('snapshot names map to run keys, and the live file lands on the same key as its snapshot', () => {
  assert.equal(runTimeFromSnapshotName('flight_prices_2026-09-06T180853.396844+0000.json').toISOString(), '2026-09-06T18:08:53.000Z');
  assert.equal(runTimeFromSnapshotName('flight_prices_2026-10-24T143835.043637Z.json').toISOString(), '2026-10-24T14:38:35.000Z');
  const dir = 'sparkfare_hourly_snapshots';
  const newest = fs.readdirSync(dir).sort().pop();
  const live = detectRunTime(JSON.parse(fs.readFileSync(`${dir}/${newest}`, 'utf8')));
  assert.equal(stamp(live), stamp(runTimeFromSnapshotName(newest)), 'live upload and backfill must pick the same key');
});

test('every snapshot becomes exactly one job with a unique key', () => {
  const dir = 'sparkfare_hourly_snapshots';
  const jobs = snapshotJobs(dir);
  assert.equal(jobs.length, fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length);
  assert.ok(jobs.length >= 249);
  assert.equal(new Set(jobs.map((j) => `${j.base}/${j.label}`)).size, jobs.length);
  assert.ok(jobs.every((j) => j.backfill === true));
});

test('history versions: identical content is uploaded once, deleting commits are skipped', () => {
  const versions = { c1: 'A', c2: 'A', c3: 'B', c4: null };
  const git = (args) => {
    if (args[0] === 'log') return Buffer.from('c1\t2026-09-03T17:35:53Z\nc2\t2026-09-04T00:00:00Z\nc3\t2026-09-05T00:00:00Z\nc4\t2026-09-06T00:00:00Z\n');
    const sha = args[1].split(':')[0];
    if (versions[sha] === null) throw new Error('deleted');
    return Buffer.from(versions[sha]);
  };
  const jobs = historyJobs(['sparkfare_price_history.json'], git);
  assert.deepEqual(jobs.map((j) => j.label), ['commit=c1', 'commit=c3']);
  assert.equal(jobs[0].base, 'raw/history_files/sparkfare_price_history');
});

test('backfill runner counts uploads, skips and conflicts without throwing', async () => {
  const s = memStore();
  const mk = (label, text) => ({ base: 'raw/fares/multi_origin', label, runTime: new Date('2026-09-06T18:08:53Z'), bytes: Buffer.from(text), backfill: true });
  let t = await runJobs(s, [mk('run=1', 'a'), mk('run=2', 'b')], { concurrency: 2 });
  assert.equal(t.uploaded, 2);
  t = await runJobs(s, [mk('run=1', 'a'), mk('run=2', 'CHANGED')], { concurrency: 2 });
  assert.equal(t.skipped, 1);
  assert.equal(t.conflicts.length, 1);
  assert.equal(s.objs.get('raw/fares/multi_origin/date=2026-09-06/run=2.json.gz').length > 0, true);
  assert.equal(zlib.gunzipSync(s.objs.get('raw/fares/multi_origin/date=2026-09-06/run=2.json.gz')).toString(), 'b');
});

test('wrangler store: absent key is null, other errors throw, put carries --remote and no secret', async () => {
  const calls = [];
  const bucket = new Map();
  const run = async (args) => {
    calls.push(args);
    const [, , op, target] = args;
    const file = args[args.indexOf('--file') + 1];
    if (op === 'get') {
      const k = target.replace(/^sparkfare-raw\//, '');
      if (k.includes('boom')) return { code: 1, stdout: '', stderr: 'Authentication error [code: 10000]' };
      if (!bucket.has(k)) return { code: 1, stdout: '', stderr: 'The specified key does not exist. [code: 10007]' };
      fs.writeFileSync(file, bucket.get(k));
      return { code: 0, stdout: '', stderr: '' };
    }
    bucket.set(target.replace(/^sparkfare-raw\//, ''), fs.readFileSync(file));
    return { code: 0, stdout: '', stderr: '' };
  };
  const store = wranglerStore({ run });
  assert.equal(await store.fetch('a/b'), null);
  await assert.rejects(() => store.fetch('boom'), /Authentication error/);
  await store.put('a/b', Buffer.from('xyz'), 'application/gzip');
  assert.equal((await store.fetch('a/b')).toString(), 'xyz');
  const put = calls.find((c) => c[2] === 'put');
  assert.ok(put.includes('--remote') && put.includes('sparkfare-raw/a/b') && put.includes('application/gzip'));
  assert.ok(calls.every((c) => c.includes('--remote')));
  assert.ok(!calls.flat().some((a) => /token|secret|CLOUDFLARE/i.test(a)));
});

test('workflows: the upload runs after the fetch, cannot block the commit, and still fails the job', () => {
  const cases = [
    ['.github/workflows/daily-fetch.yml', 'daily_jfk', 'sparkfare_flight_prices.json', 'Commit updated data files'],
    ['.github/workflows/hourly-multi-origin-fetch.yml', 'multi_origin', 'sparkfare_hourly_flight_prices.json', 'Commit hourly data'],
    ['.github/workflows/pto-window-fetch.yml', 'pto_windows', 'sparkfare_pto_window_prices.json', 'Commit the window prices'],
  ];
  for (const [wf, pipeline, file, commitStep] of cases) {
    const y = fs.readFileSync(wf, 'utf8');
    assert.ok(y.includes(`--pipeline ${pipeline} --file ${file}`), `${wf} must upload ${file} as ${pipeline}`);
    const up = y.indexOf('id: raw_upload');
    assert.ok(up > 0, `${wf} needs a step with id raw_upload`);
    assert.ok(y.slice(up - 200, up + 800).includes('continue-on-error: true'), `${wf}: the upload must not block the commit`);
    assert.ok(up < y.indexOf(`name: ${commitStep}`), `${wf}: upload must come before the commit step`);
    assert.ok(/steps\.raw_upload\.outcome == 'failure'/.test(y), `${wf}: a failed upload must still fail the job`);
    assert.ok(y.indexOf("steps.raw_upload.outcome == 'failure'") > y.indexOf(`name: ${commitStep}`), `${wf}: the failing step must come after the commit`);
    assert.ok(y.includes('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}'));
  }
});

test('Cloudflare secrets pasted with a trailing newline or space are trimmed before wrangler sees them', async () => {
  const { cleanCloudflareEnv } = await import('../scripts/data/upload-raw.mjs');
  const env = cleanCloudflareEnv({ CLOUDFLARE_API_TOKEN: ' tok\n', CLOUDFLARE_ACCOUNT_ID: 'abc123\r\n', OTHER: ' keep ' });
  assert.equal(env.CLOUDFLARE_API_TOKEN, 'tok');
  assert.equal(env.CLOUDFLARE_ACCOUNT_ID, 'abc123');
  assert.equal(env.OTHER, ' keep ');
  assert.deepEqual(cleanCloudflareEnv({}), {});
});
