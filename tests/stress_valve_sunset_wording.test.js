// Two wording claims the data could not back:
//  - the stress-valve subject said "Two days in", but the email goes out 2 to 4 days after the click;
//  - the sunset email said "you haven't checked the ledger recently", but it is driven by open tracking, which is
//    blind for readers whose mail client blocks images.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendStressValveEmail, sendSunsetEmail } from '../src/email.js';

async function capture(fn, args) {
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
    const r = await fn({ email: 'a@example.com', ...args }, { RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com' });
    assert.equal(r.mocked, false);
    return sent;
  } finally { globalThis.fetch = original; }
}

test('stress valve: the subject makes no claim about how many days have passed', async () => {
  const sent = await capture(sendStressValveEmail, { trip_id: 't1', destination: 'Madrid, Spain', departure_at: '2026-11-14T10:00:00-05:00' });
  assert.equal(sent.subject, 'Is Madrid, Spain actually handled?');
  assert.doesNotMatch(sent.subject, /two days|\d+ days|days in/i);
});

test('sunset: says what we measured and that it can be wrong, with no "ledger"', async () => {
  const sent = await capture(sendSunsetEmail, {});
  assert.match(sent.html, /no opened Sparkfare emails in the last 45 days/);
  assert.match(sent.html, /aren.t always visible to us/);
  assert.match(sent.html, /one tap turns them back on/);
  assert.doesNotMatch(sent.html, /ledger/i);
  assert.doesNotMatch(sent.html, /haven.t checked/i);
  // The reactivation and unsubscribe links are still there.
  assert.match(sent.html, /Turn my alerts back on/);
  assert.match(sent.html, /unsubscribe me completely/);
});
