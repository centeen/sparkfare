import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Webhook } from 'standardwebhooks';
import worker, { handleRequest } from '../src/index.js';
import { sendSunsetEmail, sendSundayNewsletter, evaluateSendingGuard, SENDING_GUARD, _resetSendingGuardForTests } from '../src/email.js';

// T7 (email deliverability) had no test coverage at all. These tests run the real SQL against an
// in-memory SQLite database rather than string-matching mocks, so they exercise the actual
// suppression/guard/unsubscribe behavior:
//   - every guarded send carries List-Unsubscribe / List-Unsubscribe-Post headers
//   - a suppressed address never reaches Resend (unsubscribe, bounce and complaint all suppress)
//   - the bounce/complaint circuit breaker blocks sends, including the Sunday newsletter batch
//   - the newsletter only goes to verified, still-subscribed users
//
// The D1 wrapper enforces D1's real 100-bound-parameter-per-query cap, which plain SQLite doesn't,
// so a query that would blow up in production blows up here too.

function makeD1() {
  const db = new DatabaseSync(':memory:');
  const exec = (sql, params = []) => {
    if (params.length > 100) {
      throw new Error(`D1_ERROR: too many SQL variables (${params.length} > 100)`);
    }
    return db.prepare(sql);
  };
  const stmt = (sql, params) => ({
    run: async () => {
      exec(sql, params).run(...params);
      return { success: true };
    },
    first: async () => exec(sql, params).get(...params) ?? null,
    all: async () => ({ results: exec(sql, params).all(...params) }),
  });
  return {
    _db: db,
    prepare: (sql) => ({ ...stmt(sql, []), bind: (...params) => stmt(sql, params) }),
  };
}

function seedSchema(d1) {
  d1._db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, origin_iata TEXT, verified_email INTEGER DEFAULT 0,
      is_subscribed INTEGER DEFAULT 1, unsubscribed_at TEXT, paused_until TEXT,
      notify_email INTEGER DEFAULT 1, notify_push INTEGER DEFAULT 0, last_opened_at TEXT
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT,
      route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now'))
    );
  `);
}

function addUser(d1, u) {
  d1._db.prepare(
    'INSERT INTO users (id, email, origin_iata, verified_email, is_subscribed, unsubscribed_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(u.id, u.email, u.origin ?? 'JFK', u.verified ?? 1, u.subscribed ?? 1, u.unsubscribedAt ?? null);
}

const suppressedEmails = (d1) =>
  d1._db.prepare('SELECT email, reason FROM email_suppressions ORDER BY email').all().map((r) => ({ ...r }));

// Captures every request Resend's SDK makes; nothing leaves the process.
function captureResend() {
  const original = globalThis.fetch;
  const calls = { single: [], batch: [] };
  globalThis.fetch = async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (urlStr.includes('api.resend.com/emails/batch')) {
      calls.batch.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('api.resend.com/emails')) {
      calls.single.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'fake-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return original(url, options);
  };
  calls.restore = () => { globalThis.fetch = original; };
  return calls;
}

function makeCtx() {
  const pending = [];
  return { waitUntil: (p) => { pending.push(p); }, flush: () => Promise.all(pending) };
}

const SECRET = 'whsec_dGVzdHNlY3JldA==';
async function postWebhook(env, ctx, event) {
  const payload = JSON.stringify(event);
  const wh = new Webhook(SECRET);
  const timestamp = new Date();
  const res = await handleRequest(new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'webhook-id': 'msg_t7',
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': wh.sign('msg_t7', timestamp, payload),
    },
    body: payload,
  }), env, ctx);
  await ctx.flush();
  return res;
}

beforeEach(() => _resetSendingGuardForTests());

test('T7: a guarded send carries List-Unsubscribe and one-click List-Unsubscribe-Post headers', async () => {
  const d1 = makeD1(); seedSchema(d1);
  const resend = captureResend();
  try {
    const env = { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', DB: d1 };
    const result = await sendSunsetEmail({ email: 'reader@example.com' }, env);
    assert.equal(result.ok, true);
    assert.equal(resend.single.length, 1);
    const headers = resend.single[0].headers;
    assert.equal(headers['List-Unsubscribe'], '<https://sparkfare.com/api/unsubscribe?email=reader%40example.com>');
    assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  } finally { resend.restore(); }
});

test('T7: a suppressed address never reaches Resend', async () => {
  const d1 = makeD1(); seedSchema(d1);
  d1._db.exec(`CREATE TABLE email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')));
               INSERT INTO email_suppressions (email, reason) VALUES ('gone@example.com', 'bounce');`);
  const resend = captureResend();
  try {
    const env = { RESEND_API_KEY: 'k', DB: d1 };
    await sendSunsetEmail({ email: 'gone@example.com' }, env);
    assert.equal(resend.single.length, 0, 'suppressed recipient must not be sent to');
    await sendSunsetEmail({ email: 'fine@example.com' }, env);
    assert.equal(resend.single.length, 1, 'a non-suppressed recipient still gets its email');
  } finally { resend.restore(); }
});

test('T7: GET /api/unsubscribe (the link in every email) suppresses the address end to end', async () => {
  const d1 = makeD1(); seedSchema(d1);
  addUser(d1, { id: 'u1', email: 'leaving@example.com' });
  const resend = captureResend();
  try {
    const env = { RESEND_API_KEY: 'k', DB: d1 };
    const ctx = makeCtx();
    const res = await handleRequest(new Request('http://localhost/api/unsubscribe?email=leaving%40example.com'), env, ctx);
    await ctx.flush();
    assert.equal(res.status, 200);
    assert.notEqual(d1._db.prepare("SELECT unsubscribed_at FROM users WHERE id='u1'").get().unsubscribed_at, null);
    assert.deepEqual(suppressedEmails(d1), [{ email: 'leaving@example.com', reason: 'unsubscribed' }]);

    await sendSunsetEmail({ email: 'leaving@example.com' }, env);
    assert.equal(resend.single.length, 0, 'send after unsubscribing must be suppressed');
  } finally { resend.restore(); }
});

test('T7: POST /api/unsubscribe one-click flow suppresses the address', async () => {
  const d1 = makeD1(); seedSchema(d1);
  addUser(d1, { id: 'u1', email: 'oneclick@example.com' });
  const env = { DB: d1 };
  const ctx = makeCtx();
  const res = await handleRequest(new Request('http://localhost/api/unsubscribe?email=oneclick%40example.com', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  }), env, ctx);
  await ctx.flush();
  assert.equal(res.status, 200);
  assert.deepEqual(suppressedEmails(d1), [{ email: 'oneclick@example.com', reason: 'unsubscribed' }]);
});

test('T7: Resend bounce and complaint webhooks suppress the recipients', async () => {
  const d1 = makeD1(); seedSchema(d1);
  const env = { RESEND_WEBHOOK_SECRET: SECRET, DB: d1 };
  const bounce = await postWebhook(env, makeCtx(), { type: 'email.bounced', data: { to: ['bounced@example.com'], email_id: 'e1' } });
  const complaint = await postWebhook(env, makeCtx(), { type: 'email.complained', data: { to: ['angry@example.com'], email_id: 'e2' } });
  assert.equal(bounce.status, 200);
  assert.equal(complaint.status, 200);
  assert.deepEqual(suppressedEmails(d1), [
    { email: 'angry@example.com', reason: 'complaint' },
    { email: 'bounced@example.com', reason: 'bounce' },
  ]);
  const types = d1._db.prepare('SELECT event_type FROM events ORDER BY event_type').all().map((r) => r.event_type);
  assert.deepEqual(types, ['email_bounce', 'email_complaint']);
});

test('T7: bounce webhook then send is the full suppression round trip', async () => {
  const d1 = makeD1(); seedSchema(d1);
  // Realistic weekly volume, so this one bounce (0.5%) doesn't trip the sending guard itself --
  // the guard is exercised separately below. With no recent sends the guard divides by 1 and a
  // single bounce reads as a 100% bounce rate.
  const insert = d1._db.prepare('INSERT INTO events (id, event_type) VALUES (?, ?)');
  for (let i = 0; i < 200; i++) insert.run(`s${i}`, 'alert_email_sent');
  const resend = captureResend();
  try {
    const env = { RESEND_API_KEY: 'k', RESEND_WEBHOOK_SECRET: SECRET, DB: d1 };
    await postWebhook(env, makeCtx(), { type: 'email.bounced', data: { to: ['dead@example.com'], email_id: 'e1' } });
    await sendSunsetEmail({ email: 'dead@example.com' }, env);
    assert.equal(resend.single.length, 0);
  } finally { resend.restore(); }
});

test('T7: sending guard blocks guarded sends when the bounce rate is too high', async () => {
  const d1 = makeD1(); seedSchema(d1);
  const insert = d1._db.prepare('INSERT INTO events (id, event_type) VALUES (?, ?)');
  for (let i = 0; i < 100; i++) insert.run(`s${i}`, 'alert_email_sent');
  for (let i = 0; i < 6; i++) insert.run(`b${i}`, 'email_bounce'); // 6/100 = 6% > 5% threshold
  const resend = captureResend();
  try {
    await assert.rejects(() => sendSunsetEmail({ email: 'reader@example.com' }, { RESEND_API_KEY: 'k', DB: d1 }));
    assert.equal(resend.single.length, 0);
  } finally { resend.restore(); }
});

test('T7: Sunday newsletter skips suppressed users and attaches unsubscribe headers', async () => {
  const d1 = makeD1(); seedSchema(d1);
  d1._db.exec(`CREATE TABLE email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')));
               INSERT INTO email_suppressions (email, reason) VALUES ('bounced@example.com', 'bounce');`);
  const resend = captureResend();
  try {
    const users = [
      { id: 'a1', email: 'ok@example.com' },
      { id: 'a2', email: 'bounced@example.com' },
    ];
    await sendSundayNewsletter(
      { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', DB: d1 },
      users,
      { deals: [{ display_name: 'Lisbon, Portugal', price: 300, booking_link: 'https://example.com' }], subjectA: 'A', subjectB: 'B' }
    );
    assert.equal(resend.batch.length, 1);
    const sent = resend.batch[0];
    assert.deepEqual(sent.map((m) => m.to), [['ok@example.com']]);
    assert.equal(sent[0].headers['List-Unsubscribe'], '<https://sparkfare.com/api/unsubscribe?email=ok%40example.com>');
    assert.equal(sent[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  } finally { resend.restore(); }
});

test('T7: Sunday newsletter respects the bounce/complaint sending guard', async () => {
  const d1 = makeD1(); seedSchema(d1);
  const insert = d1._db.prepare('INSERT INTO events (id, event_type) VALUES (?, ?)');
  for (let i = 0; i < 1000; i++) insert.run(`s${i}`, 'alert_email_sent');
  for (let i = 0; i < 4; i++) insert.run(`c${i}`, 'email_complaint'); // 4/1000 = 0.4% > 0.3% threshold
  const resend = captureResend();
  try {
    await sendSundayNewsletter(
      { RESEND_API_KEY: 'k', DB: d1 },
      [{ id: 'a1', email: 'ok@example.com' }],
      { deals: [{ display_name: 'Lisbon, Portugal', price: 300, booking_link: 'https://example.com' }] }
    );
    assert.equal(resend.batch.length, 0, 'guard tripped: no batch may be sent');
  } finally { resend.restore(); }
});

test('T7: Sunday newsletter handles origins with more subscribers than D1 allows in one query', async () => {
  const d1 = makeD1(); seedSchema(d1);
  d1._db.exec(`CREATE TABLE email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d1._db.prepare("INSERT INTO email_suppressions (email, reason) VALUES ('user7@example.com', 'bounce')").run();
  const users = Array.from({ length: 250 }, (_, i) => ({ id: `id${i}`, email: `user${i}@example.com` }));
  const resend = captureResend();
  try {
    await sendSundayNewsletter(
      { RESEND_API_KEY: 'k', DB: d1 },
      users,
      { deals: [{ display_name: 'Lisbon, Portugal', price: 300, booking_link: 'https://example.com' }] }
    );
    const recipients = resend.batch.flat().map((m) => m.to[0]);
    assert.equal(recipients.length, 249, '250 users minus the one suppressed');
    assert.ok(!recipients.includes('user7@example.com'));
    assert.deepEqual(resend.batch.map((b) => b.length), [100, 100, 49], 'Resend batches capped at 100');
  } finally { resend.restore(); }
});

test('T7: newsletter trigger only targets verified, still-subscribed, non-unsubscribed users', async () => {
  const d1 = makeD1(); seedSchema(d1);
  addUser(d1, { id: 'good', email: 'good@example.com' });
  addUser(d1, { id: 'unverified', email: 'unverified@example.com', verified: 0 });
  addUser(d1, { id: 'sunset', email: 'sunset@example.com', subscribed: 0 });
  addUser(d1, { id: 'unsub', email: 'unsub@example.com', unsubscribedAt: '2026-01-01 00:00:00' });
  addUser(d1, { id: 'lax', email: 'lax@example.com', origin: 'LAX' });
  const resend = captureResend();
  try {
    const env = { RESEND_API_KEY: 'k', KPI_DASHBOARD_SECRET: 's3cret', DB: d1 };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request('http://localhost/api/admin/trigger-newsletter?key=s3cret', {
      method: 'POST',
      body: JSON.stringify({ JFK: { deals: [{ display_name: 'Lisbon, Portugal', price: 300, booking_link: 'https://example.com' }] } }),
    }), env, ctx);
    await ctx.flush();
    assert.equal(res.status, 200);
    assert.deepEqual(resend.batch.flat().map((m) => m.to[0]), ['good@example.com']);
  } finally { resend.restore(); }
});

// --- Sending guard thresholds -------------------------------------------------------------------
// The breaker used to divide by max(sent, 1) and trip at a 0.1% complaint rate, so at Sparkfare's
// real volume (a few dozen sends a week) a single bounce or complaint blocked ALL guarded email
// (verification, lifecycle, digest, newsletter) for the rest of the 7-day window.

test('guard: a lone bounce or complaint at tiny volume does not trip the breaker', () => {
  assert.equal(evaluateSendingGuard({ bounces: 1, complaints: 0, sent: 0 }).tripped, false);
  assert.equal(evaluateSendingGuard({ bounces: 1, complaints: 0, sent: 10 }).tripped, false);
  assert.equal(evaluateSendingGuard({ bounces: 0, complaints: 1, sent: 10 }).tripped, false);
  assert.equal(evaluateSendingGuard({ bounces: 2, complaints: 2, sent: 50 }).tripped, false);
});

test('guard: below the minimum sample, absolute counts still trip it', () => {
  assert.equal(evaluateSendingGuard({ bounces: 10, sent: 50 }).tripped, true);
  assert.equal(evaluateSendingGuard({ bounces: 9, sent: 50 }).tripped, false);
  assert.equal(evaluateSendingGuard({ complaints: 3, sent: 20 }).tripped, true);
  assert.equal(evaluateSendingGuard({ complaints: 2, sent: 20 }).tripped, false);
});

test('guard: at or above the minimum sample, only rates matter', () => {
  const n = SENDING_GUARD.minSample;
  // 5% bounce rate is the limit, not a trip; just over it trips.
  assert.equal(evaluateSendingGuard({ bounces: 5, sent: n }).tripped, false);
  assert.equal(evaluateSendingGuard({ bounces: 6, sent: n }).tripped, true);
  // 10 bounces is a trip below the sample floor but is only 0.1% of 10,000 sends.
  assert.equal(evaluateSendingGuard({ bounces: 10, sent: 10000 }).tripped, false);
  // 0.3% complaint rate is the limit, not a trip.
  assert.equal(evaluateSendingGuard({ complaints: 3, sent: 1000 }).tripped, false);
  assert.equal(evaluateSendingGuard({ complaints: 4, sent: 1000 }).tripped, true);
  // A clean list never trips.
  assert.equal(evaluateSendingGuard({ bounces: 0, complaints: 0, sent: 5000 }).tripped, false);
});

test('guard: reasons name what tripped it', () => {
  assert.match(evaluateSendingGuard({ bounces: 20, sent: 100 }).reason, /bounce rate 20\.00% over 100 sends/);
  assert.match(evaluateSendingGuard({ complaints: 5, sent: 1000 }).reason, /complaint rate 0\.50%/);
  assert.match(evaluateSendingGuard({ complaints: 3, sent: 20 }).reason, /3 complaints with only 20 sends/);
});

test('guard: a real single bounce at low volume no longer blocks sending end to end', async () => {
  const d1 = makeD1(); seedSchema(d1);
  const insert = d1._db.prepare('INSERT INTO events (id, event_type) VALUES (?, ?)');
  for (let i = 0; i < 2; i++) insert.run(`s${i}`, 'alert_email_sent');
  insert.run('b1', 'email_bounce');
  insert.run('c1', 'email_complaint');
  const resend = captureResend();
  try {
    await sendSunsetEmail({ email: 'reader@example.com' }, { RESEND_API_KEY: 'k', DB: d1 });
    assert.equal(resend.single.length, 1, 'one bounce + one complaint at 2 sends must not block email');
  } finally { resend.restore(); }
});

test('guard: a trip clears on its own after the cache window instead of lasting for the isolate lifetime', async () => {
  const d1 = makeD1(); seedSchema(d1);
  const insert = d1._db.prepare('INSERT INTO events (id, event_type) VALUES (?, ?)');
  for (let i = 0; i < 100; i++) insert.run(`s${i}`, 'alert_email_sent');
  for (let i = 0; i < 10; i++) insert.run(`b${i}`, 'email_bounce'); // 10% -> tripped
  const resend = captureResend();
  const realNow = Date.now();
  const now = mock.method(Date, 'now', () => realNow);
  try {
    const env = { RESEND_API_KEY: 'k', DB: d1 };
    await assert.rejects(() => sendSunsetEmail({ email: 'a@example.com' }, env));

    // Conditions improve (the bounces age out of the window), but within the cache TTL the
    // verdict is still the cached "tripped".
    d1._db.exec("DELETE FROM events WHERE event_type = 'email_bounce'");
    now.mock.mockImplementation(() => realNow + SENDING_GUARD.cacheMs - 1000);
    await assert.rejects(() => sendSunsetEmail({ email: 'a@example.com' }, env));

    // Past the TTL it is re-evaluated and sending resumes.
    now.mock.mockImplementation(() => realNow + SENDING_GUARD.cacheMs + 1000);
    await sendSunsetEmail({ email: 'a@example.com' }, env);
    assert.equal(resend.single.length, 1);
  } finally {
    now.mock.restore();
    resend.restore();
  }
});
