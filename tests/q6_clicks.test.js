// Q6 (Addendum Q, ROADMAP step 173, D-049, G115): clicks, not opens. A click records last_clicked_at (a scanner-speed click does not), an open can delay a pause
// but never cause one, an open no longer confirms a referral. Real SQLite D1 (the repo's migrations), the real webhook handler with signed requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Webhook } from 'standardwebhooks';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { handleRequest, pruneInactiveSubscribers } from '../src/index.js';
import { purgeDeliveryTimes, SCANNER_WINDOW_SECONDS, PAUSE_RULE } from '../src/clickSignal.js';
import { signReactivateToken } from '../src/postClickEmail.js';
import { _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const SECRET = 'whsec_dGVzdHNlY3JldA==';
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().replace('T', ' ').slice(0, 19);

function setup() {
  const db = makeSqliteD1(MIGRATIONS);
  _resetSendingGuardForTests();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: SECRET, UNSUBSCRIBE_SECRET: 'sec', APP_URL: 'https://sparkfare.com' };
  return { db, env };
}
const addUser = (db, { id, email, created = 200, opened = null, clicked = null }) =>
  db.raw.prepare("INSERT INTO users (id, email, verified_email, is_subscribed, created_at, last_opened_at, last_clicked_at) VALUES (?, ?, 1, 1, ?, ?, ?)")
    .run(id, email, daysAgo(created), opened === null ? null : daysAgo(opened), clicked === null ? null : daysAgo(clicked));
const user = (db, email) => ({ ...db.raw.prepare('SELECT * FROM users WHERE email = ?').get(email) });

async function webhook(env, event) {
  const payload = JSON.stringify(event);
  const wh = new Webhook(SECRET);
  const ts = new Date();
  const pending = [];
  const res = await handleRequest(new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: { 'svix-id': 'msg_q6', 'svix-timestamp': String(Math.floor(ts.getTime() / 1000)), 'svix-signature': wh.sign('msg_q6', ts, payload) },
    body: payload,
  }), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}
const delivered = (id, at) => ({ type: 'email.delivered', created_at: at.toISOString(), data: { email_id: id, to: ['r@example.com'] } });
const clicked = (id, at, link = 'https://sparkfare.com/x') => ({ type: 'email.clicked', created_at: at.toISOString(), data: { email_id: id, to: ['r@example.com'], click: { link } } });

// ---- the pause rule ---------------------------------------------------------------------------------------------------

test('the rule is no click in 90 days AND no open in 45 days, on an account older than 90 days', () => {
  assert.deepEqual(PAUSE_RULE, { noClickDays: 90, noOpenDays: 45, minAccountDays: 90 });
});

test('pause: an opener with no clicks for 100 days is not paused if they opened within 45 days; a clicker who has not opened is not paused', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'a', email: 'opener@example.com', opened: 20, clicked: 100 });
  addUser(db, { id: 'b', email: 'clicker@example.com', opened: 80, clicked: 30 });
  addUser(db, { id: 'c', email: 'newish@example.com', created: 60, opened: null, clicked: null });
  const r = await pruneInactiveSubscribers(env);
  assert.equal(r.pruned, 0);
  for (const e of ['opener@example.com', 'clicker@example.com', 'newish@example.com']) assert.equal(user(db, e).is_subscribed, 1, e);
});

test('pause: no click for 90 days and no open for 45 days, on an old account, is paused (and an open only ever delays it)', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'a', email: 'quiet@example.com', opened: 60, clicked: 120 });
  addUser(db, { id: 'b', email: 'never@example.com', opened: null, clicked: null });
  addUser(db, { id: 'c', email: 'borderline@example.com', opened: 46, clicked: 91 });
  addUser(db, { id: 'd', email: 'delayed@example.com', opened: 44, clicked: 200 });
  const r = await pruneInactiveSubscribers(env);
  assert.equal(r.pruned, 3);
  assert.deepEqual(['quiet', 'never', 'borderline', 'delayed'].map((n) => user(db, `${n}@example.com`).is_subscribed), [0, 0, 0, 1]);
});

test('pause: an account exactly in its first 90 days is never paused, whatever its history', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'a', email: 'young@example.com', created: 89, opened: null, clicked: null });
  assert.equal((await pruneInactiveSubscribers(env)).pruned, 0);
});

// ---- clicks and scanners ----------------------------------------------------------------------------------------------

test('a click records last_clicked_at and is logged with the reader\'s user id', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'u1', email: 'r@example.com', opened: null, clicked: null });
  const t0 = new Date(Date.now() - 3600000);
  await webhook(env, delivered('e1', t0));
  const res = await webhook(env, clicked('e1', new Date(t0.getTime() + 5 * 60000)));
  assert.equal(res.status, 200);
  assert.ok(user(db, 'r@example.com').last_clicked_at, 'recorded');
  const ev = db.raw.prepare("SELECT user_id, meta FROM events WHERE event_type = 'email_click'").get();
  assert.equal(ev.user_id, 'u1');
  assert.equal(JSON.parse(ev.meta).scanner_suspect, false);
});

test('a click within 60 seconds of delivery is a scanner: logged as suspect, and last_clicked_at is NOT updated', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'u1', email: 'r@example.com', opened: null, clicked: null });
  const t0 = new Date(Date.now() - 3600000);
  await webhook(env, delivered('e1', t0));
  await webhook(env, clicked('e1', new Date(t0.getTime() + 8000)));
  await webhook(env, clicked('e1', new Date(t0.getTime() + (SCANNER_WINDOW_SECONDS - 1) * 1000)));
  assert.equal(user(db, 'r@example.com').last_clicked_at, null);
  const rows = db.raw.prepare("SELECT meta FROM events WHERE event_type = 'email_click'").all().map((r) => JSON.parse(r.meta));
  assert.equal(rows.length, 2);
  assert.ok(rows.every((m) => m.scanner_suspect === true));
  // the 60-second line itself is a person
  await webhook(env, clicked('e1', new Date(t0.getTime() + SCANNER_WINDOW_SECONDS * 1000)));
  assert.ok(user(db, 'r@example.com').last_clicked_at);
});

test('a click with no recorded delivery is counted (an unknown is not treated as a scanner)', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'u1', email: 'r@example.com', opened: null, clicked: null });
  await webhook(env, clicked('never-delivered', new Date()));
  assert.ok(user(db, 'r@example.com').last_clicked_at);
});

test('an open updates last_opened_at but no longer confirms a referral; verification still does', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'ref', email: 'ref@example.com' });
  addUser(db, { id: 'friend', email: 'r@example.com', created: 1 });
  db.raw.prepare("INSERT INTO referrals (id, referrer_id, referred_id, status, created_at, updated_at) VALUES ('r1', 'ref', 'friend', 'pending', datetime('now'), datetime('now'))").run();
  await webhook(env, { type: 'email.opened', data: { email_id: 'e1', to: ['r@example.com'] } });
  assert.ok(user(db, 'r@example.com').last_opened_at);
  assert.equal(db.raw.prepare("SELECT status FROM referrals WHERE id = 'r1'").get().status, 'pending', 'an open proves nothing about a person');
  const { confirmPendingReferral } = await import('../src/growth.js');
  assert.equal(await confirmPendingReferral(env, 'friend'), true, 'the verification path still confirms');
});

test('pressing the reactivation button counts as a click', async () => {
  const { db, env } = setup();
  addUser(db, { id: 'u1', email: 'r@example.com', opened: 80, clicked: null });
  db.raw.prepare("UPDATE users SET is_subscribed = 0 WHERE id = 'u1'").run();
  const token = await signReactivateToken('r@example.com', 'sec');
  const res = await handleRequest(new Request(`http://localhost/api/reactivate?token=${encodeURIComponent(token)}`, { method: 'POST' }), env, { waitUntil() {} });
  assert.equal(res.status, 200);
  assert.equal(user(db, 'r@example.com').is_subscribed, 1);
  assert.ok(user(db, 'r@example.com').last_clicked_at);
});

test('delivery times are kept a week', async () => {
  const { db, env } = setup();
  await webhook(env, delivered('fresh', new Date()));
  await webhook(env, delivered('old', new Date(Date.now() - 9 * 86400000)));
  await purgeDeliveryTimes(env);
  assert.deepEqual(db.raw.prepare('SELECT email_id FROM email_delivery_times').all().map((r) => r.email_id), ['fresh']);
});

test('the webhook still rejects an unsigned request', async () => {
  const { env } = setup();
  const res = await handleRequest(new Request('http://localhost/api/webhooks/resend', { method: 'POST', body: JSON.stringify(clicked('e1', new Date())) }), env, { waitUntil() {} });
  assert.equal(res.status, 401);
});
