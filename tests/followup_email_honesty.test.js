// Phase A honesty fix: the post-click follow-up must never say or imply a completed booking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendAwayModeFollowUpEmail, formatShortDate, followUpSubject, followUpIntro } from '../src/email.js';

const BANNED = [/you're booked/i, /you are booked/i, /locked in/i, /locked/i, /secured/i, /guaranteed/i];

async function capture(trip, envExtra = {}) {
  const original = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, options) => {
    const u = typeof url === 'string' ? url : url.url;
    if (u.includes('api.resend.com/emails')) {
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: 'fake' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return original(url, options);
  };
  try {
    const env = { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', ...envExtra };
    const r = await sendAwayModeFollowUpEmail({ email: 'a@example.com', trip_id: 't1', ...trip }, env);
    assert.equal(r.ok, true);
    assert.equal(r.mocked, false);
    return sent;
  } finally {
    globalThis.fetch = original;
  }
}

test('formatShortDate reads the written calendar date, no timezone shift', () => {
  assert.equal(formatShortDate('2026-12-06'), 'Dec 6');
  assert.equal(formatShortDate('2026-12-06T23:30:00-08:00'), 'Dec 6');
  assert.equal(formatShortDate('2026-01-31T00:05:00+09:00'), 'Jan 31');
  assert.equal(formatShortDate(null), null);
  assert.equal(formatShortDate('garbage'), null);
  assert.equal(formatShortDate('2026-13-01'), null);
});

test('subject is "{Destination}, {Mon D}: your pre-flight checklist", date omitted if unknown', () => {
  assert.equal(followUpSubject('Cancun, Mexico', '2026-12-06'), 'Cancun, Mexico, Dec 6: your pre-flight checklist');
  assert.equal(followUpSubject('Cancun, Mexico', null), 'Cancun, Mexico: your pre-flight checklist');
  assert.doesNotMatch(followUpSubject('Cancun, Mexico', 'nope'), /undefined|null|, :/);
});

test('intro is a statement of what the traveller was looking at, with the My Trips fallback', () => {
  const t = followUpIntro('Lisbon, Portugal', '2026-11-27');
  assert.match(t, /You were looking at Lisbon, Portugal on Nov 27\./);
  assert.match(t, /If you haven't finished booking yet, your trip is saved in My Trips\./);
  assert.doesNotMatch(followUpIntro('Lisbon, Portugal', null), / on \./);
});

test('rendered email contains no booking-completed or guarantee wording', async () => {
  for (const trip of [
    { destination: 'Lisbon, Portugal', departure_at: '2026-11-27T10:00:00-05:00' },
    { destination: 'Lisbon, Portugal', departure_at: null },
  ]) {
    const sent = await capture(trip);
    for (const re of BANNED) {
      assert.doesNotMatch(sent.subject, re, `subject matches ${re}`);
      assert.doesNotMatch(sent.html, re, `html matches ${re}`);
    }
  }
});

test('disclosure is plural and comes before the first link', async () => {
  const sent = await capture({ destination: 'Lisbon, Portugal', departure_at: '2026-11-27' });
  const text = 'Sparkfare may earn a commission if you book or buy through the links in this email, at no extra cost to you.';
  const at = sent.html.indexOf(text);
  assert.ok(at >= 0, 'plural disclosure present');
  assert.ok(at < sent.html.indexOf('<a '), 'disclosure precedes the first link');
});

test('unsubscribe headers are still attached', async () => {
  const sent = await capture({ destination: 'Lisbon, Portugal', departure_at: '2026-11-27' });
  assert.ok(sent.headers['List-Unsubscribe']);
  assert.equal(sent.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});
