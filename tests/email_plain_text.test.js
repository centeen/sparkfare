// E-1 (K-B0 re-check): every guarded email carries a plain-text part. Until now nine of the ten transactional
// emails were HTML-only. The text is derived from the HTML in sendEmailWithGuard unless the caller wrote one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from '../src/htmlToText.js';
import * as E from '../src/email.js';

test('htmlToText: links keep their address, tags and styles go, blocks become lines', () => {
  const t = htmlToText('<style>p{color:red}</style><div><p>Hello &amp; welcome</p><p>Open <a href="https://sparkfare.com/x?a=1&amp;b=2">your plan</a>.</p><ul><li>One</li><li>Two</li></ul></div>');
  assert.match(t, /^Hello & welcome\n\nOpen your plan \(https:\/\/sparkfare\.com\/x\?a=1&b=2\)\./);
  assert.match(t, /- One\n- Two/);
  assert.doesNotMatch(t, /<|color:red/);
});

test('htmlToText: a link whose label is its address, a mailto and an empty link are not doubled or left blank', () => {
  assert.equal(htmlToText('<a href="https://a.com">https://a.com</a>'), 'https://a.com\n');
  assert.equal(htmlToText('<a href="mailto:hello@sparkfare.com">hello@sparkfare.com</a>'), 'hello@sparkfare.com\n');
  assert.equal(htmlToText('x<a href="https://a.com"></a>y'), 'xy\n');
});

test('htmlToText: not-a-string input gives an empty string, not a throw', () => {
  assert.equal(htmlToText(undefined), '');
  assert.equal(htmlToText(null), '');
});

const sent = [];
const realFetch = globalThis.fetch;
test.before(() => {
  globalThis.fetch = async (url, init) => {
    try { sent.push(JSON.parse(init.body)); } catch { sent.push({}); }
    return new Response(JSON.stringify({ id: 'x' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
});
test.after(() => { globalThis.fetch = realFetch; });

const env = { RESEND_API_KEY: 're_test', EMAIL_FROM: 'hello@sparkfare.com', APP_URL: 'https://sparkfare.com', UNSUBSCRIBE_SECRET: 'testsecret' };
const trip = { email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-11-20T10:00:00Z', return_at: '2026-11-27T10:00:00Z', origin_iata: 'JFK', price_at_click: 480, trip_id: 't1', trip_length: '4-6', passenger_count: 2 };
const calls = {
  verification: () => E.sendVerificationEmail({ email: 'a@example.com', verificationUrl: 'https://sparkfare.com/api/verify?token=x' }, env),
  awayFollowUp: () => E.sendAwayModeFollowUpEmail(trip, env),
  stressValve: () => E.sendStressValveEmail(trip, env),
  briefing: () => E.sendDepartureBriefingEmail(trip, env),
  departingSoon: () => E.sendDepartingSoonEmail({ ...trip, daysUntil: 3 }, env),
  bookingConfirmed: () => E.sendBookingConfirmedEmail(trip, env),
  sunset: () => E.sendSunsetEmail({ email: 'a@example.com' }, env),
  targetReached: () => E.sendTargetReachedEmail({ email: 'a@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', price: 400, targetPrice: 420, bookingLink: 'https://www.aviasales.com/search/x?marker=314524', foundAt: '2026-10-20T10:00:00Z' }, env),
  retrospective: () => E.sendRouteRetrospectiveEmail({ email: 'a@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', lockedPrice: 480, currentMedian: 520, pctDiff: 8 }, env),
};

for (const [name, fn] of Object.entries(calls)) {
  test(`${name}: the sent email has a plain-text part that matches its HTML`, async () => {
    sent.length = 0;
    await fn();
    const m = sent[0];
    assert.ok(m && m.html, 'an email was sent');
    assert.ok(typeof m.text === 'string' && m.text.trim().length > 40, 'has a text part');
    assert.doesNotMatch(m.text, /<\/?[a-z][^>]*>|font-family|prefers-color-scheme/i, 'no markup or CSS in the text');
    // Every link in the HTML appears, with its address, in the text.
    const hrefs = [...m.html.replace(/<style[\s\S]*?<\/style>/g, '').matchAll(/href="(https?:[^"]+)"/g)].map((x) => x[1].replace(/&amp;/g, '&'));
    for (const h of hrefs) assert.ok(m.text.includes(h.replace(/&amp;/g, '&')) || m.text.includes(h), `text lacks link ${h.slice(0, 60)}`);
    // The commission disclosure still comes before the first partner link.
    const d = m.text.search(/commission/i), p = m.text.search(/https?:\/\/[^\s)]*(\/out\/|\/go\/|aviasales)/i);
    if (p >= 0) assert.ok(d >= 0 && d < p, 'disclosure before the first partner link in the text');
  });
}

test('a caller that writes its own text keeps it', async () => {
  sent.length = 0;
  await E.sendPlanConfirmEmail({ email: 'a@example.com', confirmUrl: 'https://sparkfare.com/api/plan-reminders/confirm?token=x', stopUrl: 'https://sparkfare.com/api/plan-reminders/stop?token=y' }, env);
  assert.match(sent[0].text, /^Click to confirm\./);
});
