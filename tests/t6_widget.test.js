import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('T6 Widget Endpoint - eligible and rate limiting', async () => {
  let rateLimits = new Map();

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
                  display_name: 'Paris, France',
                  price: 200,
                  found_at: new Date().toISOString(),
                  observations: Array(15).fill(0).map((_, i) => ({
                    price: 400 + (14 - i) * 5,
                    date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                },
                {
                  origin: 'JFK',
                  display_name: 'London, United Kingdom',
                  price: 400,
                  observations: [] // No history, ineligible
                }
              ]
            })
          };
        }
        return { ok: true, json: async () => ({ deals: [] }) };
      }
    },
    DB: {
      prepare: (query) => {
        return {
          bind: (...args) => ({
            run: async () => {
              if (query.includes('DELETE')) return;
              if (query.includes('INSERT INTO widget_rate_limits')) {
                const ip = args[0];
                const count = rateLimits.get(ip) || 0;
                rateLimits.set(ip, count + 1);
              }
              return { success: true };
            },
            first: async () => {
              if (query.includes('SELECT request_count')) {
                const ip = args[0];
                return rateLimits.has(ip) ? { request_count: rateLimits.get(ip) } : null;
              }
              return null;
            }
          }),
          run: async () => ({ success: true })
        };
      }
    }
  };

  const ctx = { waitUntil: () => {} };

  // 1. Fetch eligible route
  const req1 = new Request('https://sparkfare.com/api/widget/JFK/' + encodeURIComponent('Paris, France'), {
    headers: { 'CF-Connecting-IP': '1.2.3.4' }
  });
  const res1 = await worker.fetch(req1, fakeEnv, ctx);
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.ok, true);
  assert.equal(data1.deal.display_name, 'Paris, France');

  // 2. Fetch ineligible route (no history)
  const req2 = new Request('https://sparkfare.com/api/widget/JFK/' + encodeURIComponent('London, United Kingdom'), {
    headers: { 'CF-Connecting-IP': '1.2.3.4' }
  });
  const res2 = await worker.fetch(req2, fakeEnv, ctx);
  assert.equal(res2.status, 404);

  // 3. Rate limiting (trigger 100 requests)
  rateLimits.set('1.2.3.4', 100);
  const req3 = new Request('https://sparkfare.com/api/widget/JFK/' + encodeURIComponent('Paris, France'), {
    headers: { 'CF-Connecting-IP': '1.2.3.4' }
  });
  const res3 = await worker.fetch(req3, fakeEnv, ctx);
  assert.equal(res3.status, 429);
});

test('T6 Widget Endpoint - matches real display_name records case-insensitively, 404s unknown routes', async () => {
  const fakeEnv = {
    ASSETS: {
      fetch: async () => ({
        ok: true,
        json: async () => ({
          deals: [],
          featured: [{
            origin: 'JFK',
            display_name: 'Marrakech, Morocco',
            price: 250,
            found_at: new Date().toISOString(),
            observations: Array(15).fill(0).map((_, i) => ({
              price: 500 + i,
              date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString()
            }))
          }]
        })
      })
    }
  };
  const ctx = { waitUntil: () => {} };

  // Featured bucket is searched too, and the lowercase URL segment still matches.
  const hit = await worker.fetch(new Request('https://sparkfare.com/api/widget/JFK/' + encodeURIComponent('marrakech, morocco')), fakeEnv, ctx);
  assert.equal(hit.status, 200);
  assert.equal((await hit.json()).deal.display_name, 'Marrakech, Morocco');

  // A route not in the feed is a clean 404, not a thrown exception.
  const miss = await worker.fetch(new Request('https://sparkfare.com/api/widget/JFK/' + encodeURIComponent('Atlantis')), fakeEnv, ctx);
  assert.equal(miss.status, 404);
});
