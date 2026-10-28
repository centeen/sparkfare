// Q8 (Addendum Q, ROADMAP step 176): stream tags on every send, per-stream numbers from the webhook events, guardrails that pause a stream, and the owner views.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Webhook } from 'standardwebhooks';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { handleRequest } from '../src/index.js';
import { sendVerificationEmail, sendSunsetEmail, _resetSendingGuardForTests } from '../src/email.js';
import { tagsFor, streamOfTags, srcToStream, buildStreamTable, breachesOf, checkStreamGuardrails, isStreamPaused, resumeStream, computeStreamTable, STREAM_GUARDRAILS, _resetStreamPausesForTests } from '../src/emailStreams.js';
import { computeWeeklyStandup, renderWeeklyStandup } from '../src/weeklyStandup.js';
import { METRICS } from '../src/metrics/definitions.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const SECRET = 'whsec_dGVzdHNlY3JldA==';

function resendStub() {
  const sent = []; const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).includes('resend.com')) return real(url, init);
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
  };
  return { sent, restore: () => { globalThis.fetch = real; } };
}
async function hook(env, event, id = 'm1') {
  const payload = JSON.stringify(event); const wh = new Webhook(SECRET); const t = new Date(); const pending = [];
  const res = await handleRequest(new Request('http://localhost/api/webhooks/resend', { method: 'POST',
    headers: { 'svix-id': id, 'svix-timestamp': String(Math.floor(t.getTime() / 1000)), 'svix-signature': wh.sign(id, t, payload) }, body: payload }), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}
const insertEvents = (db, type, stream, count, meta = {}) => {
  for (let i = 0; i < count; i++) db.raw.prepare("INSERT INTO events (id, event_type, meta, ts) VALUES (?, ?, ?, datetime('now', '-1 hours'))").run(`${type}${stream}${i}${Math.random()}`, type, JSON.stringify({ stream, email_id: `e${i}`, ...meta }));
};

test('tags: ASCII-clean stream and kind; streamOfTags reads an object or an array and ignores unknown streams', () => {
  assert.deepEqual(tagsFor('digest', 'weekly digest!'), [{ name: 'stream', value: 'digest' }, { name: 'kind', value: 'weekly_digest_' }]);
  assert.deepEqual(streamOfTags({ stream: 'trip', kind: 'checklist' }), { stream: 'trip', kind: 'checklist' });
  assert.deepEqual(streamOfTags([{ name: 'stream', value: 'care' }, { name: 'kind', value: 'sunset' }]), { stream: 'care', kind: 'sunset' });
  assert.deepEqual(streamOfTags({ stream: 'made-up' }), { stream: null, kind: null });
  assert.equal(srcToStream('digest_block'), 'digest'); assert.equal(srcToStream('email_followup'), 'trip'); assert.equal(srcToStream('away_mode'), null);
});

test('every guarded send carries the stream and kind tags, and a one-click unsubscribe link that names the stream', async () => {
  _resetSendingGuardForTests();
  const r = resendStub();
  try {
    const env = { RESEND_API_KEY: 'k', EMAIL_POSTAL_ADDRESS: '1 Main St', UNSUBSCRIBE_SECRET: 's3cret', DB: makeSqliteD1(MIGRATIONS) };
    await sendSunsetEmail({ email: 'a@example.com' }, env);
    await sendVerificationEmail({ email: 'a@example.com', verificationUrl: 'https://sparkfare.com/x' }, { ...env });
  } finally { r.restore(); }
  const sunset = r.sent[0]; const verify = r.sent[1];
  assert.deepEqual(sunset.tags, [{ name: 'stream', value: 'care' }, { name: 'kind', value: 'sunset' }]);
  assert.match(sunset.headers['List-Unsubscribe'], /stream=care>$/);
  assert.equal(verify.tags[0].value, 'transactional');
});

test('webhook events store the stream and kind from the tags; a permanent bounce is recorded as such', async () => {
  const db = makeSqliteD1(MIGRATIONS); const env = { RESEND_WEBHOOK_SECRET: SECRET, DB: db };
  await hook(env, { type: 'email.delivered', data: { email_id: 'e1', to: ['a@example.com'], tags: { stream: 'digest', kind: 'digest' } } }, 'a');
  await hook(env, { type: 'email.bounced', data: { email_id: 'e2', to: ['b@example.com'], bounce: { type: 'Permanent' }, tags: { stream: 'digest', kind: 'digest' } } }, 'b');
  await hook(env, { type: 'email.complained', data: { email_id: 'e3', to: ['c@example.com'], tags: [{ name: 'stream', value: 'trip' }] } }, 'c');
  const rows = db.raw.prepare("SELECT event_type, meta FROM events WHERE event_type IN ('email_delivered','email_bounce','email_complaint') ORDER BY event_type").all().map((r) => ({ t: r.event_type, m: JSON.parse(r.meta) }));
  assert.equal(rows.find((r) => r.t === 'email_delivered').m.stream, 'digest');
  assert.equal(rows.find((r) => r.t === 'email_bounce').m.bounce_type, 'Permanent');
  assert.equal(rows.find((r) => r.t === 'email_complaint').m.stream, 'trip');
});

test('a one-click unsubscribe records which stream it came from', async () => {
  const { signUnsubscribeToken } = await import('../src/postClickEmail.js');
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.prepare("INSERT INTO users (id, email, verified_email) VALUES ('u1', 'a@example.com', 1)").run();
  const env = { UNSUBSCRIBE_SECRET: 's3cret', DB: db }; const pending = [];
  const token = await signUnsubscribeToken('a@example.com', 's3cret');
  const res = await handleRequest(new Request(`http://localhost/api/unsubscribe?token=${encodeURIComponent(token)}&stream=digest`, { method: 'POST' }), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(db.raw.prepare("SELECT meta FROM events WHERE event_type = 'email_unsubscribe'").get().meta).stream, 'digest');
});

test('counts only below 1,000 delivered, rates at or above; events with no stream are left out', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  insertEvents(db, 'email_delivered', 'alert', 40); insertEvents(db, 'email_complaint', 'alert', 1);
  db.raw.prepare("INSERT INTO events (id, event_type, meta) VALUES ('old', 'email_delivered', ?)").run(JSON.stringify({ email_id: 'z' }));
  const small = await computeStreamTable({ DB: db }, { from: new Date(Date.now() - 7 * 86400000), to: new Date() });
  const alert = small.find((r) => r.stream === 'alert');
  assert.equal(alert.delivered, 40); assert.equal(alert.complaints, 1); assert.equal(alert.rates, null);
  const big = buildStreamTable({ delivered: [{ stream: 'digest', n: 2000 }], clickers: [{ stream: 'digest', n: 300 }], complaints: [{ stream: 'digest', n: 1 }] }).find((r) => r.stream === 'digest');
  assert.equal(big.rates.clickers_per_100, 15); assert.equal(big.rates.complaint_pct, 0.05);
});

test('clickers count people once and leave scanner-speed clicks out', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  for (const id of ['u1', 'u2']) db.raw.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, `${id}@example.com`);
  for (const [uid, scanner] of [['u1', false], ['u1', false], ['u2', true]]) db.raw.prepare("INSERT INTO events (id, event_type, user_id, meta) VALUES (?, 'email_click', ?, ?)").run(Math.random().toString(), uid, JSON.stringify({ stream: 'digest', scanner_suspect: scanner }));
  const t = await computeStreamTable({ DB: db }, { from: new Date(Date.now() - 86400000), to: new Date(Date.now() + 1000) });
  assert.equal(t.find((r) => r.stream === 'digest').unique_clickers, 1);
});

test('guardrails: under 1,000 delivered nothing pauses; over, complaints above 0.1% or hard bounces above 2% do', () => {
  const row = (o) => ({ stream: 'digest', delivered: 1000, complaints: 0, hard_bounces: 0, unsubscribes: 0, ...o });
  assert.deepEqual(breachesOf([row({ delivered: 999, complaints: 50 })]), []);
  assert.deepEqual(breachesOf([row({ complaints: 1 })]), [], '0.1% exactly is not over');
  assert.equal(breachesOf([row({ complaints: 2 })]).length, 1);
  assert.deepEqual(breachesOf([row({ hard_bounces: 20 })]), [], '2% exactly is not over');
  assert.equal(breachesOf([row({ hard_bounces: 21 })]).length, 1);
  assert.deepEqual(breachesOf([{ ...row({ complaints: 50 }), stream: 'transactional' }]), [], 'transactional is never paused');
  assert.equal(breachesOf([row()], { digest: { rate: 0.006, delivered: 1500, day: '2026-11-01' } }).length, 1);
  assert.deepEqual(breachesOf([row()], { digest: { rate: 0.005, delivered: 1500, day: '2026-11-01' } }), []);
  assert.equal(STREAM_GUARDRAILS.minDelivered, 1000);
});

test('a breaching stream is paused, the owner is told once, its sends stop, transactional keeps sending, and the owner can resume it', async () => {
  _resetSendingGuardForTests(); _resetStreamPausesForTests();
  const db = makeSqliteD1(MIGRATIONS); const env = { DB: db, RESEND_API_KEY: 'k', EMAIL_POSTAL_ADDRESS: '1 Main St', UNSUBSCRIBE_SECRET: 's3cret' };
  insertEvents(db, 'email_delivered', 'care', 1000); insertEvents(db, 'email_complaint', 'care', 5);
  const told = [];
  const first = await checkStreamGuardrails(env, { notify: async (b) => told.push(b) });
  assert.equal(first.paused.length, 1); assert.equal(told.length, 1);
  const again = await checkStreamGuardrails(env, { notify: async (b) => told.push(b) });
  assert.equal(again.paused.length, 0); assert.equal(told.length, 1, 'already paused: not reported again');
  assert.equal(await isStreamPaused(env, 'care'), true);
  const r = resendStub();
  try {
    await sendSunsetEmail({ email: 'a@example.com' }, env).catch(() => {});
    await sendVerificationEmail({ email: 'a@example.com', verificationUrl: 'https://sparkfare.com/x' }, env);
  } finally { r.restore(); }
  assert.equal(r.sent.length, 1, 'the paused care stream sent nothing; the transactional email went out');
  assert.equal(r.sent[0].tags[0].value, 'transactional');
  await resumeStream(env, 'care');
  assert.equal(await isStreamPaused(env, 'care'), false);
});

test('the metric definitions exist once each, and the weekly standup and growth numbers carry the stream table', async () => {
  for (const id of ['stream_delivered', 'stream_clickers', 'stream_unsubscribes', 'stream_complaints', 'stream_hard_bounces', 'stream_partner_clicks']) assert.ok(METRICS[id], id);
  const db = makeSqliteD1(MIGRATIONS);
  insertEvents(db, 'email_delivered', 'digest', 12);
  const m = await computeWeeklyStandup({ DB: db }, { now: new Date() });
  assert.equal(m.streams.find((r) => r.stream === 'digest').delivered, 12);
  const text = renderWeeklyStandup(m).text;
  assert.match(text, /EMAIL STREAMS \(7 DAYS\)/); assert.match(text, /digest: 12 delivered/); assert.match(text, /counts only below 1,000 delivered/);
});

test('the resume route needs the admin secret and a real stream', async () => {
  const env = { ADMIN_SECRET: 'adm', DB: makeSqliteD1(MIGRATIONS) };
  const call = (headers, body) => handleRequest(new Request('http://localhost/api/resume-email-stream', { method: 'POST', headers, body: JSON.stringify(body) }), env, { waitUntil() {} });
  assert.equal((await call({}, { stream: 'digest' })).status, 401);
  assert.equal((await call({ Authorization: 'Bearer adm' }, { stream: 'transactional' })).status, 400);
  assert.equal((await call({ Authorization: 'Bearer adm' }, { stream: 'digest' })).status, 200);
});
