// Q1 (Addendum Q, ROADMAP step 172, D-049, G110): the one-envelope send budget. At most one email carrying fares per recipient per local day, at most one
// lifecycle email, two non-transactional emails in all, transactional mail never blocked. Runs the real senders against a real SQLite D1 and a stubbed Resend.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { sendDailyAlerts, checkWatchlists, sendQueuedPurchaseEmails, queuePurchaseEmail } from '../src/index.js';
import { sendVerificationEmail, sendStressValveEmail, sendRouteRetrospectiveEmail, sendBookingConfirmedEmail, _resetSendingGuardForTests } from '../src/email.js';
import { claimSendSlot, claimBulkFareSlots, purgeSendLedger, deferReason, localDateFor, LIFECYCLE_RANK, DAILY_CEILING } from '../src/sendBudget.js';
import { renderDailyDigest } from '../src/emailTemplates/dailyDigest.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const now = Date.now();
const obs = (base) => Array.from({ length: 15 }, (_, i) => ({ price: base + (14 - i) * 2, date: new Date(now - (14 - i) * 86400000).toISOString() }));
const fare = (name, price) => ({ display_name: name, route_key: `JFK:${name}`, origin: 'JFK', price, found_at: new Date(now - 3600000).toISOString(), booking_link: 'https://www.aviasales.com/search/JFK1LIS2?marker=314524', observations: obs(price) });
const assets = (deals) => ({ async fetch(request) {
  return new URL(request.url).pathname === '/sparkfare_ranked_deals.json'
    ? new Response(JSON.stringify({ generated_at: new Date().toISOString(), deals, featured: [] }), { status: 200 }) : new Response('nf', { status: 404 });
} });

function resendStub({ failSends = false } = {}) {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).includes('resend.com')) return real(url, init);
    const body = JSON.parse(init.body);
    if (failSends) return new Response(JSON.stringify({ name: 'validation_error', message: 'rejected' }), { status: 422 });
    if (String(url).endsWith('/emails/batch')) { sent.push(...body); return new Response(JSON.stringify({ data: body.map((_, i) => ({ id: `b${i}` })), errors: [] }), { status: 200 }); }
    sent.push(body);
    return new Response(JSON.stringify({ id: 's1' }), { status: 200 });
  };
  return { sent, restore: () => { globalThis.fetch = real; } };
}

function setup({ users = [['u1', 'a@example.com', 'JFK', 'daily']], watch = [], deals = [fare('Lisbon, Portugal', 400)], extra = {} } = {}) {
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec('CREATE TABLE IF NOT EXISTS early_bird_snapshots (route_key TEXT NOT NULL, snapshot_date TEXT NOT NULL, price INTEGER, PRIMARY KEY (route_key, snapshot_date))');
  for (const [id, email, origin, frequency] of users) {
    db.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed, frequency, created_at) VALUES (?, ?, 1, ?, 1, ?, datetime('now'))").run(id, email, origin, frequency);
  }
  db.raw.exec("CREATE TABLE IF NOT EXISTS watchlists (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, origin_iata TEXT NOT NULL, destination TEXT NOT NULL, target_price INTEGER NOT NULL, notified_at TEXT, created_at TEXT DEFAULT (datetime('now')))");
  for (const [id, userId, dest, target] of watch) {
    db.raw.prepare('INSERT INTO watchlists (id, user_id, origin_iata, destination, target_price) VALUES (?, ?, ?, ?, ?)').run(id, userId, 'JFK', dest, target);
  }
  _resetSendingGuardForTests();
  const env = { DB: db, ASSETS: assets(deals), RESEND_API_KEY: 're_test', EMAIL_FROM: 'Sparkfare <hello@sparkfare.com>', UNSUBSCRIBE_SECRET: 'sec', APP_URL: 'https://sparkfare.com', ENABLE_EMAIL_V2: 'true', ...extra };
  return { db, env };
}
const ledger = (db) => db.raw.prepare('SELECT email, local_date, kind, stream FROM email_send_ledger ORDER BY rowid').all().map((r) => ({ ...r }));
const events = (db, type) => db.raw.prepare('SELECT meta FROM events WHERE event_type = ?').all(type).map((r) => JSON.parse(r.meta || '{}'));

// ---- the rule, on its own --------------------------------------------------------------------------------------------

test('rule: one fare email, one lifecycle email, a ceiling of two, and the order of importance', () => {
  assert.equal(deferReason([], { stream: 'digest', kind: 'digest' }), null);
  assert.equal(deferReason([{ kind: 'digest', stream: 'digest' }], { stream: 'alert', kind: 'watch_hit' }), 'one_fare_email_a_day');
  assert.equal(deferReason([{ kind: 'watch_hit', stream: 'alert' }], { stream: 'digest', kind: 'digest' }), 'one_fare_email_a_day');
  assert.equal(deferReason([{ kind: 'briefing', stream: 'trip' }], { stream: 'trip', kind: 'stress_valve' }), 'one_lifecycle_email_a_day');
  assert.equal(deferReason([{ kind: 'digest', stream: 'digest' }, { kind: 'briefing', stream: 'trip' }], { stream: 'trip', kind: 'checklist' }), 'daily_ceiling');
  assert.equal(deferReason([{ kind: 'digest', stream: 'digest' }], { stream: 'trip', kind: 'briefing' }), null, 'a fare email and a lifecycle email can share a day');
  assert.deepEqual(LIFECYCLE_RANK, ['plan_reminder', 'departing_soon', 'prep_1', 'briefing', 'prep_7', 'prep_14', 'stress_valve', 'retrospective', 'purchase_reported']);
  assert.equal(DAILY_CEILING, 2);
});

test('the daily jobs run in the order of importance: alerts, then lifecycle from highest to lowest, purchase reports last', () => {
  const src = read('src/index.js');
  const at = (needle) => { const i = src.indexOf(needle, src.indexOf('Q1 (the send budget)')); assert.ok(i > 0, needle); return i; };
  const order = ['await checkWatchlists(env);', 'await checkPtoWindowWatches(env);', 'await runPlanReminders(env);', 'await sendDepartingSoonAlerts(env);',
    'sendPreDepartureSequenceAlerts(env, { days: [1] })', 'await sendDepartureBriefingAlerts(env);', 'sendPreDepartureSequenceAlerts(env, { days: [7, 14] })',
    'await sendStressValveAlerts(env);', 'await sendRouteRetrospectives(env);', 'reconcileResult = await reconcileBookings(env);'].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the cron order is the priority order');
});

// ---- local day ------------------------------------------------------------------------------------------------------

test('local day: the recipient\'s origin zone decides the day (LAX and JFK differ around midnight UTC)', async () => {
  assert.equal(localDateFor('JFK', new Date('2026-10-28T03:00:00Z')), '2026-10-27');
  assert.equal(localDateFor('JFK', new Date('2026-10-28T05:00:00Z')), '2026-10-28');
  assert.equal(localDateFor('LAX', new Date('2026-10-28T05:00:00Z')), '2026-10-27');
  assert.equal(localDateFor('PHX', new Date('2026-10-28T08:00:00Z')), '2026-10-28', 'Arizona has no daylight time');
  assert.equal(localDateFor(null, new Date('2026-10-28T23:30:00Z')), '2026-10-28', 'UTC when the origin is unknown');
  const { db, env } = setup({ users: [['j', 'j@example.com', 'JFK', 'daily'], ['l', 'l@example.com', 'LAX', 'daily']] });
  const first = new Date('2026-10-28T03:00:00Z');
  const later = new Date('2026-10-28T05:00:00Z');
  assert.equal((await claimSendSlot(env, { email: 'j@example.com', stream: 'digest', kind: 'digest', now: first })).allow, true);
  assert.equal((await claimSendSlot(env, { email: 'l@example.com', stream: 'digest', kind: 'digest', now: first })).allow, true);
  const jfk = await claimSendSlot(env, { email: 'j@example.com', stream: 'digest', kind: 'digest', now: later });
  const lax = await claimSendSlot(env, { email: 'l@example.com', stream: 'digest', kind: 'digest', now: later });
  assert.equal(jfk.allow, true, 'it is already the next day in New York');
  assert.equal(lax.allow, false, 'it is still the same day in Los Angeles');
  assert.equal(lax.reason, 'already_sent_today');
  assert.equal(ledger(db).length, 3);
});

// ---- the ledger and the senders ---------------------------------------------------------------------------------------

test('a third non-transactional email on one day is deferred; transactional mail is never blocked', async () => {
  const { db, env } = setup();
  const stub = resendStub();
  try {
    const a = await sendStressValveEmail({ email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-12-20T10:00:00Z', trip_id: 't1' }, env);
    assert.equal(a.ok, true);
    const b = await sendRouteRetrospectiveEmail({ email: 'a@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', lockedPrice: 500, currentMedian: 450, pctDiff: 10 }, env);
    assert.equal(b.deferred, true, 'a second lifecycle email the same day');
    assert.equal(b.ok, false);
    assert.equal(stub.sent.length, 1);
    // a fare email still fits (the ceiling is two), a third does not
    db.raw.prepare("INSERT INTO email_send_ledger (email, local_date, kind, stream) VALUES ('a@example.com', ?, 'digest', 'digest')").run(localDateFor('JFK'));
    const c = await claimSendSlot(env, { email: 'a@example.com', stream: 'trip', kind: 'checklist' });
    assert.equal(c.allow, false);
    assert.equal(c.reason, 'daily_ceiling');
    const v = await sendVerificationEmail({ email: 'a@example.com', verificationUrl: 'https://sparkfare.com/api/verify?token=x' }, env);
    assert.equal(v.ok, true, 'verification is transactional');
    assert.equal(stub.sent.length, 2);
  } finally { stub.restore(); }
});

test('a failed send gives its slot back, so the retry is allowed', async () => {
  const { db, env } = setup();
  let stub = resendStub({ failSends: true });
  try { await assert.rejects(sendStressValveEmail({ email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-12-20T10:00:00Z', trip_id: 't1' }, env)); }
  finally { stub.restore(); }
  assert.equal(ledger(db).length, 0, 'the failed send left no row');
  stub = resendStub();
  try { assert.equal((await sendStressValveEmail({ email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-12-20T10:00:00Z', trip_id: 't1' }, env)).ok, true); }
  finally { stub.restore(); }
  assert.equal(ledger(db).length, 1);
});

test('every allow and defer is logged as an event with stream, kind and reason', async () => {
  const { db, env } = setup();
  const stub = resendStub();
  try {
    await sendStressValveEmail({ email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-12-20T10:00:00Z', trip_id: 't1' }, env);
    await sendRouteRetrospectiveEmail({ email: 'a@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', lockedPrice: 500, currentMedian: 450, pctDiff: 10 }, env);
  } finally { stub.restore(); }
  const slots = events(db, 'email_slot');
  assert.deepEqual(slots.map((m) => [m.decision, m.stream, m.kind, m.reason ?? null]), [['allow', 'trip', 'stress_valve', null], ['defer', 'trip', 'retrospective', 'one_lifecycle_email_a_day']]);
});

test('if the ledger cannot be read, the email is still sent (a broken budget must not silence everything)', async () => {
  const { db, env } = setup();
  const stub = resendStub();
  const real = db.prepare;
  db.prepare = (sql) => { if (/email_send_ledger/.test(sql)) throw new Error('ledger broken'); return real(sql); };
  try {
    const r = await sendStressValveEmail({ email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-12-20T10:00:00Z', trip_id: 't1' }, env);
    assert.equal(r.ok, true);
    assert.equal(stub.sent.length, 1);
  } finally { stub.restore(); db.prepare = real; }
});

test('ledger rows are kept 90 days and then purged', async () => {
  const { db, env } = setup();
  await claimSendSlot(env, { email: 'a@example.com', stream: 'digest', kind: 'digest' });
  db.raw.prepare("INSERT INTO email_send_ledger (email, local_date, kind, stream) VALUES ('old@example.com', '2020-01-01', 'digest', 'digest')").run();
  await purgeSendLedger(env);
  assert.deepEqual(ledger(db).map((r) => r.email), ['a@example.com']);
});

// ---- the digest and the alerts ----------------------------------------------------------------------------------------

test('a digest and a watch hit on the same day are ONE email, with the alert as the top block, and the watchlist is marked delivered', async () => {
  const { db, env } = setup({ watch: [['w1', 'u1', 'Lisbon, Portugal', 450]] });
  const stub = resendStub();
  try {
    await sendDailyAlerts(env);
    await checkWatchlists(env);
  } finally { stub.restore(); }
  assert.equal(stub.sent.length, 1, 'one email, not two');
  const html = stub.sent[0].html;
  assert.match(html, /Your watched route reached your price/);
  assert.ok(html.indexOf('Your watched route reached your price') < html.indexOf('<h2'), 'the alert block is above the first deal card');
  assert.match(html, /at or below the \$450 target/);
  assert.match(stub.sent[0].text, /YOUR WATCHED ROUTE REACHED YOUR PRICE/);
  assert.ok(db.raw.prepare("SELECT notified_at FROM watchlists WHERE id = 'w1'").get().notified_at, 'marked delivered');
  assert.equal(events(db, 'alert_merged_into_digest').length, 1);
  assert.equal(ledger(db).filter((r) => r.stream === 'digest' || r.stream === 'alert').length, 1);
});

test('a weekly reader with a watch hit gets the alert alone, once', async () => {
  const { db, env } = setup({ users: [['u1', 'a@example.com', 'JFK', 'weekly']], watch: [['w1', 'u1', 'Lisbon, Portugal', 450]] });
  const stub = resendStub();
  try {
    await sendDailyAlerts(env);
    assert.equal(stub.sent.length, 0, 'a weekly reader gets no daily digest');
    await checkWatchlists(env);
    await checkWatchlists(env);
  } finally { stub.restore(); }
  assert.equal(stub.sent.length, 1);
  assert.match(stub.sent[0].subject, /Target reached/);
  assert.ok(db.raw.prepare("SELECT notified_at FROM watchlists WHERE id = 'w1'").get().notified_at);
});

test('a digest that is not sent (nothing new) leaves the hit for the stand-alone alert', async () => {
  const { db, env } = setup({ watch: [['w1', 'u1', 'Lisbon, Portugal', 450]], extra: { ENABLE_DIGEST_SKIP_UNCHANGED: 'true' } });
  const stub = resendStub();
  try {
    // yesterday's snapshot equals today's deals, and the reader has had a digest recently: the digest is skipped
    const { recordSnapshot } = await import('../src/digestChange.js');
    const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
    await recordSnapshot({ DB: db }, 'JFK', yesterday, [fare('Lisbon, Portugal', 400)]);
    db.raw.exec("CREATE TABLE IF NOT EXISTS daily_alert_deliveries (delivery_key TEXT PRIMARY KEY, email TEXT NOT NULL, delivered_on TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT DEFAULT (datetime('now')))");
    db.raw.prepare("INSERT INTO daily_alert_deliveries (delivery_key, email, delivered_on, status) VALUES (?, 'a@example.com', ?, 'sent')").run(`a@example.com:${yesterday}`, yesterday);
    await sendDailyAlerts(env);
    assert.equal(stub.sent.length, 0, 'digest skipped');
    await checkWatchlists(env);
  } finally { stub.restore(); }
  assert.equal(stub.sent.length, 1);
  assert.match(stub.sent[0].subject, /Target reached/);
});

test('two digest runs on one day send one digest (the second is deferred, not failed)', async () => {
  const { db, env } = setup();
  const stub = resendStub();
  try {
    await sendDailyAlerts(env);
    db.raw.exec("UPDATE daily_alert_deliveries SET status = 'pending'"); // as if the first run had not recorded its result
    const second = await sendDailyAlerts(env);
    assert.equal(second.sent, 0);
  } finally { stub.restore(); }
  assert.equal(stub.sent.length, 1);
  assert.equal(db.raw.prepare("SELECT status FROM daily_alert_deliveries").get().status, 'deferred');
});

test('a watch hit is deferred, not lost, when the reader already had a fare email today', async () => {
  const { db, env } = setup({ users: [['u1', 'a@example.com', 'JFK', 'weekly']], watch: [['w1', 'u1', 'Lisbon, Portugal', 450]] });
  db.raw.prepare("INSERT INTO email_send_ledger (email, local_date, kind, stream) VALUES ('a@example.com', ?, 'weekly_digest', 'digest')").run(localDateFor('JFK'));
  const stub = resendStub();
  try { const r = await checkWatchlists(env); assert.equal(r.deferred, 1); assert.equal(r.notified, 0); } finally { stub.restore(); }
  assert.equal(stub.sent.length, 0);
  assert.equal(db.raw.prepare("SELECT notified_at FROM watchlists WHERE id = 'w1'").get().notified_at, null, 'still waiting for tomorrow');
});

test('archive editions never carry an alert block', () => {
  const alerts = [{ heading: 'Your watched route reached your price', body: 'x', href: 'https://example.com' }];
  const archive = renderDailyDigest({ origin: 'JFK', deals: [{ ...fare('Lisbon, Portugal', 400), status: 'deal', departure_at: '2026-12-20T10:00:00Z' }], user: null, config: { alerts, appUrl: 'https://sparkfare.com' } });
  assert.doesNotMatch(archive.html, /reached your price/);
  const personal = renderDailyDigest({ origin: 'JFK', deals: [{ ...fare('Lisbon, Portugal', 400), status: 'deal', departure_at: '2026-12-20T10:00:00Z' }], user: { id: 'u1' }, config: { alerts, appUrl: 'https://sparkfare.com' } });
  assert.match(personal.html, /reached your price/);
});

// ---- the purchase report retry ---------------------------------------------------------------------------------------

test('a purchase report held back is retried on later days and dropped once it is a week old', async () => {
  const { db, env } = setup();
  await queuePurchaseEmail(env, { trip_id: 't1', email: 'a@example.com', destination: 'Lisbon, Portugal' });
  await queuePurchaseEmail(env, { trip_id: 't2', email: 'b@example.com', destination: 'Tokyo, Japan' });
  db.raw.prepare("UPDATE purchase_email_queue SET created_at = datetime('now', '-8 days') WHERE trip_id = 't2'").run();
  // the reader already has a lifecycle email today
  db.raw.prepare("INSERT INTO email_send_ledger (email, local_date, kind, stream) VALUES ('a@example.com', ?, 'briefing', 'trip')").run(localDateFor('JFK'));
  const stub = resendStub();
  try {
    const first = await sendQueuedPurchaseEmails(env);
    assert.deepEqual(first, { sent: 0, deferred: 1, dropped: 1 });
    assert.equal(stub.sent.length, 0);
    db.raw.exec('DELETE FROM email_send_ledger');
    const second = await sendQueuedPurchaseEmails(env);
    assert.deepEqual(second, { sent: 1, deferred: 0, dropped: 0 });
  } finally { stub.restore(); }
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM purchase_email_queue').get().n, 0);
});

// ---- guards against the budget being forgotten -------------------------------------------------------------------------

test('every non-transactional sender passes a kind to the send budget', () => {
  const src = read('src/email.js');
  const calls = [...src.matchAll(/sendEmailWithGuard\(resend, env, \{([\s\S]*?)\n  \}\);/g)].map((m) => m[1]);
  assert.ok(calls.length >= 10);
  for (const body of calls) {
    if (/stream: 'transactional'/.test(body)) continue;
    assert.match(body, /kind: /, `a non-transactional send has no kind:\n${body.slice(0, 200)}`);
  }
  assert.match(src, /message\.kind = 'digest'/);
});

test('the batch digest claims in bulk, with no per-recipient queries', async () => {
  const { db, env } = setup({ users: Array.from({ length: 30 }, (_, i) => [`u${i}`, `u${i}@example.com`, 'JFK', 'daily']) });
  let ledgerQueries = 0;
  const real = db.prepare;
  db.prepare = (sql) => { if (/email_send_ledger/.test(sql) && !/CREATE/.test(sql)) ledgerQueries += 1; return real(sql); };
  const stub = resendStub();
  try { await sendDailyAlerts(env); } finally { stub.restore(); db.prepare = real; }
  assert.equal(stub.sent.length, 30);
  assert.ok(ledgerQueries <= 4, `${ledgerQueries} ledger queries for 30 recipients`);
  const bulk = await claimBulkFareSlots(env, [{ email: 'u0@example.com', origin: 'JFK' }]);
  assert.equal(bulk.denied.get('u0@example.com'), 'already_sent_today');
});
