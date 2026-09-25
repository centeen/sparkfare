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
                  display_name: 'CDG', // Rich route
                  price: 350,
                  observations: Array(15).fill(0).map((_, i) => ({
                    price: 350 + (14 - i) * 5,
                    date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                },
                {
                  origin: 'JFK',
                  display_name: 'LHR', // Thin route
                  price: 400,
                  observations: Array(3).fill(0).map((_, i) => ({
                    price: 400 + (2 - i) * 5,
                    date: new Date(Date.now() - (2 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                },
                {
                  // F3: TLV is a design-partner testing origin, deliberately excluded from
                  // sitemap/indexing -- present here with rich data specifically to prove it
                  // does NOT leak through despite otherwise passing the thin-page bar.
                  origin: 'TLV',
                  display_name: 'Larnaca, Cyprus',
                  price: 200,
                  observations: Array(15).fill(0).map((_, i) => ({
                    price: 200 + (14 - i) * 2,
                    date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                }
              ],
              // F3: real records use `display_name`, never `destination`, and priced_no_deal is
              // the largest real bucket (18 JFK routes / 119 more across other origins in
              // production) -- it must be reachable via /flight/ and listed in the sitemap, same
              // as deals/featured. "Paris, France" also exercises the URL-encoding fix (a comma
              // and a space, which the buggy pre-fix code never had to round-trip correctly).
              priced_no_deal: [
                {
                  origin: 'JFK',
                  display_name: 'Paris, France',
                  price: 420,
                  observations: Array(15).fill(0).map((_, i) => ({
                    price: 420 + (14 - i) * 3,
                    date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString()
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

  // 3. Fetch a rich priced_no_deal route (largest real-data bucket, previously unreachable) --
  //    also exercises URL-encoding for a destination with a comma and a space.
  const req3 = new Request('https://sparkfare.com/flight/JFK/' + encodeURIComponent('Paris, France'));
  const res3 = await worker.fetch(req3, fakeEnv, ctx);
  assert.equal(res3.status, 200);
  const text3 = await res3.text();
  assert.match(text3, /Flight deals to Paris, France/);
  assert.doesNotMatch(text3, /noindex/); // 15 real observations, must be indexable

  // 4. Fetch sitemap
  const req4 = new Request('https://sparkfare.com/sitemap.xml');
  const res4 = await worker.fetch(req4, fakeEnv, ctx);
  assert.equal(res4.status, 200);
  const text4 = await res4.text();
  assert.match(text4, /<loc>https:\/\/sparkfare\.com\/flight\/JFK\/CDG<\/loc>/);
  assert.match(text4, new RegExp(`<loc>https://sparkfare\\.com/flight/JFK/${encodeURIComponent('Paris, France').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
  assert.doesNotMatch(text4, /LHR/); // thin route omitted from sitemap
  assert.doesNotMatch(text4, /Larnaca/); // TLV route must never appear in the public sitemap
});
