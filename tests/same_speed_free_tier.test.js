// ROADMAP step 58: the free tier's delay is a setting. 24 (the default) must behave exactly as before; 0 serves the
// newest snapshot. These tests run the real Python compile and ranking scripts on temporary files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computePriceCheck, isDelayedRecord, DELAY_NOTICE_HOURS } from '../src/priceCheck.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PY = ['python', 'py', 'python3'].find((c) => spawnSync(c, ['--version']).status === 0);
const py = { skip: PY ? false : 'no python interpreter available' };
const COMPILE = path.join(ROOT, 'Phase 11 Compile Free Tier View.py');
const RANK = path.join(ROOT, 'Phase 1 Deal Ranking Script (Step 9 - with fallback).py');

const HOUR = 3600000;
const stamp = (d) => `${d.toISOString().replace(/[-:]/g, '').replace('Z', '').replace(/^(\d{8})T/, (m, a) => `${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6, 8)}T`)}+0000`;

// A snapshot file named the way the fetch script names them, whose prices encode how old the snapshot is.
function snapshotDir(agesHours, now = new Date()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-snap-'));
  for (const age of agesHours) {
    const at = new Date(now.getTime() - age * HOUR);
    const entries = {};
    for (const origin of ['JFK', 'LAX', 'TLV']) {
      const key = `${origin}:Lisbon, Portugal`;
      entries[key] = {
        display_name: 'Lisbon, Portugal', origin, group: 'shoulder_season', iata: 'LIS',
        fetched_at: at.toISOString(),
        results: [{ price: 1000 + age, airline: 'TP', departure_at: '2027-05-11T10:00:00', return_at: '2027-05-18T10:00:00', expires_at: at.toISOString(), booking_link: `https://www.aviasales.com/search/${origin}1105LIS18051?marker=314524` }],
      };
    }
    fs.writeFileSync(path.join(dir, `flight_prices_${stamp(at)}.json`), JSON.stringify(entries));
  }
  return dir;
}

function compile({ dir, delay, origins = 'LAX,TLV', exclude, out }) {
  const env = { ...process.env, SPARKFARE_SNAPSHOT_DIR: dir, SPARKFARE_FREE_TIER_FEED_PATH: out, SPARKFARE_FREE_ORIGINS: origins };
  delete env.SPARKFARE_FREE_TIER_DELAY_HOURS;
  delete env.SPARKFARE_FREE_ORIGINS_EXCLUDE;
  if (delay !== undefined) env.SPARKFARE_FREE_TIER_DELAY_HOURS = String(delay);
  if (exclude !== undefined) env.SPARKFARE_FREE_ORIGINS_EXCLUDE = exclude;
  const r = spawnSync(PY, [COMPILE], { cwd: ROOT, env, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, view: r.status === 0 ? JSON.parse(fs.readFileSync(out, 'utf8')) : null, raw: r.status === 0 ? fs.readFileSync(out, 'utf8') : null };
}
const tmpOut = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-out-')), 'view.json');
const priceOf = (view, key) => view[key].results[0].price;

test('default and an explicit 24 serve the newest snapshot at least 24 hours old', py, () => {
  const dir = snapshotDir([1, 25, 49]);
  const unset = compile({ dir, out: tmpOut() });
  const set24 = compile({ dir, delay: 24, out: tmpOut() });
  assert.equal(unset.status, 0, unset.stderr);
  assert.equal(priceOf(unset.view, 'LAX:Lisbon, Portugal'), 1025, 'the 25 hour old snapshot');
  assert.equal(unset.raw, set24.raw, 'an explicit 24 is byte-identical to the default');
});

test('delay 0 serves the newest snapshot', py, () => {
  const dir = snapshotDir([1, 25, 49]);
  const r = compile({ dir, delay: 0, out: tmpOut() });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(priceOf(r.view, 'LAX:Lisbon, Portugal'), 1001, 'the 1 hour old snapshot');
  assert.match(r.stdout, /delay 0h/);
});

test('setting the delay back to 24 restores the old output exactly', py, () => {
  const dir = snapshotDir([1, 25, 49]);
  const before = compile({ dir, delay: 24, out: tmpOut() }).raw;
  compile({ dir, delay: 0, out: tmpOut() });
  const after = compile({ dir, delay: 24, out: tmpOut() }).raw;
  assert.equal(after, before);
});

test('a delay with no snapshot old enough is an error, not a silent fallback', py, () => {
  const dir = snapshotDir([1, 2]);
  const r = compile({ dir, delay: 24, out: tmpOut() });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /No snapshot is at least 24 hours old/);
  assert.equal(compile({ dir, delay: 0, out: tmpOut() }).status, 0);
});

test('an invalid delay is rejected; an empty one means 24', py, () => {
  const dir = snapshotDir([1, 25]);
  for (const bad of ['abc', '-1', '1.5']) {
    const r = compile({ dir, delay: bad, out: tmpOut() });
    assert.notEqual(r.status, 0, bad);
    assert.match(r.stderr, /SPARKFARE_FREE_TIER_DELAY_HOURS/);
  }
  const empty = compile({ dir, delay: '', out: tmpOut() });
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(priceOf(empty.view, 'LAX:Lisbon, Portugal'), 1025);
});

test('ALL minus JFK is the same view as listing the origins, and needs no origin list', py, () => {
  const dir = snapshotDir([1, 25]);
  const listed = compile({ dir, delay: 0, origins: 'LAX,TLV', out: tmpOut() });
  const all = compile({ dir, delay: 0, origins: 'ALL', exclude: 'JFK', out: tmpOut() });
  assert.equal(all.status, 0, all.stderr);
  assert.deepEqual(Object.keys(all.view).sort(), ['LAX:Lisbon, Portugal', 'TLV:Lisbon, Portugal']);
  assert.equal(all.raw, listed.raw);
  const everything = compile({ dir, delay: 0, origins: 'ALL', out: tmpOut() });
  assert.equal(Object.keys(everything.view).length, 3, 'JFK included when nothing is excluded');
});

// ---- ranking: running it every hour must not duplicate or skew history ---------------------------------------

function rank({ feed, history, ranked }) {
  const env = { ...process.env, SPARKFARE_FLIGHT_PRICES_PATH: feed, SPARKFARE_PRICE_HISTORY_PATH: history, SPARKFARE_RANKED_DEALS_PATH: ranked };
  const r = spawnSync(PY, [RANK], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { history: JSON.parse(fs.readFileSync(history, 'utf8')), ranked: JSON.parse(fs.readFileSync(ranked, 'utf8')) };
}
function feedWith(price, at = new Date()) {
  return { 'LAX:Lisbon, Portugal': { display_name: 'Lisbon, Portugal', origin: 'LAX', group: 'shoulder_season', iata: 'LIS', fetched_at: at.toISOString(), results: [{ price, airline: 'TP', departure_at: '2027-05-11T10:00:00', return_at: '2027-05-18T10:00:00', expires_at: null, booking_link: 'https://www.aviasales.com/search/LAX1105LIS18051?marker=314524' }] } };
}
function rankingFiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-rank-'));
  return { feed: path.join(dir, 'feed.json'), history: path.join(dir, 'history.json'), ranked: path.join(dir, 'ranked.json') };
}
const todays = (history) => history['LAX:Lisbon, Portugal'].filter((h) => h.date === new Date().toISOString().slice(0, 10));

test('ranking twice in one day writes one history point and the same classification', py, () => {
  const f = rankingFiles();
  fs.writeFileSync(f.feed, JSON.stringify(feedWith(900)));
  const a = rank(f);
  const b = rank(f);
  assert.equal(todays(b.history).length, 1, 'one point for today, not one per run');
  assert.deepEqual(b.history, a.history);
  const strip = (r) => JSON.stringify(r, (k, v) => (k === 'generated_at' ? undefined : v));
  assert.equal(strip(b.ranked), strip(a.ranked));
});

test('a later, higher price the same day never raises the stored price; a lower one lowers it', py, () => {
  const f = rankingFiles();
  fs.writeFileSync(f.feed, JSON.stringify(feedWith(900)));
  rank(f);
  fs.writeFileSync(f.feed, JSON.stringify(feedWith(1100)));
  const higher = rank(f);
  assert.equal(todays(higher.history)[0].price, 900);
  fs.writeFileSync(f.feed, JSON.stringify(feedWith(800)));
  const lower = rank(f);
  assert.equal(todays(lower.history)[0].price, 800);
  assert.equal(todays(lower.history).length, 1);
});

// ---- /check: the "about a day behind" note follows the data, not a hard-coded rule ----------------------------

test('isDelayedRecord: JFK never, an old non-JFK record yes, a fresh non-JFK record no, no timestamp keeps the old rule', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const at = (h) => new Date(now.getTime() - h * HOUR).toISOString();
  assert.equal(isDelayedRecord({ origin: 'JFK', found_at: at(30) }, now), false);
  assert.equal(isDelayedRecord({ origin: 'LAX', found_at: at(26) }, now), true);
  assert.equal(isDelayedRecord({ origin: 'LAX', found_at: at(DELAY_NOTICE_HOURS) }, now), true);
  assert.equal(isDelayedRecord({ origin: 'LAX', found_at: at(5) }, now), false);
  assert.equal(isDelayedRecord({ origin: 'LAX' }, now), true);
  assert.equal(isDelayedRecord({ origin: 'LAX', found_at: 'garbage' }, now), true);
  assert.equal(isDelayedRecord(null, now), false);
});

test('computePriceCheck carries the data-driven delayed flag', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const rec = (h) => ({ origin: 'LAX', display_name: 'Lisbon, Portugal', observations: [], found_at: new Date(now.getTime() - h * HOUR).toISOString() });
  assert.equal(computePriceCheck(rec(26), 400, now).delayed, true);
  assert.equal(computePriceCheck(rec(3), 400, now).delayed, false);
});

// ---- the workflows ------------------------------------------------------------------------------------------

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('hourly workflow: the same-speed steps run only when the variable is exactly "0", and its files are committed', () => {
  const y = read('.github/workflows/hourly-multi-origin-fetch.yml');
  const compile = y.split('- name: Compile same-speed free-tier view')[1].split('- name:')[0];
  const rankStep = y.split('- name: Rank same-speed free-tier view')[1].split('- name:')[0];
  for (const step of [compile, rankStep]) assert.match(step, /if: \$\{\{ vars\.SPARKFARE_FREE_TIER_DELAY_HOURS == '0' \}\}/);
  assert.match(compile, /SPARKFARE_FREE_ORIGINS: ALL/);
  assert.match(compile, /SPARKFARE_FREE_ORIGINS_EXCLUDE: JFK/);
  assert.doesNotMatch(compile, /DEN,PHX|LAX,ORD/, 'no third copy of the origin list');
  assert.match(y, /git add sparkfare_flight_prices_other_origins\.json sparkfare_price_history_other_origins\.json sparkfare_ranked_deals_other_origins\.json/);
});

test('daily compile: one variable, default 24, and the compile and rank steps are skipped when it is "0"', () => {
  const y = read('.github/workflows/daily-compile-other-origins.yml');
  assert.match(y, /SPARKFARE_FREE_TIER_DELAY_HOURS: \$\{\{ vars\.SPARKFARE_FREE_TIER_DELAY_HOURS \|\| '24' \}\}/);
  for (const name of ['Compile delayed view for non-JFK origins', 'Rank other-origins deals']) {
    const step = y.split(`- name: ${name}`)[1].split('- name:')[0];
    assert.match(step, /if: \$\{\{ vars\.SPARKFARE_FREE_TIER_DELAY_HOURS != '0' \}\}/, name);
  }
  assert.match(y, /Regenerate pSEO pages/, 'the page regeneration still runs');
});

test('nothing sets the variable to 0 outside the one flagged step, so shipping this changes no behaviour', () => {
  for (const f of fs.readdirSync(path.join(ROOT, '.github/workflows'))) {
    const y = read(`.github/workflows/${f}`);
    const zeros = y.match(/SPARKFARE_FREE_TIER_DELAY_HOURS: "?0"?\s*$/gm) || [];
    if (f === 'hourly-multi-origin-fetch.yml') {
      assert.equal(zeros.length, 1, 'exactly the flagged compile step');
      const idx = y.indexOf('SPARKFARE_FREE_TIER_DELAY_HOURS: "0"');
      assert.match(y.slice(Math.max(0, idx - 700), idx), /if: \$\{\{ vars\.SPARKFARE_FREE_TIER_DELAY_HOURS == '0' \}\}/, 'and that step is guarded by the variable');
    } else {
      assert.equal(zeros.length, 0, `${f} must not set the delay to 0`);
    }
  }
  const daily = read('.github/workflows/daily-compile-other-origins.yml');
  assert.doesNotMatch(daily, /SPARKFARE_FREE_TIER_DELAY_HOURS: "24"/, 'the daily value comes from the variable now');
});
