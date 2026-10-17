// Addendum J, J0 item 2 (D-021): the deal-floor dry run is read-only and its building blocks are right. It prints tables; it changes no data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { median, distinctDays, evaluate, run, FLOOR, STEPS } from '../scripts/deal-floor-dry-run.mjs';

const GEN = '2026-10-17T08:00:00Z';
const days = (prices, start = '2026-10-01') => prices.map((p, i) => ({ date: new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10), price: p }));

test('the constants are the approved rule: 15% below the median, 10 distinct days', () => {
  assert.equal(FLOOR.MIN_PCT_BELOW, 0.15);
  assert.equal(FLOOR.MIN_DISTINCT_DAYS, 10);
});

test('the median is over distinct days: a repeated day counts once, at its cheapest price', () => {
  const rec = { price: 500, observations: [...days([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]), { date: '2026-10-03', price: 400 }, { date: '2026-10-03', price: 2000 }] };
  const d = distinctDays(rec);
  assert.equal(d.n, 10, 'two entries on Oct 3 are one day');
  assert.equal(d.prices.filter((p) => p === 400).length, 1);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), 0);
});

test('a fare is a deal only at 15% or more below the median and with 10 distinct days', () => {
  const base = (n, price) => ({ price, status: 'deal', median_baseline: 1000, observations: days(Array(n).fill(1000)), found_at: '2026-10-17T07:00:00Z', last_fresh_date: '2026-10-17', departure_at: '2026-12-01T10:00:00Z' });
  const floor = STEPS[2][1];
  const ok = (rec) => floor({ rec, bucket: 'deals', generatedAt: GEN }, evaluate(rec, GEN));
  assert.equal(ok(base(12, 850)), true, 'exactly 15% below, 12 days');
  assert.equal(ok(base(12, 851)), false, '14.9% below');
  assert.equal(ok(base(9, 500)), false, '9 days is not enough');
  assert.equal(ok(base(10, 500)), true, '10 days is enough');
});

test('stale and near departures are flagged: fallback flag, last fresh over 3 days, departing inside 48 hours', () => {
  const rec = (over) => ({ price: 500, observations: days(Array(12).fill(1000)), found_at: '2026-10-17T07:00:00Z', last_fresh_date: '2026-10-17', departure_at: '2026-12-01T10:00:00Z', ...over });
  assert.equal(evaluate(rec({}), GEN).stale, false);
  assert.equal(evaluate(rec({ is_stale_fallback: true }), GEN).stale, true);
  assert.equal(evaluate(rec({ last_fresh_date: '2026-10-13' }), GEN).stale, true, '4 days');
  assert.equal(evaluate(rec({ last_fresh_date: '2026-10-14' }), GEN).stale, false, '3 days is still allowed');
  assert.equal(evaluate(rec({ departure_at: '2026-10-12T10:00:00Z' }), GEN).pastOrNear, true, 'already departed');
  assert.equal(evaluate(rec({ departure_at: '2026-10-19T07:59:00Z' }), GEN).pastOrNear, true, 'under 48 hours');
  assert.equal(evaluate(rec({ departure_at: '2026-10-19T08:01:00Z' }), GEN).pastOrNear, false);
});

test('on the checked-in data every step can only remove deals, and the script changes no file', () => {
  const before = ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json'].map((f) => fs.statSync(new URL('../' + f, import.meta.url)).mtimeMs);
  const { table, us } = run(new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
  const counts = table.slice(0, 5).map((t) => t.us);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] <= counts[i - 1], `step ${i} does not add deals: ${counts.join(' >= ')}`);
  assert.ok(us.length >= 20 && !us.includes('TLV'), 'US origins only in the US total');
  const after = ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json'].map((f) => fs.statSync(new URL('../' + f, import.meta.url)).mtimeMs);
  assert.deepEqual(after, before);
  const src = fs.readFileSync(new URL('../scripts/deal-floor-dry-run.mjs', import.meta.url), 'utf8');
  assert.ok(!/writeFileSync|appendFileSync|\.rmSync|unlinkSync/.test(src), 'the script never writes');
});
