// The daily health check now also reports stalled data pipelines and a tripped email guard. The
// 2026-10 finding: the daily fetch had been landing 5 to 7.5 hours late for 12 days and nothing
// noticed. These tests pin what counts as a problem and that a problem becomes a real alert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDataFreshness, checkRevenueHealth, DATA_FRESHNESS_LIMITS } from '../src/index.js';
import { readSendingGuardStatus } from '../src/email.js';

const NOW = new Date('2026-10-08T08:00:00Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();

function dealsFile(ageHours, overrides = {}) {
  return {
    generated_at: hoursAgo(ageHours),
    deals: [], featured: [],
    priced_no_deal: [{ origin: 'JFK', display_name: 'Bali, Indonesia', route_key: 'JFK:Bali, Indonesia', price: 800 }],
    insufficient_history: [], no_data: [{ origin: 'JFK', display_name: 'Tokyo, Japan', route_key: 'JFK:Tokyo, Japan' }],
    ...overrides,
  };
}

// files: { fileName: hours | file object | null (missing) }
function envWith(files) {
  return {
    ASSETS: {
      fetch: async (req) => {
        const name = new URL(req.url).pathname.slice(1);
        const f = files[name];
        if (f === null || f === undefined) return { ok: false, json: async () => ({}), text: async () => '' };
        return { ok: true, json: async () => (typeof f === 'number' ? dealsFile(f) : f) };
      },
    },
  };
}
const allFresh = (extra = {}) => ({
  'sparkfare_ranked_deals.json': 5,
  'sparkfare_ranked_deals_other_origins.json': 20,
  'sparkfare_hourly_ranked_deals.json': 3,
  ...extra,
});

test('limits: the three data files, and a daily file only counts as stale after a whole missed day', () => {
  const by = Object.fromEntries(DATA_FRESHNESS_LIMITS.map((l) => [l.file, l.maxAgeHours]));
  assert.equal(by['sparkfare_ranked_deals.json'], 36);
  assert.equal(by['sparkfare_ranked_deals_other_origins.json'], 36);
  assert.equal(by['sparkfare_hourly_ranked_deals.json'], 12);
});

test('all files fresh: no problems, one detail row per file', async () => {
  const r = await checkDataFreshness(envWith(allFresh()), NOW);
  assert.deepEqual(r.problems, []);
  assert.equal(r.details.length, 3);
  assert.equal(r.details[0].ageHours, 5);
});

test('yesterday daily file at the 08:00 UTC check (about 20 hours old) is normal, not a problem', async () => {
  const r = await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals.json': 20, 'sparkfare_ranked_deals_other_origins.json': 19 })), NOW);
  assert.deepEqual(r.problems, []);
});

test('a JFK file older than 36 hours is a problem naming the file and its age; exactly 36 is not', async () => {
  const stale = await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals.json': 40 })), NOW);
  assert.equal(stale.problems.length, 1);
  assert.match(stale.problems[0], /JFK daily deals is 40 hours old/);
  assert.match(stale.problems[0], /limit is 36/);
  assert.deepEqual((await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals.json': 36 })), NOW)).problems, []);
  assert.equal((await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals.json': 36.2 })), NOW)).problems.length, 1);
});

test('the hourly feed alerts after 12 hours, not before', async () => {
  assert.deepEqual((await checkDataFreshness(envWith(allFresh({ 'sparkfare_hourly_ranked_deals.json': 11 })), NOW)).problems, []);
  const r = await checkDataFreshness(envWith(allFresh({ 'sparkfare_hourly_ranked_deals.json': 13 })), NOW);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /hourly multi-origin deals is 13 hours old/);
});

test('a missing or unreadable file, or one with no generated_at, is a problem', async () => {
  const missing = await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals_other_origins.json': null })), NOW);
  assert.equal(missing.problems.length, 1);
  assert.match(missing.problems[0], /other-origins daily deals .* could not be read/);
  const noStamp = await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals.json': { deals: [{ origin: 'JFK' }] } })), NOW);
  assert.match(noStamp.problems[0], /JFK daily deals .* no generated_at/);
});

test('a file with no priced routes at all is a problem even when fresh', async () => {
  const empty = dealsFile(2, { priced_no_deal: [], no_data: [{ origin: 'JFK', display_name: 'X', route_key: 'JFK:X' }] });
  const r = await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals.json': empty })), NOW);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /no priced routes at all/);
});

test('doubled origin prefixes in route keys are reported with a count', async () => {
  const bad = dealsFile(2, {
    priced_no_deal: [
      { origin: 'LAX', route_key: 'LAX:LAX:Bali, Indonesia' },
      { origin: 'LAX', route_key: 'LAX:Lisbon, Portugal' },
      { origin: 'ORD', route_key: 'ORD:ORD:Tokyo, Japan' },
    ],
  });
  const r = await checkDataFreshness(envWith(allFresh({ 'sparkfare_ranked_deals_other_origins.json': bad })), NOW);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /2 route key\(s\) with a doubled origin prefix/);
});

test('without the ASSETS binding nothing is reported (tests and local runs have none)', async () => {
  const r = await checkDataFreshness({}, NOW);
  assert.deepEqual(r.problems, []);
  assert.ok(r.skipped);
});

// ---- integration through checkRevenueHealth: a problem becomes a real, non-mocked alert ----

function dbWith({ bounces = 0, complaints = 0, sent = 0 } = {}) {
  return {
    prepare: (sql) => {
      const row = /FROM partner_conversions/.test(sql) ? { n: 1 } : /FROM events/.test(sql) ? { bounces, complaints, sent } : null;
      const q = { first: async () => row, all: async () => ({ results: [] }), run: async () => ({ success: true }) };
      return { ...q, bind: () => q };
    },
  };
}

function stubResend() {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'alert-id' }), { status: 200 });
    }
    return original(url, options);
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}

test('checkRevenueHealth: a stalled pipeline makes it unhealthy and sends one real alert to the ops address', async () => {
  const { sent, restore } = stubResend();
  try {
    const env = { ...envWith(allFresh({ 'sparkfare_ranked_deals.json': 80 })), TRAVELPAYOUTS_TOKEN: 't', RESEND_API_KEY: 'k', DB: dbWith() };
    const r = await checkRevenueHealth(env, { ok: true, checked: 1, matched: 0, updated: 0 });
    assert.equal(r.healthy, false);
    assert.ok(r.problems.some((p) => /JFK daily deals is \d+ hours old/.test(p)));
    assert.equal(r.alert?.ok, true);
    assert.equal(r.alert?.mocked, false);
    assert.equal(r.alert?.response?.data?.id, 'alert-id');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'hello@sparkfare.com');
    assert.match(sent[0].subject, /Sparkfare health check: \d+ issues? found/);
    assert.ok(Array.isArray(r.freshness) && r.freshness.length === 3);
  } finally { restore(); }
});

test('checkRevenueHealth: everything fresh and the guard quiet is healthy and sends nothing', async () => {
  const { sent, restore } = stubResend();
  try {
    const env = { ...envWith(allFresh()), TRAVELPAYOUTS_TOKEN: 't', RESEND_API_KEY: 'k', DB: dbWith({ bounces: 1, sent: 40 }) };
    const r = await checkRevenueHealth(env, { ok: true, checked: 1, matched: 0, updated: 0 });
    assert.equal(r.healthy, true);
    assert.deepEqual(r.problems, []);
    assert.equal(r.alert, null);
    assert.equal(sent.length, 0);
  } finally { restore(); }
});

test('checkRevenueHealth: a tripped email sending guard is reported as a problem', async () => {
  const { sent, restore } = stubResend();
  try {
    const env = { ...envWith(allFresh()), TRAVELPAYOUTS_TOKEN: 't', RESEND_API_KEY: 'k', DB: dbWith({ bounces: 12, sent: 50 }) };
    const r = await checkRevenueHealth(env, { ok: true, checked: 1, matched: 0, updated: 0 });
    assert.equal(r.healthy, false);
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], /email sending guard is tripped \(12 bounces with only 50 sends logged\)/);
    assert.equal(sent.length, 1);
  } finally { restore(); }
});

test('readSendingGuardStatus: null without a database, live numbers with one', async () => {
  assert.equal(await readSendingGuardStatus({}), null);
  const s = await readSendingGuardStatus({ DB: dbWith({ bounces: 2, complaints: 1, sent: 30 }) });
  assert.deepEqual({ t: s.tripped, b: s.bounces, c: s.complaints, n: s.sent }, { t: false, b: 2, c: 1, n: 30 });
});
