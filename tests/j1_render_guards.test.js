// Addendum J, J1 A2/A3/A6: render-time guards outside the homepage and route pages, and the missing-found_at fix.
// Found in the 2026-10-24 re-trace (docs/j1_a6_and_consumer_trace_2026-10-24.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fareStillShowable, fareNote, freshnessState } from '../src/priceFreshness.js';
import { ogCardHtml } from '../src/index.js';
import { buildPinPayload } from '../src/pinterest.js';
import { dealQuality } from '../src/dealQuality.js';

const NOW = Date.parse('2026-10-24T13:00:00Z');
const h = (n) => new Date(NOW + n * 3600000).toISOString();

test('fareStillShowable: gone and lapsed fares are refused, everything else passes', () => {
  assert.equal(fareStillShowable({ found_at: h(-3), departure_at: h(24 * 20) }, NOW), true);
  assert.equal(fareStillShowable({ found_at: h(-3), departure_at: h(47) }, NOW), false, 'leaves within 48 hours');
  assert.equal(fareStillShowable({ found_at: h(-3), departure_at: h(-5) }, NOW), false, 'already left');
  assert.equal(fareStillShowable({ found_at: h(-24 * 5), departure_at: h(24 * 20) }, NOW), false, 'last seen 5 days ago');
  assert.equal(fareStillShowable({ is_stale_fallback: true, last_fresh_date: '2026-10-20', departure_at: h(24 * 20) }, NOW), false, 'carried forward from 4 days ago');
  assert.equal(fareStillShowable({ is_stale_fallback: true, last_fresh_date: '2026-10-22', departure_at: h(24 * 20) }, NOW), true);
  assert.equal(fareStillShowable({ price: 300 }, NOW), true, 'no dates at all: nothing to refuse on');
});

test('A6 edge case: no found_at never prints a bogus age or a time without a zone (Worker)', () => {
  const item = { price: 500, last_fresh_date: '2026-10-23' };
  assert.equal(fareNote(item, NOW, 'UTC'), 'Last seen Oct 23.');
  assert.doesNotMatch(fareNote(item, NOW, 'UTC'), /days ago/);
  assert.equal(fareNote({ price: 500 }, NOW, 'UTC'), '');
  assert.equal(freshnessState(item, NOW), 'aging');
});

test('A6 edge case: the same fix on the homepage', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').split(String.fromCharCode(13, 10)).join('\n');
  const block = html.match(/const PRICE_FRESH_HOURS = 48;[\s\S]*?\nfunction prepareBoard\(deals, nowMs\) \{[\s\S]*?\n\}\n/)[0];
  const api = vm.runInNewContext(`${block}; ({ asOfText })`, { Date, Math, Number, Intl });
  assert.equal(api.asOfText({ price: 500, last_fresh_date: '2026-10-23' }, NOW), 'Last seen Oct 23.');
  assert.equal(api.asOfText({ price: 500 }, NOW), '');
  assert.match(api.asOfText({ found_at: h(-60) }, NOW, 'America/New_York'), /^Prices as of Oct 2[12], .*EDT · 2 days ago$/, 'a timed line keeps its zone and age');
});

test('share card: a deal that is no longer showable is not drawn as a fare', () => {
  // ogCardHtml judges freshness against the real clock (Date.now()), so this test builds its dates from the real clock too. With the fixed NOW above, the
  // fare's found_at aged past 48 hours once real time passed 2026-10-26 and the first assertion started failing.
  const real = Date.now();
  const r = (n) => new Date(real + n * 3600000).toISOString();
  const base = { status: 'deal', basis_text: '30% below 30-day median, 20 observations', price: 400, found_at: r(-3) };
  const card = (record, date) => JSON.stringify(ogCardHtml({ record, origin: 'JFK', dest: 'Lisbon, Portugal', date, generatedAtIso: r(-3) }));
  const farDate = r(24 * 20).slice(0, 10);
  assert.ok(card({ ...base, departure_at: r(24 * 20) }, farDate).includes('$400'));
  const soonDate = r(30).slice(0, 10);
  assert.ok(!card({ ...base, departure_at: r(30) }, soonDate).includes('$400'), 'a fare leaving within 48 hours is not drawn');
});

test('Pinterest: refuses a pin for a fare that has gone', () => {
  const days = Array.from({ length: 20 }, (_, i) => ({ date: new Date(NOW - (20 - i) * 86400000).toISOString().slice(0, 10), price: 900 }));
  const deal = { price: 500, found_at: h(-3), observations: days, departure_at: h(30) };
  const opts = { origin: 'JFK', destination: 'Lisbon, Portugal', appUrl: 'https://sparkfare.com', boardId: 'b', dealQualityFn: dealQuality, now: new Date(NOW) };
  const out = buildPinPayload(deal, opts);
  assert.equal(out.ok, false);
  assert.match(out.error, /no longer showable/);
  const fine = buildPinPayload({ ...deal, departure_at: h(24 * 20) }, opts);
  assert.equal(fine.ok, true, JSON.stringify(fine));
});

test('digest and archive: the shared loader drops gone and lapsed fares', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(src, /filter\(\(deal\) => fareStillShowable\(deal, nowMs\)\)/);
});

// ---- Python: the newsletter and social post use the same rule (skipped where Python is not installed; CI runs them) ----
function findPython() {
  for (const cmd of ['python3', 'python', 'py']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /Python 3/.test(`${r.stdout}${r.stderr}`)) return cmd;
  }
  return null;
}
const PYTHON = findPython();
const maybe = { skip: PYTHON ? false : 'python is not available' };

test('Python fare_showable agrees with the Worker rule', maybe, () => {
  const cases = [
    [{ found_at: h(-3), departure_at: h(24 * 20) }, true],
    [{ found_at: h(-3), departure_at: h(47) }, false],
    [{ found_at: h(-3), departure_at: h(-5) }, false],
    [{ found_at: h(-24 * 5), departure_at: h(24 * 20) }, false],
    [{ is_stale_fallback: true, last_fresh_date: '2026-10-20', departure_at: h(24 * 20) }, false],
    [{ is_stale_fallback: true, last_fresh_date: '2026-10-22', departure_at: h(24 * 20) }, true],
    [{ price: 300 }, true],
  ];
  const code = [
    'import json, sys',
    'from datetime import datetime, timezone',
    'sys.path.insert(0, ".")',
    'from newsletter_subjects import fare_showable',
    'now = datetime(2026, 10, 24, 13, 0, tzinfo=timezone.utc)',
    'cases = json.load(sys.stdin)',
    'print(json.dumps([fare_showable(c[0], now) for c in cases]))',
  ].join('\n');
  const r = spawnSync(PYTHON, ['-c', code], { input: JSON.stringify(cases), encoding: 'utf8', cwd: process.cwd() });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), cases.map((c) => c[1]));
});

test('the newsletter generator and the social post both call the guard', () => {
  const nl = fs.readFileSync(new URL('../Phase 19 Newsletter Generator.py', import.meta.url), 'utf8');
  const sb = fs.readFileSync(new URL('../Phase 3 Social Broadcaster.py', import.meta.url), 'utf8');
  assert.equal((nl.match(/ns\.fare_showable\(d\)/g) || []).length, 2, 'JFK and the other origins');
  assert.match(sb, /from newsletter_subjects import fare_showable/);
  assert.match(sb, /d\.get\('status'\) == 'deal' and fare_showable\(d\)/);
});
