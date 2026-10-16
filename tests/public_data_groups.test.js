// The internal destination-group names ("Cluster 4: Visual Clickbait", ...) are not in anything a visitor can download from
// sparkfare.com. Public data files carry a neutral `group` id; the ranking script still understands the legacy label so an
// old record can never flip a thresholded destination into "featured".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const PY = ['python', 'py', 'python3'].find((c) => spawnSync(c, ['--version']).status === 0);
const py = { skip: PY ? false : 'no python interpreter available' };
const RANK = path.join(ROOT, 'Phase 1 Deal Ranking Script (Step 9 - with fallback).py');
const GROUPS = ['long_haul', 'shoulder_season', 'low_cost_carrier', 'featured'];

function publicJsonFiles() {
  const out = fs.readdirSync(ROOT).filter((f) => f.endsWith('.json') && !/^package(-lock)?\.json$/.test(f)).map((f) => path.join(ROOT, f));
  const snaps = path.join(ROOT, 'sparkfare_hourly_snapshots');
  if (fs.existsSync(snaps)) for (const f of fs.readdirSync(snaps)) if (f.endsWith('.json')) out.push(path.join(snaps, f));
  return out;
}

test('no public JSON file (root data files and the hourly snapshots) contains an internal "Cluster N" label or a cluster key', () => {
  const files = publicJsonFiles();
  assert.ok(files.length >= 100, `expected the data files, found ${files.length}`);
  const bad = files.filter((f) => { const s = fs.readFileSync(f, 'utf8'); return /Cluster [1-4]|Visual Clickbait|"cluster/.test(s); });
  assert.deepEqual(bad.map((f) => path.relative(ROOT, f)), []);
});

test('sparkfare_destinations.json gives all 40 destinations a neutral group id, ten per group', () => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'sparkfare_destinations.json'), 'utf8'));
  const counts = {};
  for (const v of Object.values(d)) { assert.ok(GROUPS.includes(v.group), v.destination); counts[v.group] = (counts[v.group] || 0) + 1; }
  assert.deepEqual(counts, { long_haul: 10, shoulder_season: 10, low_cost_carrier: 10, featured: 10 });
});

test('the fetch script writes `group` for all 40 destinations and never the old label', () => {
  const src = fs.readFileSync(path.join(ROOT, 'Phase 1 Flight Fetch Script (Step 8).py'), 'utf8');
  assert.equal((src.match(/"group": "(long_haul|shoulder_season|low_cost_carrier|featured)"/g) || []).length, 40);
  assert.doesNotMatch(src, /Cluster [1-4]|"cluster"/);
  assert.match(src, /"group": dest\["group"\]/);
});

function rank(entry) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-group-'));
  const feed = path.join(dir, 'feed.json'); const hist = path.join(dir, 'hist.json'); const out = path.join(dir, 'out.json');
  const at = new Date().toISOString();
  fs.writeFileSync(feed, JSON.stringify({ 'Lisbon, Portugal': { display_name: 'Lisbon, Portugal', iata: 'LIS', fetched_at: at, ...entry,
    results: [{ price: 900, airline: 'TP', departure_at: '2027-05-11T10:00:00', return_at: '2027-05-18T10:00:00', expires_at: at, booking_link: 'https://www.aviasales.com/x' }] } }));
  fs.writeFileSync(hist, '{}');
  const r = spawnSync(PY, [RANK], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SPARKFARE_FLIGHT_PRICES_PATH: feed, SPARKFARE_PRICE_HISTORY_PATH: hist, SPARKFARE_RANKED_DEALS_PATH: out } });
  assert.equal(r.status, 0, r.stderr);
  const ranked = JSON.parse(fs.readFileSync(out, 'utf8'));
  const rec = ['deals', 'featured', 'priced_no_deal', 'insufficient_history', 'no_data'].flatMap((b) => ranked[b].map((x) => ({ bucket: b, ...x })))[0];
  fs.rmSync(dir, { recursive: true, force: true });
  return rec;
}

test('ranking script: a thresholded group is judged (not featured), under the new id and under the legacy label', py, () => {
  for (const entry of [{ group: 'shoulder_season' }, { cluster: 'Cluster 2: Shoulder-Season Cliffs' }]) {
    const rec = rank(entry);
    assert.equal(rec.bucket, 'insufficient_history', JSON.stringify(entry));
    assert.equal(rec.group, 'shoulder_season');
    assert.equal('cluster' in rec, false, 'the output never carries the legacy key');
  }
});

test('ranking script: the featured group is featured, under the new id and under the legacy label', py, () => {
  for (const entry of [{ group: 'featured' }, { cluster: 'Cluster 4: Visual Clickbait' }]) {
    const rec = rank(entry);
    assert.equal(rec.bucket, 'featured', JSON.stringify(entry));
    assert.equal(rec.group, 'featured');
  }
});

test('generators read the group id: the blog generator branches on ids and the pSEO generator groups by `group`', () => {
  const blog = fs.readFileSync(path.join(ROOT, 'Phase 20 Blog Generator.py'), 'utf8');
  assert.match(blog, /dest_data\.get\('group', 'long_haul'\)/);
  assert.match(blog, /cluster == "long_haul"/);
  assert.doesNotMatch(blog, /cluster_archetype/);
  assert.match(fs.readFileSync(path.join(ROOT, 'Phase 17 pSEO Generator (Step 106).py'), 'utf8'), /destinations\[d\]\.get\("group"\)/);
});
