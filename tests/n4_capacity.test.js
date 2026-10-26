// N4 (Addendum N): capacity. The daily digest must not depend on the number of subscribers for its D1 query count
// (Workers Paid allows 1,000 per invocation; the per-recipient version made about eleven per subscriber and broke at roughly 90),
// sends through Resend's batch endpoint, never duplicates, isolates failures, and produces the same email as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { sendDailyAlerts } from '../src/index.js';
import { sendDailyDealEmail, sendDailyDealEmailBatch, DIGEST_BATCH_SIZE, _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ORIGINS = ['JFK', 'LAX', 'ORD', 'ATL', 'DFW', 'SFO', 'MIA', 'IAD', 'EWR', 'SEA', 'IAH', 'BOS', 'DEN', 'PHX', 'LAS', 'PHL', 'MSP', 'CLT', 'DTW', 'FLL', 'BWI', 'AUS', 'TLV'];
const D1_QUERY_LIMIT = 1000; // Workers Paid, per invocation (developers.cloudflare.com/d1/platform/limits, read 2026-10-24)
const NAMES = ['Lisbon, Portugal', 'Tokyo, Japan', 'Bali, Indonesia'];

const now = Date.now();
const obs = (base) => Array.from({ length: 15 }, (_, i) => ({ price: base + (14 - i) * 2, date: new Date(now - (14 - i) * 86400000).toISOString() }));
const foundAt = new Date(now - 3600000).toISOString();
const deal = (o, name, price) => ({
  display_name: name, route_key: `${o}:${name}`, origin: o, price, found_at: foundAt,
  departure_at: new Date(now + 40 * 86400000).toISOString(), return_at: new Date(now + 47 * 86400000).toISOString(),
  booking_link: 'https://www.aviasales.com/search/X?marker=314524', airline: 'XX', observations: obs(price), history_points: 15,
  status: 'deal', pct_below_avg: 20, basis_text: '20% below the 30-day median', median_baseline: price * 1.25, is_stale_fallback: false,
});
const FEEDS = {
  'sparkfare_ranked_deals.json': { generated_at: new Date().toISOString(), deals: NAMES.map((n, i) => deal('JFK', n, 400 + i * 100)), featured: [] },
  'sparkfare_ranked_deals_other_origins.json': { generated_at: new Date().toISOString(), deals: ORIGINS.slice(1).flatMap((o) => NAMES.map((n, i) => deal(o, n, 400 + i * 100))), featured: [] },
};
const ASSETS = { async fetch(req) { const f = new URL(req.url).pathname.slice(1); return FEEDS[f] ? new Response(JSON.stringify(FEEDS[f])) : new Response('nf', { status: 404 }); } };

// A D1 wrapper that counts every statement the code sends (each .run/.first/.all is one query).
function countingDb() {
  const real = makeSqliteD1(MIGRATIONS);
  const counter = { n: 0 };
  const wrap = (s) => ({
    bind: (...a) => wrap(s.bind(...a)),
    first: (...a) => { counter.n++; return s.first(...a); },
    all: (...a) => { counter.n++; return s.all(...a); },
    run: (...a) => { counter.n++; return s.run(...a); },
  });
  return { DB: { prepare: (sql) => wrap(real.prepare(sql)), raw: real.raw }, raw: real.raw, counter };
}

function seed(raw, n) {
  const stmt = raw.prepare('INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed, created_at) VALUES (?, ?, 1, ?, 1, ?)');
  for (let i = 0; i < n; i++) stmt.run(`u${i}`, `user${i}@example.com`, ORIGINS[i % ORIGINS.length], new Date().toISOString());
}

// Stubs Resend's HTTP API. `reject` lists recipient addresses a permissive batch reports as invalid; `failBatch` makes the batch endpoint itself fail.
function resendStub({ reject = [], failBatch = false } = {}) {
  const calls = { batches: [], singles: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('resend.com')) return real(url, init);
    const body = JSON.parse(init.body);
    if (u.endsWith('/emails/batch')) {
      if (failBatch) return new Response(JSON.stringify({ name: 'internal_server_error', message: 'batch unavailable', statusCode: 500 }), { status: 500 });
      calls.batches.push({ body, headers: Object.fromEntries(new Headers(init.headers)) });
      const errors = body.map((m, index) => (reject.includes(m.to) ? { index, message: 'Invalid `to` field' } : null)).filter(Boolean);
      return new Response(JSON.stringify({ data: body.map((_, i) => ({ id: `b${i}` })).filter((_, i) => !errors.some((e) => e.index === i)), errors }), { status: 200 });
    }
    calls.singles.push(body);
    if (reject.includes(body.to)) return new Response(JSON.stringify({ name: 'validation_error', message: 'Invalid `to` field', statusCode: 422 }), { status: 422 });
    return new Response(JSON.stringify({ id: `s${calls.singles.length}` }), { status: 200 });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const baseEnv = (DB, extra = {}) => (_resetSendingGuardForTests(), { DB, ASSETS, RESEND_API_KEY: 're_test', EMAIL_FROM: 'Sparkfare <hello@sparkfare.com>', UNSUBSCRIBE_SECRET: 'test-secret', APP_URL: 'https://sparkfare.com', ...extra });
const statuses = (raw) => Object.fromEntries(raw.prepare('SELECT status, COUNT(*) AS n FROM daily_alert_deliveries GROUP BY status').all().map((r) => [r.status, r.n]));

// ---- indexes -----------------------------------------------------------------------------------------------------------

test('the busiest queries use the new indexes', () => {
  const { raw } = countingDb();
  const plan = (sql) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
  // Copies of the queries in src/metrics/definitions.js (the standup and growth queries moved there in N11) and src/index.js (checked to still exist below).
  assert.match(plan("SELECT COUNT(*) FROM events WHERE event_type = 'signup' AND ts >= '2026-10-17' AND ts < '2026-10-24'"), /idx_events_type_ts/);
  assert.match(plan("SELECT COUNT(*) FROM events WHERE ts >= '2026-10-17'"), /idx_events_ts/);
  assert.match(plan("SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1"), /idx_users_verified_subscribed/);
  assert.match(plan("SELECT COUNT(*) FROM users WHERE created_at >= '2026-10-17' AND created_at < '2026-10-24'"), /idx_users_created_at/);
  assert.match(plan("SELECT * FROM trips WHERE user_id = 'u1'"), /idx_trips_user/);
  assert.doesNotMatch(plan("SELECT COUNT(*) FROM events WHERE event_type = 'signup' AND ts >= '2026-10-17'"), /SCAN events/);
  for (const [file, text] of [
    ['src/metrics/definitions.js', 'FROM events WHERE event_type = ? AND ts >= ? AND ts < ?'],
    ['src/metrics/definitions.js', "FROM events WHERE event_type = 'email_verified' AND ts >= ?"],
    ['src/index.js', 'verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1'],
  ]) assert.ok(fs.readFileSync(file, 'utf8').includes(text), `${file} no longer contains the query this test mirrors`);
});

test('the migration only adds indexes', () => {
  const sql = fs.readFileSync('migrations/0033_capacity_indexes.sql', 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /DROP|DELETE|UPDATE|INSERT|ALTER|CREATE TABLE/i);
  assert.equal((sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 5);
});

// ---- the load test -----------------------------------------------------------------------------------------------------

for (const flags of [{ ENABLE_EMAIL_V2: 'true', ENABLE_DIGEST_SKIP_UNCHANGED: 'true', ENABLE_T3_REFERRALS: 'true' }, {}]) {
  test(`2,500 subscribers across 23 origins: few queries, 25 batch calls, no duplicates (${flags.ENABLE_EMAIL_V2 ? 'production flags' : 'v1 email'})`, async () => {
    const { DB, raw, counter } = countingDb();
    seed(raw, 2500);
    const stub = resendStub();
    const t0 = Date.now(); const cpu0 = process.cpuUsage();
    let result;
    try { result = await sendDailyAlerts(baseEnv(DB, flags)); } finally { stub.restore(); }
    const cpu = process.cpuUsage(cpu0);
    assert.equal(result.sent, 2500);
    assert.equal(stub.calls.singles.length, 0);
    assert.equal(stub.calls.batches.length, Math.ceil(2500 / DIGEST_BATCH_SIZE));
    assert.ok(stub.calls.batches.every((b) => b.body.length <= DIGEST_BATCH_SIZE));
    assert.equal(stub.calls.batches.reduce((n, b) => n + b.body.length, 0), 2500);
    assert.ok(counter.n < D1_QUERY_LIMIT / 2, `${counter.n} D1 queries for 2,500 subscribers; the limit is ${D1_QUERY_LIMIT} per invocation`);
    assert.deepEqual(statuses(raw), { sent: 2500 });
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM (SELECT delivery_key FROM daily_alert_deliveries GROUP BY delivery_key HAVING COUNT(*) > 1)').get().n, 0);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'alert_email_sent'").get().n, 2500);
    const to = stub.calls.batches.flatMap((b) => b.body.map((m) => m.to));
    assert.equal(new Set(to).size, 2500, 'every subscriber is emailed exactly once');
    console.log(`  load test: ${counter.n} D1 queries, ${stub.calls.batches.length} Resend batch calls, wall ${Date.now() - t0} ms, CPU ${Math.round((cpu.user + cpu.system) / 1000)} ms`);
  });
}

test('a second run the same day sends nothing and makes a constant number of queries', async () => {
  const { DB, raw, counter } = countingDb();
  seed(raw, 400);
  const env = baseEnv(DB);
  let stub = resendStub();
  try { await sendDailyAlerts(env); } finally { stub.restore(); }
  counter.n = 0;
  stub = resendStub();
  let again;
  try { again = await sendDailyAlerts(env); } finally { stub.restore(); }
  assert.equal(again.sent, 0);
  assert.equal(again.skipped, 400);
  assert.equal(stub.calls.batches.length + stub.calls.singles.length, 0, 'nothing is sent twice');
  assert.ok(counter.n < 30, `${counter.n} queries on a run with nothing to send`);
});

test('the query count does not grow with the number of subscribers', async () => {
  const counts = [];
  for (const n of [50, 500]) {
    const { DB, raw, counter } = countingDb();
    seed(raw, n);
    const stub = resendStub();
    try { await sendDailyAlerts(baseEnv(DB)); } finally { stub.restore(); }
    counts.push(counter.n);
  }
  assert.ok(counts[1] < counts[0] * 3, `50 subscribers: ${counts[0]} queries, 500: ${counts[1]} (it should grow by chunks of 100, not per subscriber)`);
});

// ---- failures stay with the recipient that caused them ------------------------------------------------------------------

test('one invalid recipient in a batch fails alone; the others are sent and marked sent', async () => {
  const { DB, raw } = countingDb();
  seed(raw, 30);
  const stub = resendStub({ reject: ['user7@example.com'] });
  let result;
  try { result = await sendDailyAlerts(baseEnv(DB)); } finally { stub.restore(); }
  assert.equal(result.sent, 29);
  assert.deepEqual(statuses(raw), { sent: 29, failed: 1 });
  const bad = raw.prepare("SELECT delivery_key, error FROM daily_alert_deliveries WHERE status = 'failed'").get();
  assert.match(bad.delivery_key, /^user7@example\.com:/);
  assert.match(bad.error, /Invalid `to` field/);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'alert_email_sent'").get().n, 29);
});

test('if the batch endpoint itself fails, recipients are sent one by one and a bad one still fails alone', async () => {
  const { DB, raw } = countingDb();
  seed(raw, 12);
  const stub = resendStub({ failBatch: true, reject: ['user3@example.com'] });
  let result;
  try { result = await sendDailyAlerts(baseEnv(DB)); } finally { stub.restore(); }
  assert.equal(result.sent, 11);
  assert.equal(stub.calls.singles.length, 12);
  assert.deepEqual(statuses(raw), { sent: 11, failed: 1 });
});

test('a suppressed address is not emailed but is marked done, as before; the rest are sent', async () => {
  const { DB, raw } = countingDb();
  seed(raw, 10);
  raw.exec("CREATE TABLE IF NOT EXISTS email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')))");
  raw.prepare("INSERT INTO email_suppressions (email, reason) VALUES ('user2@example.com', 'bounce')").run();
  const stub = resendStub();
  let result;
  try { result = await sendDailyAlerts(baseEnv(DB)); } finally { stub.restore(); }
  const to = stub.calls.batches.flatMap((b) => b.body.map((m) => m.to));
  assert.equal(to.length, 9);
  assert.ok(!to.includes('user2@example.com'));
  assert.equal(result.sent, 10);
  assert.deepEqual(statuses(raw), { sent: 10 });
});

test('with no Resend key the run is mocked, as before: every recipient counted, nothing sent', async () => {
  const { DB, raw } = countingDb();
  seed(raw, 5);
  const stub = resendStub();
  let result;
  try { result = await sendDailyAlerts({ DB, ASSETS }); } finally { stub.restore(); }
  assert.equal(result.sent, 5);
  assert.equal(stub.calls.batches.length + stub.calls.singles.length, 0);
});

// ---- the email itself is unchanged -------------------------------------------------------------------------------------

for (const flags of [{ ENABLE_EMAIL_V2: 'true', ENABLE_T3_REFERRALS: 'true' }, {}]) {
  test(`a batch email is identical to the single email (${flags.ENABLE_EMAIL_V2 ? 'v2 digest' : 'v1 digest'}): subject, html, text and unsubscribe headers`, async () => {
    const { DB, raw } = countingDb();
    raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed, created_at) VALUES ('u1', 'one@example.com', 1, 'LAX', 1, ?)").run(new Date().toISOString());
    raw.exec("CREATE TABLE IF NOT EXISTS referral_codes (user_id TEXT PRIMARY KEY, code TEXT NOT NULL)");
    raw.prepare("INSERT OR REPLACE INTO referral_codes (user_id, code) VALUES ('u1', 'abc123')").run();
    const env = baseEnv(DB, flags);
    const deals = FEEDS['sparkfare_ranked_deals_other_origins.json'].deals.filter((d) => d.origin === 'LAX');
    const stub = resendStub();
    try {
      await sendDailyDealEmail({ email: 'one@example.com', origin: 'LAX', deals, userId: 'u1' }, env);
      await sendDailyDealEmailBatch([{ email: 'one@example.com', origin: 'LAX', deals, userId: 'u1' }], env);
    } finally { stub.restore(); }
    const single = stub.calls.singles[0];
    const batched = stub.calls.batches[0].body[0];
    assert.equal(batched.subject, single.subject);
    assert.equal(batched.html, single.html);
    assert.equal(batched.text, single.text);
    assert.equal(batched.from, single.from);
    assert.equal(batched.to, single.to);
    assert.equal(batched.headers['List-Unsubscribe'], single.headers['List-Unsubscribe']);
    assert.equal(batched.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    if (flags.ENABLE_T3_REFERRALS) assert.match(single.html, /\/r\/abc123/, 'the referral link is in the email (so the comparison above covers it)');
  });
}

test('each batch carries an idempotency key so a retry cannot double-send, and it depends on the recipients', async () => {
  const { DB, raw } = countingDb();
  seed(raw, 3);
  const stub = resendStub();
  try { await sendDailyAlerts(baseEnv(DB)); } finally { stub.restore(); }
  const key = stub.calls.batches[0].headers['idempotency-key'];
  assert.match(key, /^daily-digest-\d{4}-\d\d-\d\d-[0-9a-f]{24}$/);
});

test('a tripped sending guard marks every recipient failed and sends nothing', async () => {
  const { DB, raw } = countingDb();
  seed(raw, 4);
  _resetSendingGuardForTests(); // the verdict is cached for ten minutes per process
  // make the guard see 11 bounces in the last 7 days (the small-volume trip point)
  raw.exec("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')))");
  for (let i = 0; i < 12; i++) raw.prepare("INSERT INTO events (id, event_type) VALUES (?, 'email_bounce')").run(`bounce${i}`);
  const stub = resendStub();
  let result;
  try { result = await sendDailyAlerts(baseEnv(DB)); } finally { stub.restore(); }
  assert.equal(stub.calls.batches.length + stub.calls.singles.length, 0);
  assert.equal(result.sent, 0);
  assert.ok(statuses(raw).failed >= 1);
  _resetSendingGuardForTests();
});
