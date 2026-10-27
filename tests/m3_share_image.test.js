// tests/m3_share_image.test.js
// Acceptance tests for Package M3: /check share image (Addendum M, ROADMAP step 145).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';
import { checkOgHtml } from '../src/checkOg.js';
import satori from 'satori';

const DAY = 24 * 60 * 60 * 1000;

function observations(count, basePrice, spanDays) {
  return Array.from({ length: count }, (_, i) => ({
    price: basePrice + (i % 3) * 10,
    date: new Date(Date.now() - Math.round(((count - 1 - i) * spanDays) / Math.max(count - 1, 1)) * DAY).toISOString().slice(0, 10),
  }));
}

const RICH = observations(20, 600, 19);

function makeEnv(overrides = {}) {
  const events = [];
  const env = {
    ENABLE_PRICE_CHECK: 'true',
    ENABLE_SHARE_IMAGE: 'false',
    APP_URL: 'https://sparkfare.com',
    ASSETS: {
      fetch: async (req) => {
        const u = new URL(req.url).pathname;
        const json = (body) => ({ ok: true, json: async () => body, text: async () => JSON.stringify(body) });
        if (u === '/sparkfare_ranked_deals.json') {
          return json({
            generated_at: '2026-10-22T08:00:00Z',
            deals: [{ origin: 'JFK', display_name: 'Bali, Indonesia', price: 450, observations: RICH }],
            featured: [],
            priced_no_deal: [{ origin: 'JFK', display_name: 'Prague, Czechia', price: 615, observations: RICH }],
            insufficient_history: [],
            no_data: [],
          });
        }
        if (u === '/sparkfare_destinations.json') return json({ 'Bali, Indonesia': {}, 'Prague, Czechia': {} });
        if (u === '/check.html') return { ok: true, text: async () => fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8') };
        return { ok: false, json: async () => ({}), text: async () => '' };
      },
    },
    DB: {
      prepare: (sql) => ({
        run: async () => ({ success: true }),
        bind: (...args) => ({
          run: async () => {
            if (/INSERT INTO events/.test(sql)) {
              const [event_type, user_id, anon_id, origin, route, partner, sub_id, source, meta] = args;
              events.push({ event_type, origin, route, meta: meta ? JSON.parse(meta) : null });
            }
            return { success: true };
          },
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    },
    ...overrides,
  };
  return { env, events };
}

test('wrangler: ENABLE_SHARE_IMAGE is "true" and run_worker_first contains "/og/*"', () => {
  const raw = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(raw, /"ENABLE_SHARE_IMAGE":\s*"true"/);
  assert.match(raw, /"\/og\/\*"/);
});

test('flag off: /og/check/:origin/:dest.png returns 404', async () => {
  const { env } = makeEnv({ ENABLE_SHARE_IMAGE: 'false' });
  const res = await worker.fetch(new Request('https://sparkfare.com/og/check/JFK/Prague%2C%20Czechia.png'), env, { waitUntil: () => {} });
  assert.equal(res.status, 404);
});

test('flag off: /check page injects window.ENABLE_SHARE_IMAGE = false and no OG tags', async () => {
  const { env } = makeEnv({ ENABLE_SHARE_IMAGE: 'false' });
  const res = await worker.fetch(new Request('https://sparkfare.com/check?o=JFK&d=Prague%2C%20Czechia'), env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /window\.ENABLE_SHARE_IMAGE\s*=\s*false/);
  assert.ok(!html.includes('property="og:image"'));
});

test('flag on: /check page injects window.ENABLE_SHARE_IMAGE = true and OG image tags', async () => {
  const { env } = makeEnv({ ENABLE_SHARE_IMAGE: 'true' });
  const res = await worker.fetch(new Request('https://sparkfare.com/check?o=JFK&d=Prague%2C%20Czechia'), env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /window\.ENABLE_SHARE_IMAGE\s*=\s*true/);
  assert.match(html, /<meta property="og:image" content="https:\/\/sparkfare\.com\/og\/check\/JFK\/Prague%2C%20Czechia\.png" \/>/);
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/sparkfare\.com\/og\/check\/JFK\/Prague%2C%20Czechia\.png" \/>/);
});

test('checkOgHtml: 1200x630 card renders route, verdict, median comparison, basis and as-of; omits price when price is null', async () => {
  const font = fs.readFileSync(new URL('../src/assets/Inter-Medium.ttf', import.meta.url));
  const vdom = checkOgHtml({
    origin: 'JFK',
    destination: 'Prague, Czechia',
    verdict: 'deal',
    pctDiff: 22,
    direction: 'below',
    median: 610,
    n: 20,
    price: null, // User chose to omit typed price
    asOf: 'Oct 22, 2026',
  });

  const svg = await satori(vdom, {
    width: 1200,
    height: 630,
    embedFont: false,
    fonts: [{ name: 'Inter', data: font, weight: 500, style: 'normal' }],
  });

  const text = svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const part of ['SPARKFARE', 'DEAL', 'JFK', 'Prague', 'Czechia', 'below', 'median', '610', 'fares', 'sparkfare.com']) {
    assert.ok(text.includes(part), `Expected SVG to include ${part}`);
  }
  // No price or round-trip string
  assert.ok(!text.includes('round trip'), 'Should not contain "round trip" when price is omitted');
  assert.ok(!text.includes('$ 450'), 'Should not contain typed price when price is omitted');
  // No travel dates
  assert.doesNotMatch(text, /2026-\d{2}-\d{2}/);
});

test('checkOgHtml: renders typed price and round trip when price is provided', async () => {
  const font = fs.readFileSync(new URL('../src/assets/Inter-Medium.ttf', import.meta.url));
  const vdom = checkOgHtml({
    origin: 'JFK',
    destination: 'Prague, Czechia',
    verdict: 'deal',
    pctDiff: 26,
    direction: 'below',
    median: 610,
    n: 20,
    price: 450,
    asOf: 'Oct 22, 2026',
  });

  const svg = await satori(vdom, {
    width: 1200,
    height: 630,
    embedFont: false,
    fonts: [{ name: 'Inter', data: font, weight: 500, style: 'normal' }],
  });

  const text = svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(text.includes('450'));
  assert.ok(text.includes('round trip'));
});

test('recomputed shared link: GET /api/check?cached=1 returns verdict and basis without price parameter', async () => {
  const { env, events } = makeEnv();
  const req = new Request('https://sparkfare.com/api/check?origin=JFK&dest=Prague%2C%20Czechia&cached=1');
  const res = await worker.fetch(req, env, { waitUntil: (p) => p });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'ok');
  assert.equal(data.origin, 'JFK');
  assert.equal(data.destination, 'Prague, Czechia');
  assert.equal(data.price_omitted, true);
  assert.equal(data.median, 610);
  assert.ok(['deal', 'typical', 'high'].includes(data.verdict));
  assert.equal(typeof data.pct_diff, 'number');
  assert.ok(data.n >= 10);
});

test('check.html: privacy options, share button, and navigator.share / copy fallback pattern', () => {
  const html = fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8');
  assert.match(html, /id="share-btn"/);
  assert.match(html, /Share this result/);
  assert.match(html, /id="share-include-price"/);
  assert.match(html, /id="share-options"/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /\/api\/check\/share/);
  assert.match(html, /window\.ENABLE_SHARE_IMAGE/);
  // Flag off hides button
  assert.match(html, /\$\('share-btn'\)\.hidden = !shareEnabled;/);
  // Preserves layout order from k_b4_check_verdict test
  const markup = html.slice(html.indexOf('<div class="verdict"'), html.indexOf('id="result-fine"'));
  const order = ['verdict-word', 'verdict-number', 'verdict-chip', 'result-headline', 'watch-link', 'share-btn'].map((id) => markup.indexOf(id));
  assert.ok(order.every((n) => n >= 0) && order.every((n, i) => i === 0 || n > order[i - 1]), order.join(','));
});

test('checkOg.js: zero hex color literals and font floor >= 13px', () => {
  const code = fs.readFileSync(new URL('../src/checkOg.js', import.meta.url), 'utf8');
  const hexMatches = code.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.equal(hexMatches.length, 0, `Expected 0 hex color literals in checkOg.js, found: ${hexMatches.join(', ')}`);
  
  // Font sizes: verify no font-size smaller than 13px
  const fontSizes = [...code.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(fontSizes.length > 0);
  for (const size of fontSizes) {
    assert.ok(size >= 13, `Font size ${size}px is below 13px floor`);
  }
});
