// N2 (Addendum N): the validation gate's wiring. The checks themselves are tested in tests/python/test_validate_feed.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publishResult, getBaseline, RECENT_KEEP } from '../scripts/data/publish-result.mjs';
import { checkRunResults, checkDataFreshness, RUN_RESULT_LIMITS } from '../src/index.js';

function memStore() {
  const objs = new Map();
  return {
    objs,
    async fetch(k) { return objs.has(k) ? objs.get(k) : null; },
    async put(k, buf) { objs.set(k, Buffer.from(buf)); },
  };
}
const J = (store, key) => JSON.parse(store.objs.get(key).toString());
const RUN = new Date('2026-10-24T14:38:35Z');
const ok = (priced = 30) => ({ schema_version: 1, kind: 'run_result', status: 'ok', checked_at: '2026-10-24T14:50:00Z', failed_checks: [], counts: { priced, calls: 920, failed: 2 } });
const blocked = { ...ok(), status: 'blocked', failed_checks: ['failed_calls'] };

test('publishing a result writes the result object, the latest pointer and the baseline', async () => {
  const s = memStore();
  const r = await publishResult(s, { pipeline: 'multi_origin', runTime: RUN, result: ok(31), stats: { started_at: 'a', finished_at: 'b' } });
  assert.equal(r.resultKey, 'raw/fares/multi_origin/date=2026-10-24/run=20261024T143835Z.result.json');
  assert.equal(J(s, r.resultKey).run_id, 'run=20261024T143835Z');
  assert.equal(J(s, r.resultKey).fetch_started_at, 'a');
  const latest = J(s, 'state/multi_origin/latest.json');
  assert.equal(latest.status, 'ok');
  assert.equal(latest.priced, 31);
  assert.deepEqual(J(s, 'state/multi_origin/recent.json').priced_counts, [31]);
});

test('a blocked run is recorded but never enters the baseline', async () => {
  const s = memStore();
  await publishResult(s, { pipeline: 'daily_jfk', runTime: RUN, result: ok(31) });
  await publishResult(s, { pipeline: 'daily_jfk', runTime: new Date('2026-10-25T08:00:00Z'), result: { ...blocked, counts: { priced: 3 } } });
  assert.equal(J(s, 'state/daily_jfk/latest.json').status, 'blocked');
  assert.deepEqual(await getBaseline(s, 'daily_jfk'), [31]);
});

test('the baseline keeps only the most recent counts', async () => {
  const s = memStore();
  for (let i = 0; i < RECENT_KEEP + 5; i++) {
    await publishResult(s, { pipeline: 'daily_jfk', runTime: new Date(Date.UTC(2026, 9, 1 + i, 8)), result: ok(100 + i) });
  }
  const b = await getBaseline(s, 'daily_jfk');
  assert.equal(b.length, RECENT_KEEP);
  assert.equal(b.at(-1), 100 + RECENT_KEEP + 4);
});

test('a result already recorded for a run is never overwritten; quarantine goes under raw/quarantine', async () => {
  const s = memStore();
  const q = { pipeline: 'multi_origin', records: [{ route_key: 'JFK:Bali, Indonesia', bucket: 'deals', reason: 'bad_price' }] };
  const r1 = await publishResult(s, { pipeline: 'multi_origin', runTime: RUN, result: ok(31), quarantine: q });
  const before = s.objs.get(r1.resultKey);
  const r2 = await publishResult(s, { pipeline: 'multi_origin', runTime: RUN, result: { ...ok(5), status: 'blocked' } });
  assert.deepEqual(s.objs.get(r1.resultKey), before);
  assert.deepEqual(r2.wrote, []);
  assert.ok(s.objs.has('raw/quarantine/multi_origin/date=2026-10-24/run=20261024T143835Z.json'));
});

test('an unknown pipeline is refused', async () => {
  await assert.rejects(() => publishResult(memStore(), { pipeline: 'nope', runTime: RUN, result: ok() }), /unknown pipeline/);
});

// ---- the Worker's health check -----------------------------------------------------------------------------------------

const rawBinding = (files) => ({ async get(key) { return key in files ? { text: async () => JSON.stringify(files[key]) } : null; } });
const NOW = new Date('2026-10-24T20:00:00Z');
const latest = (over = {}) => ({ pipeline: 'x', run_id: 'run=1', status: 'ok', published_at: '2026-10-24T18:00:00Z', failed_checks: [], ...over });

test('no RAW binding, or no result yet, reports nothing', async () => {
  assert.deepEqual((await checkRunResults({}, NOW)).problems, []);
  assert.deepEqual((await checkRunResults({ RAW: rawBinding({}) }, NOW)).problems, []);
});

test('a blocked run is reported with its failed checks', async () => {
  const env = { RAW: rawBinding({ 'state/daily_jfk/latest.json': latest({ status: 'blocked', failed_checks: ['schema_ranked'], run_id: 'run=20261024T080000Z' }), 'state/multi_origin/latest.json': latest() }) };
  const { problems } = await checkRunResults(env, NOW);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /BLOCKED the run run=20261024T080000Z \(schema_ranked\)/);
});

test('a pipeline that stopped recording results is reported by age', async () => {
  const env = { RAW: rawBinding({
    'state/daily_jfk/latest.json': latest({ published_at: '2026-10-22T00:00:00Z' }),
    'state/multi_origin/latest.json': latest({ published_at: '2026-10-24T05:00:00Z' }),
  }) };
  const { problems } = await checkRunResults(env, NOW);
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /JFK daily fetch.*limit is 36/);
  assert.match(problems.join('\n'), /hourly multi-origin fetch.*limit is 14/);
});

test('a healthy pair of pipelines reports nothing; an unreadable object is a problem, not a crash', async () => {
  const good = { RAW: rawBinding({ 'state/daily_jfk/latest.json': latest(), 'state/multi_origin/latest.json': latest() }) };
  assert.deepEqual((await checkRunResults(good, NOW)).problems, []);
  const broken = { RAW: { get: async () => { throw new Error('R2 down'); } } };
  const r = await checkRunResults(broken, NOW);
  assert.equal(r.problems.length, RUN_RESULT_LIMITS.length);
});

test('checkDataFreshness folds the gate verdicts into its problems', async () => {
  const env = {
    ASSETS: { fetch: async () => new Response('{}') },
    RAW: rawBinding({ 'state/daily_jfk/latest.json': latest({ status: 'blocked', failed_checks: ['failed_calls'] }), 'state/multi_origin/latest.json': latest() }),
  };
  const { problems } = await checkDataFreshness(env, NOW);
  assert.ok(problems.some((p) => /BLOCKED/.test(p)));
});

// ---- repository wiring ---------------------------------------------------------------------------------------------

test('the Worker has the read-only RAW binding to the private bucket', () => {
  const w = fs.readFileSync('wrangler.jsonc', 'utf8');
  assert.match(w, /"binding": "RAW", "bucket_name": "sparkfare-raw"/);
});

test('the ranking and PTO scripts stamp their serving files with a schema version', () => {
  assert.match(fs.readFileSync('Phase 1 Deal Ranking Script (Step 9 - with fallback).py', 'utf8'), /"schema_version": SERVING_SCHEMA_VERSION/);
  assert.match(fs.readFileSync('Phase 22 PTO Window Fetch (Step 73).py', 'utf8'), /store\["schema_version"\] = 1/);
  assert.match(fs.readFileSync('Phase 1 Flight Fetch Script (Step 8).py', 'utf8'), /SPARKFARE_RUN_STATS_PATH/);
});

test('config origins match the fetched origins (US + TLV)', () => {
  const y = fs.readFileSync('.github/workflows/hourly-multi-origin-fetch.yml', 'utf8');
  const fetched = [...y.match(/'schedule' && '([^']+)'/)[1].matchAll(/\b[A-Z]{3}\b/g)].map((m) => m[0]).sort();
  const cfg = JSON.parse(fs.readFileSync('config/data_quality.json', 'utf8')).origins.slice().sort();
  assert.deepEqual(cfg, fetched);
});

for (const [wf, pipeline, ranked, store] of [
  ['.github/workflows/daily-fetch.yml', 'daily_jfk', 'sparkfare_ranked_deals.json', 'sparkfare_flight_prices.json'],
  ['.github/workflows/hourly-multi-origin-fetch.yml', 'multi_origin', 'sparkfare_hourly_ranked_deals.json', 'sparkfare_hourly_flight_prices.json'],
]) {
  test(`${wf}: validate after ranking, record the result, restore on a block, commit only when not blocked, then fail the job`, () => {
    const y = fs.readFileSync(wf, 'utf8');
    const at = (s) => { const i = y.indexOf(s); assert.ok(i >= 0, `${wf}: missing ${s}`); return i; };
    const rank = at(wf.includes('hourly') ? 'name: Rank multi-origin prices' : 'name: Run deal ranking script');
    const validate = at('id: validate\n');
    const publish = at('id: result_pub');
    const restore = at('name: Restore the last good files if the run was blocked');
    const commit = at(wf.includes('hourly') ? 'name: Commit hourly data' : 'name: Commit updated data files');
    const fail = at('name: Fail the job if the raw archive upload or the validation gate failed');
    assert.ok(rank < validate && validate < publish && publish < restore && restore < commit && commit < fail, `${wf}: step order`);
    assert.ok(y.includes(`validate_feed.py --pipeline ${pipeline} --ranked ${ranked}`), `${wf}: validates ${ranked}`);
    assert.ok(y.includes(`--store ${store}`));
    assert.ok(y.includes('--write-clean'));
    assert.ok(/id: validate\n\s+continue-on-error: true/.test(y), 'the gate must not stop the later steps; the final step fails the job');
    assert.ok(y.slice(commit - 10, commit + 160).includes("steps.validate.outcome != 'failure'"), 'a blocked run must not be committed');
    assert.ok(y.slice(restore, restore + 300).includes("steps.validate.outcome == 'failure'"));
    assert.ok(y.slice(fail, fail + 400).includes("steps.validate.outcome == 'failure'"), 'a blocked run must fail the job');
    assert.ok(y.includes('SPARKFARE_RUN_STATS_PATH: fetch_run_stats.json'));
    assert.ok(y.includes('pip install requests jsonschema'));
  });
}

test('the restore step puts back exactly the files the commit step would add', () => {
  const y = fs.readFileSync('.github/workflows/daily-fetch.yml', 'utf8');
  const restored = y.match(/git checkout -- ([^\n]+)/)[1].split(/\s+/).sort();
  const added = y.match(/git add ([^\n]+)/)[1].split(/\s+/).sort();
  assert.deepEqual(restored, added);
});
