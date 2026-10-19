// K-B4 (ROADMAP step 128, scan C-1 and C-2): the /check verdict. One word (Deal, Typical, High) decided by the API against the route's own median, drawn
// as peak 1; the signature spark (D-027) fires at most once per session and only for a Deal; destinations with no history are marked in the selector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../src/index.js';
import { computePriceCheck, routeHasHistory, VERDICT_HIGH_PCT } from '../src/priceCheck.js';

const DAY = 24 * 60 * 60 * 1000;
const dayAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
// 20 days of fares at 600 to 620 (median 610), then a spiky copy with a wide spread.
const calm = Array.from({ length: 20 }, (_, i) => ({ date: dayAgo(19 - i), price: 600 + (i % 3) * 10 }));
const spiky = Array.from({ length: 20 }, (_, i) => ({ date: dayAgo(19 - i), price: i % 2 ? 300 : 900 }));
const rec = (observations, extra) => ({ origin: 'JFK', display_name: 'Bali, Indonesia', price: 615, observations, ...extra });
const verdict = (observations, price) => computePriceCheck(rec(observations), price, new Date()).verdict;

test('verdict: a Deal is 15% or more below the median and a rare find; High is 15% or more above; the rest is Typical', () => {
  assert.equal(VERDICT_HIGH_PCT, 15);
  assert.equal(verdict(calm, 400), 'deal');          // 34% below
  assert.equal(verdict(calm, 560), 'typical');       // 8% below: not at the floor
  assert.equal(verdict(calm, 610), 'typical');
  assert.equal(verdict(calm, 650), 'typical');       // 7% above
  assert.equal(verdict(calm, 702), 'high');          // 15.1% above
  assert.equal(verdict(calm, 900), 'high');
  assert.equal(computePriceCheck(rec(calm), 400, new Date()).direction, 'below');
});

test('verdict: 15% below the median is still Typical when the history is too noisy for the price to be a rare find', () => {
  // median of the spiky history is 600; 480 is 20% below but within the normal spread
  const r = computePriceCheck(rec(spiky), 480, new Date());
  assert.equal(r.direction, 'below');
  assert.ok(r.pct_diff >= 15);
  assert.equal(r.verdict, 'typical');
});

test('verdict: no verdict when there is no percentage (thin history)', () => {
  const thin = computePriceCheck(rec(calm.slice(0, 5)), 400, new Date());
  assert.equal(thin.status, 'not_enough_history');
  assert.equal(thin.verdict, undefined);
});

test('routeHasHistory uses the same bar as the check: 10 days over 14 days', () => {
  const now = new Date();
  assert.equal(routeHasHistory(rec(calm), now), true);
  assert.equal(routeHasHistory(rec(calm.slice(0, 9)), now), false);
  assert.equal(routeHasHistory(rec(calm.slice(-9)), now), false);
  assert.equal(routeHasHistory(undefined, now), false);
  assert.equal(routeHasHistory({ display_name: 'x' }, now), false);
});

function makeEnv(overrides = {}) {
  const file = (origin) => ({
    generated_at: new Date().toISOString(), deals: [], featured: [],
    priced_no_deal: [rec(calm, { origin, display_name: 'Bali, Indonesia' })],
    insufficient_history: [rec(calm.slice(0, 4), { origin, display_name: 'Tokyo, Japan' })], no_data: [],
  });
  return {
    ENABLE_PRICE_CHECK: 'true',
    ASSETS: {
      fetch: async (req) => {
        const u = new URL(req.url).pathname;
        const json = (b) => ({ ok: true, json: async () => b, text: async () => JSON.stringify(b) });
        if (u === '/sparkfare_ranked_deals.json') return json(file('JFK'));
        if (u === '/sparkfare_ranked_deals_other_origins.json') return json({ ...file('LAX'), priced_no_deal: [], insufficient_history: [] });
        if (u === '/sparkfare_destinations.json') return json({ 'Bali, Indonesia': {}, 'Tokyo, Japan': {}, 'Cusco, Peru': {} });
        return { ok: false, json: async () => ({}), text: async () => '' };
      },
    },
    DB: { prepare: () => ({ run: async () => ({}), bind: () => ({ run: async () => ({}), first: async () => null, all: async () => ({ results: [] }) }), first: async () => null }) },
    ...overrides,
  };
}
const call = async (p, env) => worker.fetch(new Request('https://sparkfare.com' + p), env, { waitUntil() {} });

test('/api/check returns the verdict with the percentage', async () => {
  const res = await call('/api/check?origin=JFK&dest=' + encodeURIComponent('Bali, Indonesia') + '&price=400', makeEnv());
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.verdict, 'deal');
  assert.equal(data.price, 400);
});

test('/api/check/options lists the destinations with no history for that origin; unknown and TLV origins are refused; flag off is 404', async () => {
  const jfk = await (await call('/api/check/options?origin=JFK', makeEnv())).json();
  assert.deepEqual(jfk.no_history, ['Cusco, Peru', 'Tokyo, Japan']);
  const lax = await (await call('/api/check/options?origin=LAX', makeEnv())).json();
  assert.deepEqual(lax.no_history, ['Bali, Indonesia', 'Cusco, Peru', 'Tokyo, Japan']);
  assert.equal((await call('/api/check/options?origin=TLV', makeEnv())).status, 400);
  assert.equal((await call('/api/check/options?origin=ZZZ', makeEnv())).status, 400);
  assert.equal((await call('/api/check/options?origin=JFK', makeEnv({ ENABLE_PRICE_CHECK: 'false' }))).status, 404);
});

// ---- the page ----
const html = fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const grab = (re) => html.match(re)[0];
const fns = [
  grab(/const VERDICT_WORDS = \{[^}]*\};/),
  'let sparkSeenInPage = false;',
  grab(/function igniteSparkOnce\(verdict, storage\) \{[\s\S]*?\n    \}\n/),
  grab(/function verdictChipHTML\(verdict, ignite\) \{[\s\S]*?\n    \}\n/),
].join('\n');
const fresh = () => vm.runInNewContext(`${fns}\n;({ igniteSparkOnce, verdictChipHTML })`);
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };

test('spark: fires once per session for a Deal and never again; never for Typical or High', () => {
  const page = fresh();
  const s = store();
  assert.equal(page.igniteSparkOnce('typical', s), false);
  assert.equal(page.igniteSparkOnce('high', s), false);
  assert.equal(s.m.size, 0, 'a non-deal does not use up the spark');
  assert.equal(page.igniteSparkOnce('deal', s), true);
  assert.equal(page.igniteSparkOnce('deal', s), false);
  assert.equal(s.getItem('sparkfare_spark_seen'), '1');
  // a reload in the same tab (a new page, the same sessionStorage) does not fire it again
  assert.equal(fresh().igniteSparkOnce('deal', s), false);
});

test('spark: blocked storage still gives at most one ignition in the page, and nothing throws', () => {
  const page = fresh();
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(page.igniteSparkOnce('deal', blocked), true);
  assert.equal(page.igniteSparkOnce('deal', blocked), false);
  assert.equal(fresh().igniteSparkOnce('deal', null), true);
});

test('chip: only a Deal carries a dot, and only the first one carries the ignite class', () => {
  const page = fresh();
  assert.match(page.verdictChipHTML('deal', true), /chip chip-deal"><span class="spark-dot ignite" aria-hidden="true"><\/span>Deal/);
  assert.match(page.verdictChipHTML('deal', false), /<span class="spark-dot" aria-hidden="true">/);
  assert.doesNotMatch(page.verdictChipHTML('typical', true), /spark-dot/);
  assert.doesNotMatch(page.verdictChipHTML('high', true), /spark-dot/);
});

test('motion: one keyframe animation, only under prefers-reduced-motion: no-preference; no cookie, no new request for the spark', () => {
  assert.equal((html.match(/@keyframes/g) || []).length, 1);
  assert.equal((html.match(/animation\s*:/g) || []).length, 1);
  assert.match(html, /@media \(prefers-reduced-motion: no-preference\) \{ \.spark-dot\.ignite \{ animation: spark-ignite 400ms ease-out both; \} \}/);
  assert.match(html, /@keyframes spark-ignite \{ from \{ opacity: 0; transform: scale\(0\.8\); \} to \{ opacity: 1; transform: scale\(1\); \} \}/);
  assert.ok(!/document\.cookie/.test(html));
  assert.match(html, /sessionStorage/);
});

test('layout: the verdict word is Space Grotesk 44px, the number Plex Mono, then the chip, then Watch; no gold paint but the chip', () => {
  assert.match(html, /\.verdict-word \{ font-family: var\(--font-display\); font-size: 44px;/);
  assert.match(html, /\.verdict-number \{ font-family: var\(--font-mono\);/);
  const markup = html.slice(html.indexOf('<div class="verdict"'), html.indexOf('id="result-fine"'));
  const order = ['verdict-word', 'verdict-number', 'verdict-chip', 'result-headline', 'watch-link', 'share-btn'].map((id) => markup.indexOf(id));
  assert.ok(order.every((n) => n >= 0) && order.every((n, i) => i === 0 || n > order[i - 1]), order.join(','));
  assert.ok(!/#E8B930/i.test(html));
  assert.ok(!/class="[^"]*\bbook\b/i.test(html));
});

test('selector: destinations with no history are labelled "(No history yet)" and stay selectable; a failed request leaves the list unmarked', () => {
  assert.match(html, /noHistory\.has\(n\) \? n \+ ' \(No history yet\)' : n, n/);
  assert.match(html, /fetch\('\/api\/check\/options\?origin=' \+ encodeURIComponent\(origin\)/);
  assert.match(html, /catch \(e\) \{\s*noHistoryByOrigin\.set\(origin, new Set\(\)\);/);
  assert.match(html, /\$\('origin'\)\.addEventListener\('change', refreshDestMarks\)/);
});
