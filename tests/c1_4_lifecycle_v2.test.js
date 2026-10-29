// C1.4: one v2 anatomy for the lifecycle emails. Resend stubbed at the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadSlugFor, pickLifecyclePartner, lifecycleV2Enabled } from '../src/lifecycleV2.js';
import { prioritizePartners, sendDepartingSoonEmail, sendDepartureBriefingEmail, sendStressValveEmail, sendBookingConfirmedEmail, sendPreDepartureSequenceEmail, sendTripStreamEmail, sendRouteRetrospectiveEmail, AFFILIATE_DISCLOSURE_TEXT } from '../src/email.js';

const P = (slug) => ({ slug, name: slug.toUpperCase(), blurb: 'b', link: 'https://x.example/' + slug });
const ALL = ['us-global-mail', 'yesim', 'bounce', 'airhelp', 'nordvpn'].map(P);

test('flag: exact string only', () => {
  assert.equal(lifecycleV2Enabled({ ENABLE_LIFECYCLE_V2: 'true' }), true);
  assert.equal(lifecycleV2Enabled({ ENABLE_LIFECYCLE_V2: 'yes' }), false);
  assert.equal(lifecycleV2Enabled({}), false);
});

test('partner choice: night before is bags, last week is phone and data, group is delay cover, long trip is mail', () => {
  assert.equal(leadSlugFor({ daysUntil: 1 }), 'bounce');
  assert.equal(leadSlugFor({ daysUntil: 7, tripLength: '7-10' }), 'yesim');
  assert.equal(leadSlugFor({ daysUntil: 7, tripLength: 'weekend' }), 'bounce');
  assert.equal(leadSlugFor({ daysUntil: 21, passengerCount: 4 }), 'airhelp');
  assert.equal(leadSlugFor({ daysUntil: 30, tripLength: '30_plus', passengerCount: 1 }), 'us-global-mail');
  assert.equal(leadSlugFor({ daysUntil: 21, tripLength: '7-10', passengerCount: 1 }), null);
});

test('always at most one partner; falls back to the first available; empty stays empty', () => {
  assert.equal(pickLifecyclePartner(ALL, { daysUntil: 1 }).length, 1);
  assert.equal(pickLifecyclePartner(ALL, { daysUntil: 1 })[0].slug, 'bounce');
  assert.equal(pickLifecyclePartner([P('nordvpn')], { daysUntil: 1 })[0].slug, 'nordvpn');
  assert.deepEqual(pickLifecyclePartner([], { daysUntil: 1 }), []);
});

test('prioritizePartners without a context is unchanged (full list); with a context returns one', () => {
  assert.equal(prioritizePartners(ALL, '30_plus').length, 5);
  assert.equal(prioritizePartners(ALL, '30_plus')[0].slug, 'us-global-mail');
  assert.equal(prioritizePartners(ALL, '30_plus', { daysUntil: 30 }).length, 1);
});

async function capture(fn) {
  const real = globalThis.fetch; const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'e1' }), { status: 200, headers: { 'content-type': 'application/json' } }); }
    return real(url, init);
  };
  try { await fn(); } finally { globalThis.fetch = real; }
  return sent;
}
const base = { RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com', UNSUBSCRIBE_SECRET: 's' };
const dep = new Date(Date.now() + 5 * 86400000).toISOString();
const args = { email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: dep, daysUntil: 1, trip_id: 't1', trip_length: '7-10', passenger_count: 1 };
const emails = [
  ['departing_soon', (e) => sendDepartingSoonEmail(args, e)],
  ['briefing', (e) => sendDepartureBriefingEmail(args, e)],
  ['stress_valve', (e) => sendStressValveEmail(args, e)],
  ['purchase_reported', (e) => sendBookingConfirmedEmail(args, e)],
  ['prep', (e) => sendPreDepartureSequenceEmail(args, e)],
  ['trip_stream', (e) => sendTripStreamEmail({ ...args, stage: 'd21', position: 0, daysUntil: 21 }, e)],
];

for (const [kind, send] of emails) {
  test(`${kind}: v2 has a preheader, one button, and no more than one partner link, with the disclosure above it`, async () => {
    const [m] = await capture(() => send({ ...base, ENABLE_LIFECYCLE_V2: 'true' }));
    assert.ok(m, 'sent');
    const html = m.html;
    assert.match(html, /display:none;max-height:0/);
    assert.equal((html.match(/font-size:16px;font-weight:700/g) || []).length, 1, 'one button');
    const partnerLinks = (html.match(/\/(out|go)\/[a-z-]+/g) || []);
    assert.ok(partnerLinks.length <= 1, 'at most one partner: ' + partnerLinks);
    if (partnerLinks.length) assert.ok(html.indexOf(AFFILIATE_DISCLOSURE_TEXT) < html.indexOf(partnerLinks[0]), 'disclosure first');
  });
  test(`${kind}: flag off keeps the old body (no preheader div)`, async () => {
    const [m] = await capture(() => send({ ...base, ENABLE_LIFECYCLE_V2: 'false' }));
    assert.ok(m);
    assert.doesNotMatch(m.html, /display:none;max-height:0/);
  });
}

test('retrospective is unchanged by the flag (it has no partner and no button to standardise)', async () => {
  const a = { email: 'a@example.com', origin: 'JFK', destination: 'Lisbon', lockedPrice: 500, currentMedian: 600, pctDiff: 0.1 };
  const [off] = await capture(() => sendRouteRetrospectiveEmail(a, { ...base, ENABLE_LIFECYCLE_V2: 'false' }));
  const [on] = await capture(() => sendRouteRetrospectiveEmail(a, { ...base, ENABLE_LIFECYCLE_V2: 'true' }));
  assert.equal(on.html, off.html);
});
