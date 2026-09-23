import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('T5 Route Pages - Thin vs Rich pages and Sitemap', async () => {
  const fakeEnv = {
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
                  destination: 'CDG', // Rich route
                  price: 350,
                  observations: Array(15).fill(0).map((_, i) => ({
                    price: 350 + (14 - i) * 5,
                    date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                },
                {
                  origin: 'JFK',
                  destination: 'LHR', // Thin route
                  price: 400,
                  observations: Array(3).fill(0).map((_, i) => ({
                    price: 400 + (2 - i) * 5,
                    date: new Date(Date.now() - (2 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                }
              ]
            })
          };
        }
        return { ok: true, json: async () => ({ deals: [] }) };
      }
    },
    DB: {
      prepare: () => ({
        all: async () => ({
          results: [{ slug: 'bounce', name: 'Bounce', category: 'Storage', status: 'live' }]
        })
      })
    }
  };

  const ctx = { waitUntil: () => {} };

  // 1. Fetch rich route
  const req1 = new Request('https://sparkfare.com/flight/JFK/CDG');
  const res1 = await worker.fetch(req1, fakeEnv, ctx);
  assert.equal(res1.status, 200);
  const text1 = await res1.text();
  assert.match(text1, /Flight deals to CDG/);
  assert.match(text1, /Bounce/);
  assert.match(text1, /<svg/); // sparkline exists
  assert.doesNotMatch(text1, /noindex/); // indexable

  // 2. Fetch thin route
  const req2 = new Request('https://sparkfare.com/flight/JFK/LHR');
  const res2 = await worker.fetch(req2, fakeEnv, ctx);
  assert.equal(res2.status, 200);
  const text2 = await res2.text();
  assert.match(text2, /noindex/); // must be thin

  // 3. Fetch sitemap
  const req3 = new Request('https://sparkfare.com/sitemap.xml');
  const res3 = await worker.fetch(req3, fakeEnv, ctx);
  assert.equal(res3.status, 200);
  const text3 = await res3.text();
  assert.match(text3, /<loc>https:\/\/sparkfare\.com\/flight\/JFK\/CDG<\/loc>/);
  assert.doesNotMatch(text3, /LHR/); // omitted from sitemap
});
