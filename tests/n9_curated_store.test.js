// N9 (Addendum N, ROADMAP step 156): the curated store loader. The merge itself is tested in tests/python/test_curate.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { collect, stage } from '../scripts/data/curate-backfill.mjs';
import { sha256 } from '../scripts/data/upload-raw.mjs';

const job = (base, label, text, day = '2026-10-20') => ({ base, label, runTime: new Date(`${day}T08:00:00Z`), bytes: Buffer.from(text) });
const keyOf = (j) => `${j.base}/date=${j.runTime.toISOString().slice(0, 10)}/${j.label}.json.gz`;
const storeWith = (objs) => ({ fetch: async (k) => objs[k] ?? null });

test('collect from the raw archive: identical bytes are used, a missing or different object is a problem (nothing is guessed)', async () => {
  const a = job('raw/fares/multi_origin', 'run=20261020T080000Z', '{"a":1}');
  const b = job('raw/fares/multi_origin', 'run=20261020T090000Z', '{"b":2}');
  const c = job('raw/fares/multi_origin', 'run=20261020T100000Z', '{"c":3}');
  const store = storeWith({ [keyOf(a)]: zlib.gzipSync(a.bytes), [keyOf(b)]: zlib.gzipSync(Buffer.from('{"b":999}')) });
  const { bytes, problems } = await collect([a, b, c], { source: 'r2', store });
  assert.equal(sha256(bytes[0]), sha256(a.bytes));
  assert.equal(bytes[1], undefined);
  assert.equal(problems.length, 2);
  assert.match(problems.find((p) => p.includes('0900')), /differs from the repo copy/);
  assert.match(problems.find((p) => p.includes('1000')), /not in the raw archive/);
});

test('collect from the repo copy needs no store', async () => {
  const a = job('raw/fares/multi_origin', 'run=20261020T080000Z', '{}');
  const { bytes, problems } = await collect([a], { source: 'repo', store: null });
  assert.deepEqual(problems, []);
  assert.equal(bytes[0], a.bytes);
});

test('stage lays feeds and history versions out the way curate.py reads them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n9-'));
  const jobs = [
    job('raw/fares/multi_origin', 'run=20261020T080000Z', '{}'),
    job('raw/history_files/sparkfare_price_history', 'commit=abcdef123456', '{}'),
  ];
  assert.deepEqual(stage(jobs, [Buffer.from('{}'), Buffer.from('{}')], dir), { feeds: 1, history: 1 });
  assert.deepEqual(fs.readdirSync(path.join(dir, 'feeds')), ['run-20261020T080000Z.json']);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'history')), ['sparkfare_price_history.json__commit-abcdef123456.json']);
  // the file name carries the history file's own name: curate.py treats only sparkfare_price_history.json as the JFK daily file
  assert.equal(fs.readdirSync(path.join(dir, 'history'))[0].split('__')[0], 'sparkfare_price_history.json');
});

test('migration 0036 is additive and does not touch existing tables', () => {
  const sql = fs.readFileSync(new URL('../migrations/0036_curated_store.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
  assert.deepEqual([...sql.matchAll(/CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/g)].map((m) => m[1]), ['fare_daily', 'idx_fare_daily_obs_date', 'route_verdict']);
  assert.doesNotMatch(sql, /\b(DROP|ALTER|DELETE|UPDATE)\b/i);
});

test('nothing reads the curated tables yet', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const readers = walk(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).filter((f) => /fare_daily|route_verdict/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(readers, []);
});
