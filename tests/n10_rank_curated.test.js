// N10 (Addendum N, ROADMAP step 157): the shadow ranking job. The ranking itself is tested in tests/python/test_rank_curated.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadJsonAsset, SHADOW_SERVED_FILES } from '../src/index.js';
import { PIPELINES, SHADOW_PREFIX, VERDICT_SOURCE, historyQuery, parseD1Rows, main } from '../scripts/data/rank-curated.mjs';
import { pythonCommand } from '../scripts/data/curate-backfill.mjs';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const assets = (files) => ({ fetch: async (req) => { const f = new URL(req.url).pathname.slice(1); return f in files ? new Response(JSON.stringify(files[f])) : new Response('no', { status: 404 }); } });
const raw = (objects) => ({ get: async (key) => (key in objects ? { json: async () => objects[key] } : null) });

test('the three pipelines are exactly the three files the Worker can read from the shadow store', () => {
  assert.deepEqual(PIPELINES.map((p) => p.served).sort(), [...SHADOW_SERVED_FILES].sort());
  assert.ok(PIPELINES.some((p) => p.name === VERDICT_SOURCE));
  for (const p of PIPELINES) { assert.ok(fs.existsSync(new URL(`../${p.feed}`, import.meta.url)), p.feed); assert.ok(fs.existsSync(new URL(`../${p.served}`, import.meta.url)), p.served); }
});

test('the history query reads the 31 days before the run date from fare_daily, newest rows last', () => {
  const q = historyQuery('2026-10-25');
  assert.match(q, /FROM fare_daily WHERE obs_date >= date\('2026-10-25','-31 day'\) ORDER BY route_key, obs_date/);
  assert.doesNotMatch(q, /;|DROP|DELETE|UPDATE|INSERT/i);
});

test('parseD1Rows reads wrangler output and refuses anything unexpected', () => {
  assert.deepEqual(parseD1Rows(JSON.stringify([{ success: true, results: [{ a: 1 }] }])), [{ a: 1 }]);
  assert.throws(() => parseD1Rows(JSON.stringify([{ success: false, results: [] }])), /unexpected/);
  assert.throws(() => parseD1Rows('{"nope":1}'), /unexpected/);
});

test('flag off (the default): the Worker reads the file in git even when a shadow object exists', async () => {
  const env = { ASSETS: assets({ 'sparkfare_ranked_deals.json': { from: 'git' } }), RAW: raw({ [`${SHADOW_PREFIX}sparkfare_ranked_deals.json`]: { from: 'shadow' } }) };
  assert.deepEqual(await loadJsonAsset(env, 'sparkfare_ranked_deals.json'), { from: 'git' });
  assert.deepEqual(await loadJsonAsset({ ...env, ENABLE_CURATED_SERVING: 'false' }, 'sparkfare_ranked_deals.json'), { from: 'git' });
  assert.deepEqual(await loadJsonAsset({ ...env, ENABLE_CURATED_SERVING: 'TRUE' }, 'sparkfare_ranked_deals.json'), { from: 'git' }); // only the exact string
});

test('flag on: the three ranked files come from the shadow store; other files and missing objects still come from git', async () => {
  const shadow = { [`${SHADOW_PREFIX}sparkfare_ranked_deals.json`]: { from: 'shadow' } };
  const env = { ENABLE_CURATED_SERVING: 'true', RAW: raw(shadow), ASSETS: assets({ 'sparkfare_ranked_deals.json': { from: 'git' }, 'sparkfare_hourly_ranked_deals.json': { from: 'git-hourly' }, 'sparkfare_destinations.json': { from: 'git-dest' } }) };
  assert.deepEqual(await loadJsonAsset(env, 'sparkfare_ranked_deals.json'), { from: 'shadow' });
  assert.deepEqual(await loadJsonAsset(env, 'sparkfare_hourly_ranked_deals.json'), { from: 'git-hourly' }); // no shadow object yet
  assert.deepEqual(await loadJsonAsset(env, 'sparkfare_destinations.json'), { from: 'git-dest' }); // never redirected
  const broken = { ...env, RAW: { get: async () => { throw new Error('r2 down'); } } };
  assert.deepEqual(await loadJsonAsset(broken, 'sparkfare_ranked_deals.json'), { from: 'git' }); // an R2 failure is not an empty board
  const noRaw = { ...env, RAW: undefined };
  assert.deepEqual(await loadJsonAsset(noRaw, 'sparkfare_ranked_deals.json'), { from: 'git' });
});

test('the flag ships off in wrangler.jsonc', () => {
  assert.match(read('wrangler.jsonc'), /"ENABLE_CURATED_SERVING": "false"/);
});

test('the shadow workflow runs after the daily refresh, is a dry run by hand, never runs on a pull request and commits only the diffs', () => {
  const y = read('.github/workflows/rank-shadow.yml');
  const refresh = read('.github/workflows/curate-fares-daily.yml').match(/^name: (.+)$/m)[1];
  assert.match(y, new RegExp(`workflows: \\['${refresh.replace(/[()]/g, '\\$&')}'\\]`));
  assert.match(y, /DRY_RUN: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.dry_run != 'false' \}\}/);
  assert.doesNotMatch(y, /pull_request/);
  assert.match(y, /shell: bash\r?\n\s+run: \|\r?\n\s+flags=/); // pipefail: a failure is not hidden by tee
  assert.match(y, /git add docs\/data\/shadow_diffs\/\r?\n/);
  assert.equal((y.match(/git add /g) || []).length, 1);
  assert.doesNotMatch(y, /cron: '\d+ \d+ \* \* \*'[\s\S]*cron:/); // one schedule only
});

test('nothing in src reads route_verdict yet, and the serving files in git are only ever inputs to the job', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const src = fileURLToPathSafe(new URL('../src', import.meta.url));
  assert.deepEqual(walk(src).filter((f) => /route_verdict/.test(fs.readFileSync(f, 'utf8'))), []);
  const job = read('scripts/data/rank-curated.mjs');
  for (const p of PIPELINES) assert.doesNotMatch(job, new RegExp(`writeFileSync\\([^)]*root[^)]*${p.served.replace('.', '\\.')}`), `the job must not write ${p.served}`);
});

function fileURLToPathSafe(u) { return decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, '$1'); }

let python = null;
try { python = pythonCommand(); } catch { /* no interpreter: the end-to-end test is skipped */ }

test('a local run ranks the three feeds, writes a counts-only diff and leaves every file in git untouched', { skip: !python }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n10-'));
  const out = path.join(dir, 'out');
  const rows = [];
  for (let i = 1; i <= 20; i++) rows.push({ route_key: 'JFK:Testville', obs_date: new Date(Date.UTC(2026, 9, 25 - i)).toISOString().slice(0, 10), min_price: 500, first_seen_at: null });
  fs.writeFileSync(path.join(dir, 'rows.json'), JSON.stringify(rows));
  // run from a scratch copy of the repo root's data files so the real ones cannot change
  const root = path.join(dir, 'root');
  fs.mkdirSync(root);
  const mini = { 'JFK:Testville': { display_name: 'Testville', origin: 'JFK', group: 'long_haul', fetched_at: '2026-10-25T07:30:00+00:00', results: [{ price: 300, booking_link: 'x', airline: 'OZ', departure_at: '2027-02-10T10:00:00+00:00', return_at: '2027-02-20T10:00:00+00:00', expires_at: null }] } };
  const empty = { schema_version: 1, generated_at: '2026-10-25T08:00:00+00:00', deals: [], featured: [], priced_no_deal: [], insufficient_history: [], no_data: [] };
  for (const p of PIPELINES) { fs.writeFileSync(path.join(root, p.feed), JSON.stringify(mini)); fs.writeFileSync(path.join(root, p.served), JSON.stringify(empty)); }
  const before = PIPELINES.map((p) => fs.readFileSync(path.join(root, p.served), 'utf8'));
  const cwd = process.cwd();
  process.chdir(root);
  const log = console.log; console.log = () => {};
  let result;
  try { result = await main(['--local', '--fare-daily-file', path.join(dir, 'rows.json'), '--out-dir', out, '--date', '2026-10-25']); } finally { console.log = log; process.chdir(cwd); }
  assert.deepEqual(PIPELINES.map((p) => fs.readFileSync(path.join(root, p.served), 'utf8')), before);
  assert.equal(result.summary.hourly.shadow, 1);
  assert.ok(fs.existsSync(path.join(out, 'route_verdict.sql')));
  const shadow = JSON.parse(fs.readFileSync(path.join(out, 'shadow_sparkfare_ranked_deals.json'), 'utf8'));
  assert.equal(shadow.deals.length, 1);
  const md = fs.readFileSync(path.join(out, '2026-10-25.md'), 'utf8');
  assert.match(md, /# Shadow diff 2026-10-25/);
  assert.doesNotMatch(md, /Testville|300/);
  assert.ok(!fs.existsSync(path.join(root, 'docs')), 'a local run writes no docs/ files');
});
