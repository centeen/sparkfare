// ROADMAP step 49: /check and /api/check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';
import { computePriceCheck, parseCheckPrice } from '../src/priceCheck.js';

const DAY = 24 * 60 * 60 * 1000;

function observations(count, basePrice, spanDays) {
  // `count` daily-ish points ending today, prices cycling 0, +10, +20 around basePrice.
  return Array.from({ length: count }, (_, i) => ({
    price: basePrice + (i % 3) * 10,
    date: new Date(Date.now() - Math.round(((count - 1 - i) * spanDays) / Math.max(count - 1, 1)) * DAY).toISOString().slice(0, 10),
  }));
}

// 20 points over 19 days. Prices 600/610/620 repeating: median is 610.
const RICH = observations(20, 600, 19);

function jfkFile() {
  return {
    generated_at: new Date().toISOString(),
    deals: [],
    featured: [],
    priced_no_deal: [{ origin: 'JFK', display_name: 'Bali, Indonesia', price: 615, observations: RICH }],
    insufficient_history: [{ origin: 'JFK', display_name: 'Tokyo, Japan', price: 900, observations: observations(5, 900, 4) }],
    no_data: [{ origin: 'JFK', display_name: 'Cusco, Peru', status: 'no_data', history_points: 0 }],
  };
}

function otherFile() {
  return {
    generated_at: new Date().toISOString(),
    deals: [], featured: [],
    priced_no_deal: [{ origin: 'LAX', display_name: 'Bali, Indonesia', price: 700, observations: observations(20, 700, 19) }],
    insufficient_history: [], no_data: [],
  };
}

const DESTINATIONS = { 'Bali, Indonesia': {}, 'Tokyo, Japan': {}, 'Cusco, Peru': {}, 'Lisbon, Portugal': {} };

function makeEnv(overrides = {}) {
  const events = [];
  const env = {
    ENABLE_PRICE_CHECK: 'true',
    ASSETS: {
      fetch: async (req) => {
        const u = new URL(req.url).pathname;
        const json = (body) => ({ ok: true, json: async () => body, text: async () => JSON.stringify(body) });
        if (u === '/sparkfare_ranked_deals.json') return json(jfkFile());
        if (u === '/sparkfare_ranked_deals_other_origins.json') return json(otherFile());
        if (u === '/sparkfare_destinations.json') return json(DESTINATIONS);
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
              events.push({ event_type, user_id, origin, route, source, meta: meta ? JSON.parse(meta) : null });
            }
            return { success: true };
          },
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    },
    ...overrides,
  };
  return { env, events };
}

async function call(path, env, init) {
  const pending = [];
  const res = await worker.fetch(new Request('https://sparkfare.com' + path, init), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}

const q = (o) => '/api/check?' + new URLSearchParams(o).toString();

// ---------- pure scoring ----------

test('parseCheckPrice accepts plain, $-prefixed and comma prices; rejects junk, zero and absurd values', () => {
  assert.equal(parseCheckPrice('650'), 650);
  assert.equal(parseCheckPrice('$1,250.50'), 1250.5);
  for (const bad of ['', 'abc', '0', '-5', '12.345', '1e3', '999999', null, undefined]) {
    assert.equal(parseCheckPrice(bad), null, `should reject ${bad}`);
  }
});

test('computePriceCheck: percent is against the median of the daily lows, rounded, with direction', () => {
  const record = { origin: 'JFK', display_name: 'Bali, Indonesia', price: 615, observations: RICH };
  const below = computePriceCheck(record, 488, new Date());
  assert.equal(below.status, 'ok');
  assert.equal(below.median, 610);
  assert.equal(below.direction, 'below');
  assert.equal(below.pct_diff, 20); // (610-488)/610 = 20%
  assert.equal(below.low, 600);
  assert.equal(below.high, 620);
  assert.equal(below.n, 20);

  const above = computePriceCheck(record, 732, new Date());
  assert.equal(above.direction, 'above');
  assert.equal(above.pct_diff, 20);

  assert.equal(computePriceCheck(record, 610, new Date()).direction, 'about_equal');
});

test('computePriceCheck: under 10 points or under 14 days gives no percentage', () => {
  const fewPoints = { origin: 'JFK', display_name: 'X', observations: observations(9, 600, 19) };
  const r1 = computePriceCheck(fewPoints, 500, new Date());
  assert.equal(r1.status, 'not_enough_history');
  assert.equal(r1.pct_diff, undefined);

  const shortSpan = { origin: 'JFK', display_name: 'X', observations: observations(12, 600, 8) };
  const r2 = computePriceCheck(shortSpan, 500, new Date());
  assert.equal(r2.status, 'not_enough_history');
  assert.equal(r2.pct_diff, undefined);
});

// ---------- flag ----------

test('flag off: /check and /api/check both 404', async () => {
  const { env } = makeEnv({ ENABLE_PRICE_CHECK: 'false' });
  assert.equal((await call('/check', env)).status, 404);
  assert.equal((await call(q({ origin: 'JFK', dest: 'Bali, Indonesia', price: '500' }), env)).status, 404);
  assert.equal((await call('/api/check/share', env, { method: 'POST', body: '{}' })).status, 404);
});

test('wrangler: /check reaches the Worker and the flag defaults off', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"run_worker_first":\s*\[[^\]]*"\/check"/);
  assert.match(cfg, /"ENABLE_PRICE_CHECK":\s*"false"/);
});

// ---------- page ----------

test('/check serves the page; a result URL is noindex, the bare page is not', async () => {
  const { env } = makeEnv();
  const bare = await call('/check', env);
  assert.equal(bare.status, 200);
  const bareHtml = await bare.text();
  assert.match(bareHtml, /Is this a good price\?/);
  assert.doesNotMatch(bareHtml, /noindex/);
  assert.doesNotMatch(bareHtml, /<!--ROBOTS-->/);

  const shared = await call('/check?o=JFK&d=Bali%2C%20Indonesia&p=500', env);
  assert.match(await shared.text(), /<meta name="robots" content="noindex">/);
});

test('check.html offers the 15 marketed origins and never TLV', () => {
  const html = fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8');
  const origins = [...html.match(/<select id="origin"[\s\S]*?<\/select>/)[0].matchAll(/value="([A-Z]{3})"/g)].map((m) => m[1]);
  assert.equal(origins.length, 15);
  assert.ok(!origins.includes('TLV'));
  for (const o of ['DEN', 'PHX', 'LAS']) assert.ok(origins.includes(o));
});

// ---------- API ----------

test('/api/check: ok result for a JFK route, with basis fields', async () => {
  const { env } = makeEnv();
  const res = await call(q({ origin: 'JFK', dest: 'Bali, Indonesia', price: '488' }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.direction, 'below');
  assert.equal(body.pct_diff, 20);
  assert.equal(body.n, 20);
  assert.equal(body.delayed, false);
  assert.ok(body.generated_at);
  assert.ok(body.window_start && body.window_end);
});

test('/api/check: a non-JFK origin reads the delayed file and says so', async () => {
  const { env } = makeEnv();
  const body = await (await call(q({ origin: 'lax', dest: 'Bali, Indonesia', price: '700' }), env)).json();
  assert.equal(body.status, 'ok');
  assert.equal(body.origin, 'LAX');
  assert.equal(body.delayed, true);
  assert.equal(body.median, 710);
});

test('/api/check: not enough history, no data, unsupported destination and origin', async () => {
  const { env } = makeEnv();
  const thin = await (await call(q({ origin: 'JFK', dest: 'Tokyo, Japan', price: '800' }), env)).json();
  assert.equal(thin.status, 'not_enough_history');
  assert.equal(thin.pct_diff, undefined);

  const none = await (await call(q({ origin: 'JFK', dest: 'Cusco, Peru', price: '800' }), env)).json();
  assert.equal(none.status, 'no_data');

  const known = await (await call(q({ origin: 'JFK', dest: 'Lisbon, Portugal', price: '800' }), env)).json();
  assert.equal(known.status, 'no_data'); // a curated destination with no record yet

  const nope = await (await call(q({ origin: 'JFK', dest: 'Atlantis', price: '800' }), env)).json();
  assert.equal(nope.status, 'unsupported_destination');

  const badOrigin = await (await call(q({ origin: 'XXX', dest: 'Bali, Indonesia', price: '800' }), env)).json();
  assert.equal(badOrigin.status, 'unsupported_origin');

  const tlv = await (await call(q({ origin: 'TLV', dest: 'Bali, Indonesia', price: '800' }), env)).json();
  assert.equal(tlv.status, 'unsupported_origin');
});

test('/api/check: missing or invalid input is a 400 and logs nothing', async () => {
  const { env, events } = makeEnv();
  for (const params of [
    { dest: 'Bali, Indonesia', price: '500' },
    { origin: 'JFK', price: '500' },
    { origin: 'JFK', dest: 'Bali, Indonesia' },
    { origin: 'JFK', dest: 'Bali, Indonesia', price: 'free' },
    { origin: 'JFK', dest: 'Bali, Indonesia', price: '0' },
    { origin: 'JFK', dest: 'Bali, Indonesia', price: '9999999' },
    { origin: 'JFK', dest: 'x'.repeat(200), price: '500' },
  ]) {
    assert.equal((await call(q(params), env)).status, 400, JSON.stringify(params));
  }
  assert.equal(events.length, 0);
});

test('/api/check: 502 when the data file is unavailable', async () => {
  const { env } = makeEnv({ ASSETS: { fetch: async () => ({ ok: false, json: async () => ({}), text: async () => '' }) } });
  assert.equal((await call(q({ origin: 'JFK', dest: 'Bali, Indonesia', price: '500' }), env)).status, 502);
});

// ---------- events ----------

test('check_run is logged with origin, route, source and the outcome', async () => {
  const { env, events } = makeEnv();
  await call(q({ origin: 'JFK', dest: 'Bali, Indonesia', price: '488', src: 'Reddit!' }), env);
  await call(q({ origin: 'JFK', dest: 'Tokyo, Japan', price: '800' }), env);
  const runs = events.filter((e) => e.event_type === 'check_run');
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0].meta, { status: 'ok', pct: 20, direction: 'below' });
  assert.equal(runs[0].origin, 'JFK');
  assert.equal(runs[0].route, 'Bali, Indonesia');
  assert.equal(runs[0].source, 'reddit'); // sanitized
  assert.equal(runs[1].meta.status, 'not_enough_history');
});

test('check_share is logged by POST /api/check/share', async () => {
  const { env, events } = makeEnv();
  const res = await call('/api/check/share', env, { method: 'POST', body: JSON.stringify({ origin: 'jfk', dest: 'Bali, Indonesia' }) });
  assert.equal(res.status, 200);
  assert.deepEqual(events.map((e) => [e.event_type, e.origin, e.route]), [['check_share', 'JFK', 'Bali, Indonesia']]);
});

test('check_signup: /api/signup with source=check records the source and a check_signup event', async () => {
  const { env, events } = makeEnv();
  const res = await call('/api/signup', env, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'local_1', email: 'check-test@example.com', origin_iata: 'DEN', trip_length: '7-10', source: 'check' }),
  });
  assert.equal(res.status, 200);
  const signup = events.find((e) => e.event_type === 'signup');
  assert.equal(signup.source, 'check');
  assert.ok(events.some((e) => e.event_type === 'check_signup'));

  // a signup from anywhere else records no check_signup
  events.length = 0;
  await call('/api/signup', env, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'local_2', email: 'other-test@example.com', origin_iata: 'DEN', trip_length: '7-10' }),
  });
  assert.ok(!events.some((e) => e.event_type === 'check_signup'));
});

test('weekly metrics roll the three check events up', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  for (const t of ['check_run', 'check_share', 'check_signup']) {
    assert.match(src, new RegExp(`event_type = '${t}' THEN 1 ELSE 0 END\\) as ${t.replace('check_', 'check_')}s`));
  }
});
