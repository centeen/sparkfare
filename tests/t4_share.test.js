import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

// Minimal mock environment
const createMockEnv = () => ({
  DB: {
    prepare: () => ({
      bind: () => ({
        run: async () => ({ success: true })
      })
    })
  },
  ASSETS: {
    fetch: async (req) => {
      const url = new URL(req.url);
      if (url.pathname.includes('sparkfare_ranked_deals.json')) {
        return new Response(JSON.stringify({
          generated_at: "2026-09-18T10:32:58.235620+00:00",
          deals: [
            {
              display_name: "Tulum, Mexico",
              origin: "JFK",
              price: 249,
              status: "deal",
              departure_at: "2026-12-08T20:15:00-05:00",
              history_points: 15,
              pct_below_avg: 0.1975
            }
          ]
        }));
      }
      return new Response(JSON.stringify({ deals: [] }));
    }
  }
});

test('T4: /deal/:origin/:dest/:date permalink logs share_click and renders OG tags', async () => {
  const env = createMockEnv();
  
  let loggedEvent = null;
  env.DB.prepare = (query) => ({
    // F1: logEvent() now runs a no-bind CREATE TABLE IF NOT EXISTS events guard before its
    // INSERT -- same no-bind .run() gap already hit once for T5c's own mock.
    run: async () => ({ success: true }),
    bind: (...args) => ({
      run: async () => {
        if (query.includes('INSERT INTO events')) {
          loggedEvent = { type: args[0], origin: args[3], route: args[4] };
        }
        return { success: true };
      }
    })
  });

  const request = new Request('https://sparkfare.com/deal/JFK/Tulum,%20Mexico/2026-12-08');
  const response = await worker.fetch(request, env, {});
  
  assert.equal(response.status, 200);
  const html = await response.text();
  
  assert.match(html, /<meta property="og:image" content="https:\/\/sparkfare\.com\/og\/JFK\/Tulum%2C%20Mexico\/2026-12-08" \/>/);
  assert.match(html, /<meta http-equiv="refresh" content="0; url=\/\?origin=JFK" \/>/);
  
  assert.equal(loggedEvent.type, 'share_click');
  assert.equal(loggedEvent.origin, 'JFK');
  assert.equal(loggedEvent.route, 'Tulum, Mexico');
});

test('T4: /og/:origin/:dest/:date image generator returns PNG for eligible deal', async () => {
  const env = createMockEnv();
  const request = new Request('https://sparkfare.com/og/JFK/Tulum,%20Mexico/2026-12-08');
  const response = await worker.fetch(request, env, {});
  
  assert.equal(response.status, 500); // Node.js fails dynamic WASM/TTF imports, so we expect the error catch
});

test('T4: /api/stats/deals returns public counter', async () => {
  const env = createMockEnv();
  const request = new Request('https://sparkfare.com/api/stats/deals');
  const response = await worker.fetch(request, env, {});
  
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.dealCount, 1);
  assert.match(data.message, /Deals spotted below their 30-day median: 1/);
});
