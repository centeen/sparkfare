// K-A6 (ROADMAP step 124, Addendum J2): the fare ticket. Every priced fare reads in the same order (route, price with one chip, basis and
// sparkline, dates / nights / airline / round trip, as-of, then View fare and Watch), the chips say one word, gold marks a deal and nothing else,
// and no primary button is ever greyed. Runs the page's own functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const grab = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a); assert.ok(a >= 0 && b > a, from); return html.slice(a, b + to.length); };
const source = [
  html.slice(html.indexOf('const PRICE_FRESH_HOURS = 48;'), html.indexOf('function prepareBoard(deals, nowMs) {')),
  html.match(/function prepareBoard\(deals, nowMs\) \{[\s\S]*?\n\}\n/)[0],
  grab('const AIRLINE_NAMES = ', '// end K-A3 copy helpers'),
  html.match(/function fmtPrice\(n\) \{[\s\S]*?\n\}\n/)[0],
  grab('// K-A6 fare ticket helpers', '// end K-A6 fare ticket helpers'),
].join('\n');
const plain = (x) => JSON.parse(JSON.stringify(x));
const api = vm.runInNewContext(`${source}\n;({ fareChip, chipHTML, fareRoute, fareDollarsUnder, fareBasisLine, fareDetailLine, ticketSparkline, ticketActionsHTML, ticketBodyHTML, TICKET_DISCLOSURE })`);

const NOW = Date.parse('2026-10-17T12:00:00Z');
const base = { display_name: 'Mallorca, Spain', origin: 'JFK', airline: 'TP', price: 594, booking_link: 'https://www.aviasales.com/x', departure_at: '2026-12-01T10:30:00+01:00', return_at: '2026-12-08T18:00:00+01:00', found_at: '2026-10-17T09:00:00Z', median_baseline: 1080, basis_text: '45% below 30-day median, 12 observations', price_history: [1100, 1090, 1075, 1060, 1085, 1070, 900, 1095] };
const deal = { ...base, status: 'deal' };
const typical = { ...base, status: 'priced_no_deal', price: 1100 };
const building = { ...base, status: 'insufficient_history', median_baseline: undefined, price_history: [] };
const featured = { ...base, status: 'featured', median_baseline: undefined };
const lapsed = { ...base, status: 'priced_no_deal', found_at: '2026-10-09T09:00:00Z' };

test('chips: one word per verdict, and a last-seen fare is a clay outline with a clock and its date', () => {
  assert.deepEqual(plain(api.fareChip(deal, NOW)), { kind: 'deal', label: 'Deal' });
  assert.deepEqual(plain(api.fareChip(typical, NOW)), { kind: 'typical', label: 'Typical' });
  assert.deepEqual(plain(api.fareChip(building, NOW)), { kind: 'building', label: 'Building history' });
  assert.deepEqual(plain(api.fareChip(featured, NOW)), { kind: 'noverdict', label: 'No verdict' });
  assert.deepEqual(plain(api.fareChip({ status: 'no_data' }, NOW)), { kind: 'nodata', label: 'No data' });
  const last = api.fareChip(lapsed, NOW);
  assert.equal(last.kind, 'lastseen');
  assert.equal(last.label, 'Last seen Oct 9');
  assert.match(api.chipHTML(last), /<svg class="chip-icon"/);
  assert.doesNotMatch(api.chipHTML(deal), /<svg/);
  // A lapsed deal is never a deal.
  assert.equal(api.fareChip({ ...deal, found_at: '2026-10-09T09:00:00Z' }, NOW).kind, 'lastseen');
});

test('the JFK to Mallorca example reads as the spec says: dates, nights, airline, round trip; route with the country as a label', () => {
  assert.equal(api.fareDetailLine(deal), 'Dec 1–8, 7 nights · TAP Air Portugal · round trip');
  assert.deepEqual({ ...api.fareRoute(deal) }, { text: 'JFK → Mallorca', region: 'Spain' });
  assert.equal(api.fareDetailLine({ ...base, airline: 'ZZ', departure_at: undefined, return_at: undefined }), 'ZZ · round trip');
  assert.equal(api.fareDetailLine({ price: 1 }), 'round trip');
});

test('basis: a deal states its basis and the dollars under the median; a typical fare states the median; the rest state nothing', () => {
  assert.equal(api.fareDollarsUnder(deal), '$486 under');
  assert.equal(api.fareBasisLine(deal), '45% below 30-day median, 12 observations · $486 under');
  assert.equal(api.fareDollarsUnder(typical), '', 'a fare at or above the median is never "under"');
  assert.equal(api.fareBasisLine(typical), '30-day median $1,080');
  assert.equal(api.fareBasisLine(building), '');
  assert.equal(api.fareBasisLine(featured), '');
  assert.doesNotMatch(api.fareBasisLine(deal), /save/i);
});

test('the ticket body is in order: route, price and one chip, basis and sparkline, details, as-of', () => {
  const t = api.ticketBodyHTML(deal, {}, NOW);
  const at = (needle) => { const i = t.indexOf(needle); assert.ok(i >= 0, needle); return i; };
  const order = [at('ticket-route'), at('ticket-price'), at('ticket-basis'), at('ticket-detail'), at('Checked ')];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal((t.match(/class="chip /g) || []).length, 1, 'one chip');
  assert.match(t, /\$594/);
  // The hero already states a deal's basis in its label, so the ticket body leaves it out there.
  assert.doesNotMatch(api.ticketBodyHTML(deal, { hero: true }, NOW), /below 30-day median/);
  assert.match(api.ticketBodyHTML(typical, { hero: true }, NOW), /30-day median \$1,080/);
});

test('actions: View fare (the primary), Watch and the disclosure sentence; a last-seen fare has no fare link and no disclosure', () => {
  const a = api.ticketActionsHTML(deal, 'book-link', NOW);
  assert.match(a, /<div class="ticket-perf"/);
  assert.match(a, /<a class="book-link track-booking" href="https:\/\/www\.aviasales\.com\/x"/);
  assert.match(a, /rel="sponsored nofollow noopener"/);
  assert.match(a, /aria-label="View this fare on a booking site \(opens in a new tab\)\. Sparkfare does not sell or book travel\."/);
  assert.match(a, /<a class="watch-link" href="#signup-form"[^>]*>Watch<\/a>/);
  assert.ok(a.includes(`<p class="ticket-disclosure">${api.TICKET_DISCLOSURE}</p>`));
  assert.ok(a.indexOf('book-link') < a.indexOf('watch-link'), 'the primary comes first');
  const l = api.ticketActionsHTML(lapsed, 'book-link', NOW);
  assert.doesNotMatch(l, /track-booking|ticket-disclosure|View fare/);
  assert.match(l, /watch-link/);
});

test('sparkline: the median is a dashed line, and today\'s dot is gold only on a deal', () => {
  const d = api.ticketSparkline(deal);
  assert.match(d, /stroke-dasharray="3 3"/);
  assert.match(d, /<circle [^>]*fill="var\(--spark\)"/);
  const t = api.ticketSparkline(typical);
  assert.match(t, /<circle [^>]*fill="var\(--ink\)"/);
  assert.doesNotMatch(t, /--spark/);
  assert.equal(api.ticketSparkline(building), '', 'no history, no chart');
  assert.match(d, /role="img" aria-label="Price history/);
});

test('the board: no card or primary button is greyed; Building-history cards desaturate only the photo; the old badge and price rules are gone', () => {
  assert.ok(!/\.grid-dimmed \.card \{/.test(html), 'the whole-card grey and fade rule is gone');
  assert.match(html, /\.grid-dimmed \.card-photo, \.grid-dimmed \.card-photo-fallback \{ filter: grayscale\(0\.85\); \}/);
  assert.ok(!/\.badge\b|\.card-price|\.hero-price|\.hero-dest/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), 'old rules removed');
  assert.match(html, /<div class="card ticket ticket-\$\{chip\.kind\}">/);
  assert.match(html, /\$\{ticketBodyHTML\(item\)\}/);
  assert.match(html, /\$\{ticketActionsHTML\(item, 'book-link'\)\}/);
  assert.match(html, /\$\{ticketBodyHTML\(topPick, \{ hero: true \}\)\}/);
  assert.match(html, /\$\{ticketActionsHTML\(topPick, 'hero-cta'\)\}/);
});

test('real data: every priced record renders a full ticket with no undefined, NaN or empty chip', () => {
  let n = 0;
  for (const f of ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json']) {
    const d = JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
    const at = Date.parse(d.generated_at);
    for (const bucket of ['deals', 'featured', 'priced_no_deal', 'insufficient_history']) {
      for (const item of d[bucket] || []) {
        if (typeof item.price !== 'number') continue;
        const t = api.ticketBodyHTML(item, {}, at) + api.ticketActionsHTML(item, 'book-link', at);
        assert.doesNotMatch(t, /undefined|NaN|\[object/, item.display_name);
        assert.equal((t.match(/class="chip /g) || []).length, 1, item.display_name);
        assert.match(t, /round trip/);
        assert.match(t, /Watch<\/a>/);
        n += 1;
      }
    }
  }
  assert.ok(n > 200, `rendered ${n} tickets`);
});
