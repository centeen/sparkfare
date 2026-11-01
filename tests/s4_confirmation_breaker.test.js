// Addendum S, S4 (D-065, G121): double opt-in confirmation emails are never held back by the bounce/complaint breaker or a stream pause.
// The code already treats the verification email as the transactional stream; nothing proved it with the breaker tripped. These tests do,
// against a real in-memory SQLite, with Resend stubbed at the network.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { sendVerificationEmail, sendSunsetEmail, _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);

beforeEach(() => _resetSendingGuardForTests());

function captureResend() {
  const original = globalThis.fetch;
  const calls = { single: [] };
  globalThis.fetch = async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (urlStr.includes('api.resend.com/emails')) {
      calls.single.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'fake-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return original(url, options);
  };
  calls.restore = () => { globalThis.fetch = original; };
  return calls;
}

// 200 digests sent and 20 bounces in the window: 10% bounce rate, well over the 5% line, so the breaker is tripped.
function tripTheBreaker(DB) {
  DB.raw.exec("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')))");
  const insert = DB.raw.prepare('INSERT INTO events (event_type) VALUES (?)');
  for (let i = 0; i < 200; i++) insert.run('alert_email_sent');
  for (let i = 0; i < 20; i++) insert.run('email_bounce');
}

test('S4: with the breaker tripped, the verification email still goes out and a care email does not', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  tripTheBreaker(DB);
  const resend = captureResend();
  try {
    const env = { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', DB };
    const sent = await sendVerificationEmail({ email: 'new@example.com', verificationUrl: 'https://sparkfare.com/api/verify?token=t', origin: 'JFK' }, env);
    assert.equal(sent.ok, true);
    assert.equal(resend.single.length, 1, 'the confirmation must be sent');
    // Control: the same database does stop a non-transactional email, so the breaker really is on.
    await assert.rejects(() => sendSunsetEmail({ email: 'reader@example.com' }, env));
    assert.equal(resend.single.length, 1, 'the care email was blocked');
  } finally { resend.restore(); }
});

test('S4: a paused stream does not pause confirmations, even a row for the transactional stream itself', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  DB.raw.exec("CREATE TABLE IF NOT EXISTS stream_pauses (stream TEXT PRIMARY KEY, reason TEXT NOT NULL, paused_at TEXT DEFAULT (datetime('now')))");
  DB.raw.exec("INSERT INTO stream_pauses (stream, reason) VALUES ('transactional', 'test'), ('care', 'test')");
  const resend = captureResend();
  try {
    const env = { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', DB };
    await sendVerificationEmail({ email: 'new@example.com', verificationUrl: 'https://sparkfare.com/api/verify?token=t' }, env);
    assert.equal(resend.single.length, 1);
  } finally { resend.restore(); }
});

test('S4: a signup made while the breaker is tripped still sends its confirmation email', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  tripTheBreaker(DB);
  const resend = captureResend();
  const pending = [];
  const ctx = { waitUntil: (p) => { pending.push(Promise.resolve(p).catch(() => {})); } };
  try {
    const res = await worker.fetch(new Request('https://sparkfare.com/api/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'local_s4', email: 's4+alias@example.com', origin_iata: 'JFK', trip_length: '7-10' }),
    }), { DB, RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com' }, ctx);
    assert.equal(res.status, 200);
    await Promise.all(pending);
    const toNew = resend.single.filter((m) => [].concat(m.to).includes('s4+alias@example.com'));
    assert.equal(toNew.length, 1, 'exactly one confirmation email was sent');
    assert.match(toNew[0].html || '', /api\/verify\?token=/);
  } finally { resend.restore(); }
});
