// Pure helpers of scripts/fare_search_probe.mjs (the owner-run Fare Search spike probe, ROADMAP step 77).
// The script's network steps are not tested here; they need a real White Label and a Travelpayouts token.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sampleTrips, buildCandidateUrl, makeTestIds, PATTERNS, rowsOf, summarizeStats, dnsVerdict, isoDate, addDays,
} from '../scripts/fare_search_probe.mjs';

const NOW = new Date('2026-10-10T12:00:00Z');

test('three sample trips, all in the future, one one-way, and only IATA codes', () => {
  const trips = sampleTrips(NOW);
  assert.equal(trips.length, 3);
  assert.equal(trips.filter((t) => !t.returnDate).length, 1);
  for (const t of trips) {
    assert.match(t.origin, /^[A-Z]{3}$/);
    assert.match(t.destination, /^[A-Z]{3}$/);
    assert.ok(t.departDate > isoDate(NOW));
    if (t.returnDate) assert.ok(t.returnDate > t.departDate);
  }
});

test('candidate URLs: all three patterns, marker is marker.testId, one-way has no return date', () => {
  const [round, oneway] = sampleTrips(NOW);
  const ids = makeTestIds([round, oneway], NOW);
  const urls = PATTERNS.map((p) => buildCandidateUrl({ host: 'fares.sparkfare.com', pattern: p, trip: round, marker: '314524', testId: ids.roundtrip }));
  assert.deepEqual(urls.map((u) => new URL(u).pathname), ['/flights/', '/flights', '/searches/new']);
  for (const u of urls) {
    const q = new URL(u).searchParams;
    assert.equal(q.get('origin_iata'), 'JFK');
    assert.equal(q.get('destination_iata'), 'LIS');
    assert.equal(q.get('marker'), `314524.${ids.roundtrip}`);
    assert.ok(q.get('return_date'));
  }
  const ow = new URL(buildCandidateUrl({ host: 'fares.sparkfare.com', pattern: PATTERNS[0], trip: oneway, marker: '314524', testId: ids.oneway }));
  assert.equal(ow.searchParams.get('return_date'), null);
});

test('the date parameter names can be overridden, so a wrong guess does not need a code change', () => {
  const [round] = sampleTrips(NOW);
  const u = new URL(buildCandidateUrl({ host: 'h.example', pattern: PATTERNS[2], trip: round, marker: '1', testId: 't', dateParams: ['departure_at', 'return_at'] }));
  assert.ok(u.searchParams.get('departure_at'));
  assert.ok(u.searchParams.get('return_at'));
  assert.equal(u.searchParams.get('depart_date'), null);
});

test('test ids are unique per trip and cannot be mistaken for a trip uuid', () => {
  const ids = makeTestIds(sampleTrips(NOW), NOW);
  const vals = Object.values(ids);
  assert.equal(new Set(vals).size, vals.length);
  for (const v of vals) assert.match(v, /^fstest-\d{12}-[a-z]+$/);
});

test('rowsOf accepts results, data or a bare array, and nothing else', () => {
  assert.deepEqual(rowsOf({ results: [{ a: 1 }] }), [{ a: 1 }]);
  assert.deepEqual(rowsOf({ data: [{ a: 2 }] }), [{ a: 2 }]);
  assert.deepEqual(rowsOf([{ a: 3 }]), [{ a: 3 }]);
  assert.deepEqual(rowsOf({ error: 'x' }), []);
  assert.deepEqual(rowsOf(null), []);
});

test('summarizeStats matches only our test sub_ids and keeps their campaign, type and state', () => {
  const ids = { roundtrip: 'fstest-1-roundtrip', oneway: 'fstest-1-oneway' };
  const rows = [
    { sub_id: 'fstest-1-roundtrip', campaign_id: 569853, type: 'click', state: 'processing' },
    { sub_id: 'real-trip-uuid', campaign_id: 569853, type: 'action', state: 'paid' },
    { sub_id: 'fstest-1-roundtrip', campaign_id: 569853, type: 'click', state: 'processing' },
  ];
  const s = summarizeStats(rows, ids);
  assert.equal(s.checked, 3);
  assert.equal(s.matched, 2);
  assert.equal(s.by['fstest-1-roundtrip'].length, 2);
  assert.equal(s.by['fstest-1-oneway'].length, 0);
  assert.ok(!JSON.stringify(s).includes('real-trip-uuid'), 'real trips must never be echoed');
});

test('dnsVerdict: the Travelpayouts target passes, anything else or nothing fails', () => {
  assert.equal(dnsVerdict(['whitelabel.travelpayouts.com.']).ok, true);
  assert.equal(dnsVerdict(['WhiteLabel.TravelPayouts.com']).ok, true);
  assert.equal(dnsVerdict(['example.com.']).ok, false);
  assert.equal(dnsVerdict([]).ok, false);
});

test('addDays does not mutate its input', () => {
  const d = new Date(NOW);
  addDays(d, 10);
  assert.equal(d.getTime(), NOW.getTime());
});

test('the script never reads a secret from anywhere but the environment and has no purchase path', () => {
  const src = fs.readFileSync(new URL('../scripts/fare_search_probe.mjs', import.meta.url), 'utf8');
  assert.match(src, /process\.env\.TRAVELPAYOUTS_TOKEN/);
  assert.doesNotMatch(src, /writeFileSync\([^)]*TOKEN/);
  assert.doesNotMatch(src, /checkout|payment_intent|stripe/i);
});
