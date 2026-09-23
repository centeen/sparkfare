import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { sendDailyXPost } from '../src/index.js';

function makeDeal(overrides = {}) {
  const now = new Date();
  return {
    origin: 'JFK',
    display_name: 'Prague, Czechia',
    price: 400,
    status: 'deal',
    pct_below_avg: 0.2,
    found_at: now.toISOString(),
    observations: Array(15).fill(0).map((_, i) => ({
      price: 500,
      date: new Date(now.getTime() - (14 - i) * 86400000).toISOString().slice(0, 10),
    })),
    ...overrides,
  };
}

function makeAssets(jfkDeals = [], otherDeals = []) {
  return {
    fetch: async (req) => {
      const url = req.url;
      if (url.includes('sparkfare_ranked_deals_other_origins.json')) {
        return { ok: true, json: async () => ({ deals: otherDeals }) };
      }
      if (url.includes('sparkfare_ranked_deals.json')) {
        return { ok: true, json: async () => ({ deals: jfkDeals }) };
      }
      return { ok: true, json: async () => ({}) };
    },
  };
}

function makeDb({ alreadyPostedToday = false } = {}) {
  const inserted = [];
  return {
    inserted,
    prepare: (query) => ({
      bind: (...args) => ({
        first: async () => {
          if (query.includes("event_type = 'x_post_sent'")) {
            return alreadyPostedToday ? { id: 'evt1' } : null;
          }
          return null;
        },
        run: async () => {
          if (query.includes('INSERT INTO events')) inserted.push(args);
          return { success: true };
        },
      }),
    }),
  };
}

test('X broadcaster: disabled by default', async () => {
  const env = { ENABLE_X_BROADCASTER: 'false' };
  const result = await sendDailyXPost(env);
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'disabled');
});

test('X broadcaster: enabled but no credentials set', async () => {
  const env = { ENABLE_X_BROADCASTER: 'true', DB: makeDb(), ASSETS: makeAssets() };
  const result = await sendDailyXPost(env);
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'not_configured');
});

test('X broadcaster: skips if already posted today', async () => {
  const env = {
    ENABLE_X_BROADCASTER: 'true',
    X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts',
    DB: makeDb({ alreadyPostedToday: true }),
    ASSETS: makeAssets([makeDeal()]),
  };
  const result = await sendDailyXPost(env);
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'already_posted_today');
});

test('X broadcaster: skips and logs when no eligible deal exists today', async () => {
  const db = makeDb();
  const env = {
    ENABLE_X_BROADCASTER: 'true',
    X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts',
    DB: db,
    ASSETS: makeAssets([], []),
  };
  const result = await sendDailyXPost(env);
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'no_eligible_deal');
  assert.equal(db.inserted.length, 1);
});

test('X broadcaster: posts the best eligible deal and logs a real send', async () => {
  const db = makeDb();
  const weakDeal = makeDeal({ display_name: 'Lisbon, Portugal', pct_below_avg: 0.1 });
  const strongDeal = makeDeal({ display_name: 'Prague, Czechia', pct_below_avg: 0.3 });
  const env = {
    ENABLE_X_BROADCASTER: 'true',
    X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts',
    DB: db,
    ASSETS: makeAssets([weakDeal, strongDeal]),
  };

  const originalFetch = globalThis.fetch;
  let capturedRequest = null;
  globalThis.fetch = async (url, opts) => {
    capturedRequest = { url, opts };
    return {
      ok: true,
      json: async () => ({ data: { id: 'tweet123' } }),
    };
  };

  try {
    const result = await sendDailyXPost(env);
    assert.equal(result.sent, true);
    assert.equal(result.tweet_id, 'tweet123');

    assert.equal(capturedRequest.url, 'https://api.x.com/2/tweets');
    assert.match(capturedRequest.opts.headers.Authorization, /^OAuth /);
    const body = JSON.parse(capturedRequest.opts.body);
    assert.match(body.text, /Prague, Czechia/);
    assert.match(body.text, /30% below/);
    assert.match(body.text, /sparkfare\.com\/deal\/JFK/);

    assert.equal(db.inserted.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('X broadcaster: manual endpoint returns the same result shape', async () => {
  const env = { ENABLE_X_BROADCASTER: 'false', DB: makeDb(), ASSETS: makeAssets() };
  const req = new Request('https://sparkfare.com/api/send-daily-x-post', { method: 'POST' });
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.sent, false);
  assert.equal(data.reason, 'disabled');
});
