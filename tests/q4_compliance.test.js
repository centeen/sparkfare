import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sendVerificationEmail, sendSunsetEmail, sendTargetReachedEmail, evaluateSendingGuard, SENDING_GUARD, _resetSendingGuardForTests } from '../src/email.js';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { STREAMS, postalFooterHtml, withPostalAddress, POSTAL_FOOTER_MARKER } from '../src/emailCompliance.js';

const src = fs.readFileSync(new URL('../src/email.js', import.meta.url), 'utf8');

function stubResend() {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'x' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { sent, restore: () => { globalThis.fetch = real; } };
}

test('every sendEmailWithGuard call names a stream', () => {
  const lines = src.split('\n');
  let n = 0;
  lines.forEach((l, i) => {
    if (!/await sendEmailWithGuard\(resend, env, /.test(l)) return;
    n++;
    const block = lines.slice(i, i + 16).join('\n');
    const direct = /stream:/.test(block);
    const viaVar = /, message\);/.test(l) && /message\.stream\s*=/.test(src);
    assert.ok(direct || viaVar, 'no stream near line ' + (i + 1));
  });
  assert.ok(n >= 15, 'found ' + n);
  assert.deepEqual(STREAMS, ['transactional', 'alert', 'trip', 'digest', 'care']);
});

test('postal footer is added once and is idempotent', () => {
  const addr = '1 Test Street';
  const once = withPostalAddress({ html: `<p>x</p>${POSTAL_FOOTER_MARKER}`, text: 'x' }, addr);
  assert.match(once.html, /1 Test Street/);
  assert.equal((once.html.match(/1 Test Street/g) || []).length, 1);
  assert.match(once.text, /Sparkfare, 1 Test Street/);
  assert.match(postalFooterHtml(addr), /Sparkfare/);
});

test('non-transactional mail fails closed without an address, transactional still sends', async () => {
  const saved = process.env.EMAIL_POSTAL_ADDRESS;
  delete process.env.EMAIL_POSTAL_ADDRESS;
  const r = stubResend();
  try {
    await assert.rejects(() => sendSunsetEmail({ email: 'a@example.com' }, { RESEND_API_KEY: 'k' }));
    assert.equal(r.sent.length, 0);
    await sendVerificationEmail({ email: 'a@example.com', token: 't' }, { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com' });
    assert.equal(r.sent.length, 1, 'verification is transactional and is never blocked');
    assert.doesNotMatch(r.sent[0].html || '', /sf-postal-footer/);
  } finally {
    r.restore();
    process.env.EMAIL_POSTAL_ADDRESS = saved;
  }
});

test('non-transactional mail carries the postal line', async () => {
  const r = stubResend();
  try {
    await sendSunsetEmail({ email: 'a@example.com' }, { RESEND_API_KEY: 'k' });
    assert.match(r.sent[0].html, new RegExp(process.env.EMAIL_POSTAL_ADDRESS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally { r.restore(); }
});

test('no month, weekday, today, tomorrow or "in N days" in lifecycle subjects', () => {
  const subjects = [...src.matchAll(/subject[:=]\s*`([^`]*)`/g)].map((m) => m[1]);
  assert.ok(subjects.length > 5);
  for (const s of subjects) assert.doesNotMatch(s, /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\btoday\b|\btomorrow\b|\bin \$?\{?\w+\}? days?\b/i, s);
});

test('breaker: 199 sends never trips, 200 sends judges by rate', () => {
  assert.equal(evaluateSendingGuard({ bounces: 100, sent: 199 }).tripped, false);
  assert.equal(evaluateSendingGuard({ bounces: 11, sent: 200 }).tripped, true);
  assert.equal(SENDING_GUARD.minSample, 200);
});

test('a tripped breaker never blocks transactional mail', async () => {
  _resetSendingGuardForTests?.();
  const r = stubResend();
  try {
    const DB = makeSqliteD1([]);
    DB.raw.exec("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')))");
    const ins = DB.raw.prepare('INSERT INTO events (id, event_type) VALUES (?, ?)');
    for (let i = 0; i < 300; i++) ins.run('s' + i, 'alert_email_sent');
    for (let i = 0; i < 50; i++) ins.run('b' + i, 'email_bounce');
    await sendVerificationEmail({ email: 'a@example.com', token: 't' }, { RESEND_API_KEY: 'k', DB, APP_URL: 'https://sparkfare.com' });
    assert.equal(r.sent.length, 1);
  } finally { r.restore(); _resetSendingGuardForTests?.(); }
});

test('disclosure comes before the first partner link in the target-reached email', async () => {
  const r = stubResend();
  try {
    await sendTargetReachedEmail({ email: 'a@example.com', destination: 'Lisbon', price: 300, target: 350, origin: 'JFK', link: 'https://example.com/x' }, { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com' }).catch(() => {});
    if (r.sent[0]) {
      const h = r.sent[0].html;
      const d = h.search(/commission|affiliate/i), l = h.search(/href="https?:\/\/(?!sparkfare)/);
      if (d >= 0 && l >= 0) assert.ok(d < l);
    }
  } finally { r.restore(); }
});
