import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('T5b Ads - Feature flag and visibility logic', async () => {
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

  // 1. Fetch rich route WITHOUT flag -> NO ADS
  const res1 = await worker.fetch(new Request('https://sparkfare.com/flight/JFK/CDG'), fakeEnv, ctx);
  const text1 = await res1.text();
  assert.doesNotMatch(text1, /class="ad-slot"/);
  assert.doesNotMatch(text1, /adsbygoogle/);

  // 2. Fetch rich route WITH flag -> ADS PRESENT
  fakeEnv.ENABLE_T5B_ADS = 'true';
  const res2 = await worker.fetch(new Request('https://sparkfare.com/flight/JFK/CDG'), fakeEnv, ctx);
  const text2 = await res2.text();
  assert.match(text2, /class="ad-slot"/);
  assert.match(text2, /adsbygoogle/);

  // 3. Fetch thin route WITH flag -> NO ADS (because thin)
  const res3 = await worker.fetch(new Request('https://sparkfare.com/flight/JFK/LHR'), fakeEnv, ctx);
  const text3 = await res3.text();
  assert.match(text3, /noindex/);
  assert.doesNotMatch(text3, /class="ad-slot"/);
});
