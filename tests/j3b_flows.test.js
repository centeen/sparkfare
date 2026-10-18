// Addendum J3b (ROADMAP step 108): C2 empty states, C9 short windows, C10 the alert heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';
import { renderTimeOffOrigin } from '../src/ptoPages.js';

const days = (n) => Array(n).fill(0).map((_, i) => ({
  price: 400 + (n - i) * 5,
  date: new Date(Date.now() - (n - i) * 24 * 60 * 60 * 1000).toISOString(),
}));
const soon = new Date(Date.now() + 40 * 86400000).toISOString();
const env = {
  ASSETS: { fetch: async (req) => req.url.includes('sparkfare_ranked_deals')
    ? { ok: true, json: async () => ({ deals: [
        { origin: 'JFK', display_name: 'Rich, Place', price: 350, observations: days(15), departure_at: soon, found_at: new Date().toISOString(), basis_text: '17% below 30-day median, 31 observations' },
        { origin: 'JFK', display_name: 'Thin, Place', price: 400, observations: days(3), departure_at: soon, found_at: new Date().toISOString() },
      ], featured: [], priced_no_deal: [] }) }
    : { ok: false, json: async () => ({}) } },
};
const page = async (dest) => (await worker.fetch(new Request('https://sparkfare.com/flight/JFK/' + encodeURIComponent(dest)), env, { waitUntil() {} })).text();

test('C2: a thin route page says what is true and offers alerts from the origin, with no price or date promise', async () => {
  const html = await page('Thin, Place');
  assert.match(html, /We haven't seen enough fares for JFK to Thin, Place yet\./);
  assert.match(html, /<a href="\/\?origin=JFK#signup-form" class="cta">Get alerts from JFK<\/a>/);
  assert.doesNotMatch(html, /Get Deal Alerts/);
});

test('C2: a route with enough history keeps its basis line and the standard button', async () => {
  const html = await page('Rich, Place');
  assert.doesNotMatch(html, /haven't seen enough fares/);
  assert.match(html, /class="cta">Get Deal Alerts<\/a>/);
});

test('C2: /check "not enough history" uses the same sentence and links to the signup with the origin preset', () => {
  const c = fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8');
  assert.ok(c.includes("We haven't seen enough fares for \" + route + ' yet.'") || c.includes(`"We haven't seen enough fares for " + route + ' yet.'`));
  assert.match(c, /'\/\?origin=' \+ oc \+ '#signup-form'/);
  assert.match(c, /\/\^\[A-Z\]\{3\}\$\/\.test\(oc\)/, 'the code is checked before it goes in a URL');
  assert.doesNotMatch(c, /Not enough history yet/);
});

const now = new Date('2026-10-12T08:00:00Z');
const render = (origin) => renderTimeOffOrigin({ origin, budget: 10, keys: undefined, now, appUrl: 'https://sparkfare.com', leaveReady: true });

test('C9: windows under 5 days show the one-line pointer; longer windows keep "get your home ready"', () => {
  const html = render('DEN');
  const blocks = html.split('<div class="block"').slice(1);
  assert.ok(blocks.length > 1);
  let short = 0, long = 0;
  for (const b of blocks) {
    const daysOff = Number(b.match(/(\d+) days off<\/span>/)[1]);
    if (daysOff < 5) {
      short++;
      assert.doesNotMatch(b, /get your home ready/);
      assert.match(b, /Leaving for longer\? <a href="\/leave\?src=pto">Make a checklist<\/a>/);
    } else {
      long++;
      assert.match(b, /Before you go: get your home ready/);
      assert.doesNotMatch(b, /Leaving for longer\?/);
    }
  }
  assert.ok(short > 0 && long > 0, `needs both kinds of window in the sample (short ${short}, long ${long})`);
});

test('C9: with the /leave flag off neither line appears', () => {
  const html = renderTimeOffOrigin({ origin: 'DEN', budget: 10, keys: undefined, now, appUrl: 'https://sparkfare.com', leaveReady: false });
  assert.doesNotMatch(html, /\/leave/);
});

test('C10: the form heading matches what the form does (a daily-alert signup), not a per-window watch', () => {
  const html = render('DEN');
  assert.doesNotMatch(html, /when fares appear/);
  assert.match(html, /<h2>Get deal alerts from Denver<\/h2>/);
  assert.match(html, /At most one fare email a day when a fare from your home airport beats its usual price\./);
});

test('C8 already holds: the share link carries only the budget and holiday set and the page uses navigator.share with a copy fallback', () => {
  const html = renderTimeOffOrigin({ origin: 'DEN', budget: 7, keys: undefined, now, appUrl: 'https://sparkfare.com', leaveReady: true });
  const url = html.match(/id="share-btn" data-url="([^"]*)"/)[1].replace(/&amp;/g, "&");
  assert.match(url, /^https:\/\/sparkfare\.com\/time-off\/den\?/);
  const keys = [...new URL(url).searchParams.keys()].sort();
  assert.deepEqual(keys, ['budget', 'h']);
  assert.match(html, /navigator\.share/);
  assert.match(html, /<link rel="canonical" href="https:\/\/sparkfare\.com\/time-off\/den" \/>/);
});
