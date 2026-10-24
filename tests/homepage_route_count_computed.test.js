// J1.5 (Addendum J A5): the route and hub counts on the homepage are computed from the page's own origin list and the
// destinations file, not typed. The static HTML keeps a fallback sentence; the page script replaces the numbers once data loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CRLF = String.fromCharCode(13, 10);
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').split(CRLF).join('\n');
const block = html.match(/function countRoutes\(optionValues, destinationCount\) \{[\s\S]*?\n\}\nfunction syncRouteCounts\(content\) \{[\s\S]*?\n\}\n/)[0];

function run(options, content) {
  const trust = { textContent: 'Tracking prices for 880 routes from 22 US hubs. New routes are marked Building history.' };
  const browse = { textContent: 'Browse All 880 Routes' };
  const document = {
    querySelectorAll: () => options.map((value) => ({ value })),
    querySelector: (sel) => (sel === '.trust-signal' ? trust : sel === 'a.promo-cta[href="/data/"]' ? browse : null),
  };
  vm.runInNewContext(`${block}; syncRouteCounts(content)`, { document, content, Array, Object });
  return { trust: trust.textContent, browse: browse.textContent };
}

const dests = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`D${i}`, {}]));

test('counts are hubs x destinations, with TLV outside the count', () => {
  const opts = ['', 'JFK', 'LAX', 'ORD', 'TLV'];
  const out = run(opts, dests(40));
  assert.match(out.trust, /for 120 routes from 3 US hubs/);
  assert.equal(out.browse, 'Browse All 120 Routes');
});

test('a changed origin list or destination list changes the numbers', () => {
  assert.match(run(['JFK', 'LAX', 'TLV'], dests(41)).trust, /for 82 routes from 2 US hubs/);
  assert.equal(run(['JFK', 'LAX', 'ATL', 'DEN', 'TLV'], dests(40)).browse, 'Browse All 160 Routes');
});

test('no data means the static fallback text is left alone', () => {
  assert.match(run(['TLV'], dests(40)).trust, /880 routes from 22 US hubs/);
  assert.match(run(['JFK'], {}).trust, /880 routes from 22 US hubs/);
  assert.equal(run(['JFK'], null).browse, 'Browse All 880 Routes');
});

test('the page runs it right after the destinations file loads', () => {
  assert.match(html, /cachedBoardData = \{ deals, content, images \};\n\s+syncRouteCounts\(content\);/);
});

test('the real data and origin list reproduce the static fallback (so the fallback cannot go stale unnoticed)', () => {
  const select = html.match(/<select id="origin-select">([\s\S]*?)<\/select>/)[1];
  const values = [...select.matchAll(/<option value="([A-Z]{3})"/g)].map((m) => m[1]);
  const content = JSON.parse(fs.readFileSync(new URL('../sparkfare_destinations.json', import.meta.url), 'utf8'));
  const out = run(values, content);
  assert.equal(out.trust.split(' Building history')[0].replace(/\.? New routes are marked$/, ''), 'Tracking prices for 880 routes from 22 US hubs');
  assert.equal(out.browse, 'Browse All 880 Routes');
  assert.ok(html.includes('Tracking prices for 880 routes from 22 US hubs.'));
  assert.ok(html.includes('Browse All 880 Routes'));
});

// Hub Guard read, items 117 and 118 (2026-10-24)
test('item 118: the trust line says US hubs and the selector test origin stays outside the count', () => {
  assert.ok(html.includes('Tracking prices for 880 routes from 22 US hubs.'));
  assert.ok(!html.includes('major hubs'));
  assert.match(run(['JFK', 'LAX', 'TLV'], dests(40)).trust, /for 80 routes from 2 US hubs/);
});

test('item 117: the time-off tile and strip promise destinations, not fares, while ENABLE_PTO_FARES is off', () => {
  assert.ok(html.includes('Long weekends and PTO days, with destinations for each window.'));
  assert.ok(html.includes('long-weekend calendars and destinations around federal holidays'));
  assert.ok(!html.includes('with fares for each window'));
  assert.ok(!html.includes('flight options around federal holidays'));
  assert.ok(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').includes('"ENABLE_PTO_FARES": "false"'), 'restore the fare wording only when this flag is on');
});
