import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

// Shared fake asset env for route-page tests.
function makeRouteEnv(extraVars = {}) {
  return {
    ...extraVars,
    ASSETS: {
      fetch: async (req) => {
        const url = req.url;
        if (url.includes('sparkfare_ranked_deals')) {
          return {
            ok: true,
            json: async () => ({
              deals: [
                {
                  origin: 'JFK',
                  destination: 'CDG',
                  price: 350,
                  observations: Array(15).fill(0).map((_, i) => ({
                    price: 350 + (14 - i) * 5,
                    date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString(),
                  })),
                },
                {
                  origin: 'JFK',
                  destination: 'LHR', // thin route — only 3 obs
                  price: 400,
                  observations: Array(3).fill(0).map((_, i) => ({
                    price: 400 + (2 - i) * 5,
                    date: new Date(Date.now() - (2 - i) * 24 * 60 * 60 * 1000).toISOString(),
                  })),
                },
              ],
            }),
          };
        }
        return { ok: true, json: async () => ({ deals: [] }) };
      },
    },
    DB: {
      prepare: () => ({
        all: async () => ({
          results: [{ slug: 'bounce', name: 'Bounce', category: 'Luggage Storage', status: 'live' }],
        }),
        bind: () => ({ run: async () => {} }),
        first: async () => null,
      }),
    },
  };
}

const ctx = { waitUntil: () => {} };

test('T5b: ad slot absent when ENABLE_T5B_ADS is false (default)', async () => {
  const env = makeRouteEnv({ ENABLE_T5B_ADS: 'false' });
  const req = new Request('https://sparkfare.com/flight/JFK/CDG');
  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /ad-slot/, 'ad slot div must not appear when flag is off');
  assert.doesNotMatch(html, /adsbygoogle/, 'AdSense script must not load when flag is off');
});

test('T5b: ad slot renders on a rich (non-thin) route when ENABLE_T5B_ADS is true', async () => {
  const env = makeRouteEnv({ ENABLE_T5B_ADS: 'true' });
  const req = new Request('https://sparkfare.com/flight/JFK/CDG');
  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /ad-slot/, 'ad slot div must appear on rich routes when flag is on');
  assert.match(html, /Advertisement/, 'ad label must appear');
  assert.doesNotMatch(html, /noindex/, 'rich route must remain indexable');
});

test('T5b: ad slot does NOT render on a thin (noindex) route even when ENABLE_T5B_ADS is true', async () => {
  const env = makeRouteEnv({ ENABLE_T5B_ADS: 'true' });
  const req = new Request('https://sparkfare.com/flight/JFK/LHR');
  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /ad-slot/, 'ad slot must not appear on thin routes even when flag is on');
  assert.match(html, /noindex/, 'thin route must carry noindex');
});
