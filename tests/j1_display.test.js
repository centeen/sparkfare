// Addendum J, J1 display (A1 to A3, A6; D-021, D-030): the retired LIVE-CHECKED tag, "Checked N h ago", "Last seen", fares that have left,
// lapsed prices, and agreement between the page's inline rules (index.html) and the Worker's (src/priceFreshness.js).
// Supersedes tests/live_checked_tag.test.js (G61).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as srv from '../src/priceFreshness.js';

const CRLF = String.fromCharCode(13, 10);
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').split(CRLF).join('\n');
const block = html.match(/const PRICE_FRESH_HOURS = 48;[\s\S]*?\nfunction prepareBoard\(deals, nowMs\) \{[\s\S]*?\n\}\n/)[0];
const api = vm.runInNewContext(`${block}; ({ priceFreshness, formatAsOf, asOfText, asOfLineHTML, prepareBoard, departsTooSoon, isLapsed, PRICE_FRESH_HOURS, DEPARTURE_BUFFER_HOURS, LAPSE_DAYS })`);

const NOW = Date.parse('2026-10-17T12:00:00Z');
const ago = (h) => new Date(NOW - h * 3600000).toISOString();
const ahead = (h) => new Date(NOW + h * 3600000).toISOString();

test('constants agree between the page and the Worker', () => {
  assert.equal(api.PRICE_FRESH_HOURS, srv.PRICE_FRESH_HOURS);
  assert.equal(api.DEPARTURE_BUFFER_HOURS, srv.DEPARTURE_BUFFER_HOURS);
  assert.equal(api.LAPSE_DAYS, srv.LAPSE_DAYS);
  assert.deepEqual([api.PRICE_FRESH_HOURS, api.DEPARTURE_BUFFER_HOURS, api.LAPSE_DAYS], [48, 48, 3]);
});

const CASES = [
  [{ found_at: ago(2) }, 'current'],
  [{ found_at: ago(48) }, 'current'],
  [{ found_at: ago(49) }, 'aging'],
  [{ found_at: ago(70) }, 'aging'],
  [{ found_at: ago(24 * 5) }, 'lapsed'],
  [{}, 'aging'],
  [{ found_at: 'not a date' }, 'aging'],
  [{ is_stale_fallback: true, found_at: ago(1), last_fresh_date: '2026-10-16' }, 'carried'],
  [{ is_stale_fallback: true, last_fresh_date: '2026-10-14' }, 'carried'],
  [{ is_stale_fallback: true, last_fresh_date: '2026-10-13' }, 'lapsed'],
  [{ is_stale_fallback: true, last_fresh_date: '2026-10-13', found_at: ago(1) }, 'lapsed'],
  [{ found_at: ago(2), departure_at: ahead(47) }, 'gone'],
  [{ found_at: ago(2), departure_at: ahead(49) }, 'current'],
  [{ found_at: ago(2), departure_at: ago(100) }, 'gone'],
  [{ found_at: ago(2), departure_at: 'garbage' }, 'current'],
  [{ found_at: ago(24 * 5), departure_at: ahead(1) }, 'gone'],
];
test('freshness states: the page and the Worker give the same answer for every case', () => {
  for (const [item, want] of CASES) {
    assert.equal(api.priceFreshness(item, NOW), want, JSON.stringify(item));
    assert.equal(srv.freshnessState(item, NOW), want, 'worker: ' + JSON.stringify(item));
  }
});
test('lapsed is "more than 3 calendar days": last seen Oct 14 is not, Oct 13 is', () => {
  assert.equal(api.isLapsed({ found_at: '2026-10-14T23:59:00Z' }, NOW), false);
  assert.equal(api.isLapsed({ found_at: '2026-10-13T23:59:00Z' }, NOW), true);
});

test('wording: current says "Checked N h ago" with the time and zone; the retired tag is gone', () => {
  assert.match(api.asOfText({ found_at: ago(3) }, NOW, 'UTC'), /^Checked 3 h ago · Oct 17, 9:00 AM UTC$/);
  assert.match(api.asOfText({ found_at: ago(0.2) }, NOW, 'UTC'), /^Checked under 1 h ago · /);
  assert.ok(!/LIVE-CHECKED/i.test(html), 'the LIVE-CHECKED PRICE wording is retired');
  assert.ok(!/class="badge stale"/.test(html));
});
test('wording: aging, carried and lapsed', () => {
  assert.equal(api.asOfText({ found_at: ago(70) }, NOW, 'UTC'), 'Prices as of Oct 14, 2:00 PM UTC · 2 days ago');
  const carried = api.asOfText({ is_stale_fallback: true, found_at: '2026-10-15T23:43:00Z', last_fresh_date: '2026-10-16' }, NOW, 'UTC');
  assert.equal(carried, 'Last seen Oct 15, 11:43 PM UTC. No newer price today, so this one is carried forward.');
  assert.equal(api.asOfText({ found_at: ago(24 * 5) }, NOW, 'UTC'), 'Last seen Oct 12.');
  assert.equal(api.asOfText({ found_at: ago(2), departure_at: ahead(5) }, NOW, 'UTC'), '', 'a fare that is gone has no line');
  for (const [item] of CASES) assert.equal(api.asOfText(item, NOW, 'UTC'), srv.fareNote(item, NOW, 'UTC'), JSON.stringify(item));
});
test('every time shown carries a zone name (winter too), and the viewer zone is used when none is given', () => {
  assert.match(api.formatAsOf({ found_at: '2026-10-15T23:43:07Z' }, 'America/New_York'), /EDT/);
  assert.match(api.formatAsOf({ found_at: '2026-12-15T23:43:00Z' }, 'America/New_York'), /EST/);
  assert.match(api.formatAsOf({ found_at: '2026-10-15T23:43:07Z' }), /[A-Z]{2,5}|GMT[+-]\d/);
  assert.match(api.formatAsOf({ last_fresh_date: '2026-10-16' }), /Oct 16/);
});

const row = (name, extra) => Object.assign({ display_name: name, price: 500, status: 'priced_no_deal', found_at: ago(2), departure_at: ahead(24 * 20) }, extra);
test('the board drops departed fares, demotes a lapsed deal, never mutates its input', () => {
  const data = {
    deals: [row('A', { status: 'deal' }), row('B', { status: 'deal', departure_at: ahead(10) }), row('C', { status: 'deal', found_at: ago(24 * 6) })],
    featured: [row('D', { status: 'featured' }), row('E', { status: 'featured', departure_at: ago(48) })],
    priced_no_deal: [row('F')],
    insufficient_history: [row('G', { status: 'insufficient_history', departure_at: ahead(1) })],
  };
  const snapshot = JSON.stringify(data);
  const b = JSON.parse(JSON.stringify(api.prepareBoard(data, NOW))); // plain objects: the page's code runs in another realm
  assert.deepEqual(b.deals.map((x) => x.display_name), ['A']);
  assert.deepEqual(b.featured.map((x) => x.display_name), ['D']);
  assert.deepEqual(b.priced_no_deal.map((x) => x.display_name).sort(), ['C', 'F']);
  assert.equal(b.priced_no_deal.find((x) => x.display_name === 'C').status, 'priced_no_deal');
  assert.deepEqual(b.insufficient_history, []);
  assert.equal(JSON.stringify(data), snapshot);
});
test('render wiring: board goes through prepareBoard, the hero skips lapsed prices, a last-seen ticket has no fare link', () => {
  assert.match(html, /const board = prepareBoard\(currentRenderData\.deals\);/);
  assert.match(html, /list\.filter\(\(item\) => priceFreshness\(item\) !== 'lapsed'\)/);
  assert.match(html, /const fare = chip\.kind === 'lastseen' \? '' : '<a class="'/);
  assert.ok(!/LIVE-CHECKED|class="badge/.test(html));
});
test('real data: nothing the board would show has departed, and no carried-forward row is current', () => {
  for (const f of ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json']) {
    const d = JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
    const at = Date.parse(d.generated_at);
    const b = api.prepareBoard(d, at);
    for (const item of Object.values(b).flat()) {
      assert.equal(api.departsTooSoon(item, at), false);
      if (item.is_stale_fallback) assert.notEqual(api.priceFreshness(item, at), 'current');
    }
  }
});
