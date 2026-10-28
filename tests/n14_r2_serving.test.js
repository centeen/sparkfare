// N14 (Addendum N, ROADMAP step 161): R2 serving, dark. The Worker reads, the publish script writes; both against fakes, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, { loadJsonAsset } from '../src/index.js';
import { serveRankedFile, servedJson, r2ServingEnabled, R2_SERVED_FILES, R2_SERVED_PATHS, latestKey } from '../src/r2Serving.js';
import { publishFile, rollbackFile, validateServable, KEEP_VERSIONS, SERVED_FILES, latestKey as pLatest, versionKey, indexKey } from '../scripts/data/publish-serving.mjs';
import { checkServedFiles } from '../src/dataAlerts.js';

const deployed = { generated_at: '2026-11-01T06:00:00Z', deals: [{ display_name: 'FROM-ASSET' }], featured: [] };
const inR2 = { generated_at: '2026-11-01T11:00:00Z', deals: [{ display_name: 'FROM-R2' }], featured: [] };
const bytes = (o) => Buffer.from(JSON.stringify(o));
const assets = (o = deployed) => ({ async fetch(req) { return new URL(req.url).pathname.endsWith('.json') ? new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('nf', { status: 404 }); } });
const raw = (map) => ({ async get(key) { if (!(key in map)) return null; const buf = Buffer.from(map[key]); return { async arrayBuffer() { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); } }; } });
const req = (p, method = 'GET') => new Request(`https://sparkfare.com${p}`, { method });
const FILE = 'sparkfare_ranked_deals.json';

function memStore() {
  const m = new Map(); const log = [];
  return {
    m, log,
    async fetch(k) { return m.has(k) ? Buffer.from(m.get(k)) : null; },
    async put(k, b) { log.push(['put', k]); m.set(k, Buffer.from(b)); },
    async delete(k) { log.push(['delete', k]); m.delete(k); },
  };
}

test('flag off: the served paths answer exactly as the asset does, and R2 is never read', async () => {
  let reads = 0;
  const RAW = { async get() { reads += 1; return null; } };
  for (const p of R2_SERVED_PATHS) {
    const a = assets();
    const direct = await a.fetch(req(p)); const via = await worker.fetch(req(p), { ASSETS: a, RAW }, { waitUntil() {} });
    assert.equal(via.status, 200);
    assert.equal(await via.text(), await direct.text());
  }
  assert.equal(reads, 0);
  assert.equal(r2ServingEnabled({ RAW: {} }), false); assert.equal(r2ServingEnabled({ ENABLE_R2_SERVING: 'true' }), false, 'no bucket binding: off');
});

test('flag on: the R2 copy is served byte for byte with no-store, for GET and HEAD', async () => {
  const body = JSON.stringify(inR2);
  const env = { ENABLE_R2_SERVING: 'true', ASSETS: assets(), RAW: raw({ [latestKey(FILE)]: body }) };
  const res = await worker.fetch(req(`/${FILE}`), env, { waitUntil() {} });
  assert.equal(await res.text(), body);
  assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('content-type'), 'application/json'); assert.equal(res.headers.get('x-sparkfare-data-source'), 'r2');
  const head = await worker.fetch(req(`/${FILE}`, 'HEAD'), env, { waitUntil() {} });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
});

test('flag on, but the object is missing or R2 throws: the deployed asset answers, never an empty board', async () => {
  const missing = { ENABLE_R2_SERVING: 'true', ASSETS: assets(), RAW: raw({}) };
  assert.match(await (await worker.fetch(req(`/${FILE}`), missing, { waitUntil() {} })).text(), /FROM-ASSET/);
  const broken = { ENABLE_R2_SERVING: 'true', ASSETS: assets(), RAW: { get: async () => { throw new Error('r2 down'); } } };
  const error = console.error; console.error = () => {};
  try { assert.match(await (await worker.fetch(req(`/${FILE}`), broken, { waitUntil() {} })).text(), /FROM-ASSET/); } finally { console.error = error; }
});

test('the Worker\'s own readers (loadJsonAsset, the data monitor) see what visitors are served', async () => {
  const on = { ENABLE_R2_SERVING: 'true', ASSETS: assets(), RAW: raw({ [latestKey(FILE)]: JSON.stringify(inR2) }) };
  assert.equal((await loadJsonAsset(on, FILE)).deals[0].display_name, 'FROM-R2');
  assert.equal((await loadJsonAsset({ ...on, ENABLE_R2_SERVING: 'false' }, FILE)).deals[0].display_name, 'FROM-ASSET');
  assert.equal((await servedJson(on, FILE)).generated_at, inR2.generated_at);
  assert.equal((await loadJsonAsset(on, 'sparkfare_destinations.json')).deals[0].display_name, 'FROM-ASSET', 'other files are untouched');
  const fresh = { ...inR2, generated_at: new Date().toISOString() };
  const alerts = await checkServedFiles({ ENABLE_R2_SERVING: 'true', ASSETS: assets(), RAW: raw(Object.fromEntries(R2_SERVED_FILES.map((f) => [latestKey(f), JSON.stringify(fresh)]))) }, new Date());
  assert.deepEqual(alerts.filter((a) => a.id === 'served_files'), [], 'a fresh R2 copy is not reported stale even though the deployed asset is old');
});

test('publish: validates, writes the version, latest and the index; an identical file is a no-op; keys match what the Worker reads', async () => {
  const store = memStore();
  assert.equal(pLatest(FILE), latestKey(FILE));
  const now = new Date('2026-11-01T11:00:05Z');
  const a = await publishFile(store, { file: FILE, bytes: bytes(inR2), now });
  assert.equal(a.status, 'published'); assert.equal(a.version, '20261101T110005Z');
  assert.deepEqual(store.log.map(([, k]) => k), [versionKey(FILE, '20261101T110005Z'), latestKey(FILE), indexKey(FILE)], 'immutable copy first, then latest, then the index');
  const b = await publishFile(store, { file: FILE, bytes: bytes(inR2), now: new Date('2026-11-01T12:00:00Z') });
  assert.equal(b.status, 'unchanged'); assert.equal(JSON.parse(store.m.get(indexKey(FILE))).length, 1);
  const c = await publishFile(store, { file: FILE, bytes: bytes({ ...inR2, generated_at: '2026-11-01T13:00:00Z' }), now: new Date('2026-11-01T13:00:05Z') });
  assert.equal(c.status, 'published'); assert.equal(JSON.parse(store.m.get(latestKey(FILE))).generated_at, '2026-11-01T13:00:00Z');
});

test('publish refuses anything that is not a servable ranked-deals file, and leaves latest alone', async () => {
  const store = memStore(); await publishFile(store, { file: FILE, bytes: bytes(inR2) });
  const before = store.m.get(latestKey(FILE)).toString();
  for (const bad of ['not json', '[]', '{}', JSON.stringify({ generated_at: 'x', deals: [], featured: [] }), JSON.stringify({ generated_at: '2026-11-01T00:00:00Z', deals: {} })]) {
    await assert.rejects(() => publishFile(store, { file: FILE, bytes: Buffer.from(bad) }), /JSON|ranked-deals|generated_at|lists/);
  }
  await assert.rejects(() => publishFile(store, { file: 'sparkfare_flight_prices.json', bytes: bytes(inR2) }), /not a served file/);
  assert.equal(store.m.get(latestKey(FILE)).toString(), before);
  assert.throws(() => validateServable(Buffer.from('{'), FILE));
});

test('only the last 30 versions are kept; older ones are deleted and the index lists the 30', async () => {
  assert.equal(KEEP_VERSIONS, 30, 'the addendum says 30');
  const store = memStore();
  for (let i = 0; i < KEEP_VERSIONS + 3; i++) {
    await publishFile(store, { file: FILE, bytes: bytes({ ...inR2, generated_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() }), now: new Date(Date.UTC(2026, 10, 1, 0, i, 1)) });
  }
  const index = JSON.parse(store.m.get(indexKey(FILE)));
  assert.equal(index.length, KEEP_VERSIONS);
  const versions = [...store.m.keys()].filter((k) => k.includes('/v/'));
  assert.equal(versions.length, KEEP_VERSIONS);
  assert.ok(!store.m.has(versionKey(FILE, '20261101T000001Z')), 'the oldest is gone');
});

test('rollback copies an old version back to latest; a version that does not exist is an error', async () => {
  const store = memStore();
  await publishFile(store, { file: FILE, bytes: bytes(inR2), now: new Date('2026-11-01T11:00:05Z') });
  await publishFile(store, { file: FILE, bytes: bytes({ ...inR2, generated_at: '2026-11-01T14:00:00Z' }), now: new Date('2026-11-01T14:00:05Z') });
  await rollbackFile(store, { file: FILE, version: '20261101T110005Z' });
  assert.equal(JSON.parse(store.m.get(latestKey(FILE))).generated_at, inR2.generated_at);
  await assert.rejects(() => rollbackFile(store, { file: FILE, version: '19990101T000000Z' }), /no version/);
});

test('wiring: the three paths are run-worker-first, the flag ships off, the script and the Worker agree on the files, and every data workflow publishes after its commit', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  for (const p of R2_SERVED_PATHS) assert.ok(cfg.includes(`"${p}"`), p);
  assert.match(cfg, /"ENABLE_R2_SERVING":\s*"false"/);
  assert.deepEqual([...SERVED_FILES].sort(), [...R2_SERVED_FILES].sort());
  for (const [wf, files] of [['daily-fetch', ['sparkfare_ranked_deals.json']], ['hourly-multi-origin-fetch', ['sparkfare_hourly_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json']], ['daily-compile-other-origins', ['sparkfare_ranked_deals_other_origins.json']]]) {
    const y = fs.readFileSync(new URL(`../.github/workflows/${wf}.yml`, import.meta.url), 'utf8');
    assert.ok(y.indexOf('Publish serving files (R2)') > y.indexOf('git push'), `${wf}: published after the commit`);
    assert.ok(y.includes(`publish-serving.mjs publish --files ${files.join(',')}`), wf);
  }
});
