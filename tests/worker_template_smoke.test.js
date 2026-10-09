// Smoke test for every Worker-rendered page, with the feature flags ON so each template actually
// runs. `node --check` cannot catch a template that references an out-of-scope variable, and
// /departing/ threw a ReferenceError on every request for ten days because no test ever requested
// it. Real committed data files are served as the assets, so the templates see real shapes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';

const ASSET_ROOT = new URL('../', import.meta.url);
const ctx = { waitUntil: () => {} };

function makeEnv(extra = {}) {
  return {
    ENABLE_T3_REFERRALS: 'true',
    ENABLE_T5B_ADS: 'true',
    ENABLE_EMAIL_V2: 'true',
    ENABLE_DIGEST_ARCHIVE: 'true',
    ENABLE_T7B_PUSH: 'true',
    ENABLE_PTO_CALENDAR: 'true',
    ENABLE_T2B_SEQUENCE: 'true',
    ADMIN_SECRET: 'admin-secret',
    KPI_DASHBOARD_SECRET: 'kpi-secret',
    APP_URL: 'https://sparkfare.com',
    ASSETS: {
      fetch: async (req) => {
        const name = new URL(req.url).pathname.slice(1);
        try {
          const body = fs.readFileSync(new URL(name, ASSET_ROOT));
          return new Response(body, { status: 200 });
        } catch {
          return new Response('nf', { status: 404 });
        }
      },
    },
    DB: {
      prepare: () => {
        const stmt = {
          bind: () => stmt,
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true, meta: {} }),
        };
        return stmt;
      },
      batch: async () => [],
    },
    ...extra,
  };
}

const ranked = JSON.parse(fs.readFileSync(new URL('sparkfare_ranked_deals.json', ASSET_ROOT), 'utf8'));
const sample = (ranked.deals?.[0] || ranked.priced_no_deal?.[0] || ranked.featured?.[0]);
const dest = encodeURIComponent(sample.display_name);
const date = (sample.departure_at || '2026-11-27T00:00:00Z').slice(0, 10);

// [path, allowed statuses]. 404 is allowed where the route legitimately has nothing to show with
// this stub data; anything >= 500 (or a throw) is always a failure.
const HTML_ROUTES = [
  ['/index', [200]],
  ['/kpi?key=kpi-secret', [200]],
  ['/hub', [200]],
  ['/reward-terms', [200]],
  ['/embed', [404]], // embed.html does not exist; must 404 cleanly, not throw
  ['/widget', [200]],
  ['/digest', [200, 404]],
  [`/flight/JFK/${dest}`, [200, 404]],
  [`/flight/JFK/${dest}/`, [200, 404]],
  [`/deal/JFK/${dest}/${date}`, [200, 404]],
  ['/time-off', [200]],
  ['/time-off/den', [200]],
  ['/time-off/den?budget=3&h=2uh', [200]],
  ['/time-off/den.ics', [200]],
  ['/departing/abc123', [200]],
  ['/departing/abc123?url=https%3A%2F%2Fwww.aviasales.com%2Fsearch%2FX', [200]],
  ['/this-page-does-not-exist', [404]],
];

for (const [path, allowed] of HTML_ROUTES) {
  test(`GET ${path.split('?')[0].replace(dest, ':dest')} renders without throwing or leaking undefined`, async () => {
    const res = await worker.fetch(new Request(`https://sparkfare.com${path}`), makeEnv(), ctx);
    assert.ok(res.status < 500, `${path} returned ${res.status}`);
    assert.ok(allowed.includes(res.status), `${path} returned ${res.status}, expected one of ${allowed}`);
    const type = res.headers.get('Content-Type') || '';
    if (type.includes('text/html')) {
      const html = await res.text();
      assert.ok(html.length > 200, `${path} returned an empty page`);
      // Strip <script> bodies: client code legitimately mentions the word `undefined`.
      const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      assert.ok(!/\bundefined\b/.test(visible), `${path} leaked "undefined" into the page`);
      assert.ok(!visible.includes('[object Object]'), `${path} leaked "[object Object]" into the page`);
      assert.ok(!/\bNaN\b/.test(visible), `${path} leaked NaN into the page`);
    }
  });
}

const XML_AND_JSON = [
  '/sitemap.xml', '/sitemap-routes.xml', '/sitemap-digest.xml', '/api/stats/deals', '/api/partners',
  '/api/health', '/api/deals?origin=JFK', `/api/widget/JFK/${dest}`,
];
for (const path of XML_AND_JSON) {
  test(`GET ${path.split('?')[0].replace(dest, ':dest')} does not throw`, async () => {
    const res = await worker.fetch(new Request(`https://sparkfare.com${path}`), makeEnv(), ctx);
    assert.ok(res.status < 500, `${path} returned ${res.status}`);
  });
}

test('redirect routes (/go, /out, /r) do not throw', async () => {
  for (const path of ['/go/safetywing', '/out/safetywing', '/r/ABC123']) {
    const res = await worker.fetch(new Request(`https://sparkfare.com${path}`, { redirect: 'manual' }), makeEnv(), ctx);
    assert.ok(res.status < 500, `${path} returned ${res.status}`);
  }
});
