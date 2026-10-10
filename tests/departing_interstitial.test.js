import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {
  buildRouteLine, formatDateRange, freshnessText, sanitizeBookingTarget, interstitialHtml,
  DISCLOSURE_TEXT, FARE_CAVEAT, escapeHtml,
} from '../src/interstitial.js';

const TARGET = 'https://www.aviasales.com/search/X?marker=314524.trip-123';
const sample = {
  tripId: 'trip-123', destination: 'Cebu, Philippines', origin_iata: 'TLV',
  departure_at: '2026-11-12T08:00:00+02:00', return_at: '2026-11-26T20:00:00+08:00',
  price: 797, clickedAt: '2026-10-03 15:40:12', target: TARGET,
};

test('route line uses only available fields', () => {
  assert.equal(buildRouteLine(sample), 'From TLV · Nov 12 to 26 · round trip');
  assert.equal(buildRouteLine({ origin_iata: 'JFK', departure_at: '2026-11-12T08:00:00Z' }), 'From JFK · Nov 12 · one way');
  assert.equal(buildRouteLine({}), '');
  assert.equal(buildRouteLine({ origin_iata: 'LAX' }), 'From LAX');
});

test('date ranges across months and years', () => {
  assert.equal(formatDateRange('2026-11-28T10:00:00Z', '2026-12-03T10:00:00Z'), 'Nov 28 to Dec 3');
  assert.equal(formatDateRange('2026-12-28T10:00:00Z', '2027-01-04T10:00:00Z'), 'Dec 28, 2026 to Jan 4, 2027');
  assert.equal(formatDateRange('garbage', null), null);
});

test('freshness text carries the real timestamp and never says live or real-time', () => {
  assert.match(freshnessText('2026-10-03 15:40:12'), /Oct 3, 15:40 UTC/);
  assert.doesNotMatch(freshnessText('2026-10-03 15:40:12') + freshnessText(null), /live|real-time/i);
});

test('only https www.aviasales.com targets are accepted', () => {
  assert.equal(sanitizeBookingTarget(TARGET), TARGET);
  for (const bad of [null, '', 'javascript:alert(1)', 'https://evil.com/x', 'http://www.aviasales.com/x', 'https://www.aviasales.com.evil.com/x', 'not a url']) {
    assert.equal(sanitizeBookingTarget(bad), null, String(bad));
  }
});

test('page wording: honest price, no banned words, disclosure under the button and before the links', () => {
  const html = interstitialHtml(sample);
  assert.match(html, /From <strong>\$797<\/strong>/);
  assert.ok(html.includes(FARE_CAVEAT));
  assert.doesNotMatch(html, /locked|secured|guaranteed/i);
  assert.ok(!html.includes('Continue to flight booking'));
  assert.ok(html.includes('<h1>Check this fare</h1>'));
  const cta = html.indexOf('Continue to fare search');
  const note = html.indexOf('Aviasales shows live fares and handles booking and payment. Prices can differ from the fare shown here.');
  const disc = html.indexOf(escapeHtml(DISCLOSURE_TEXT));
  assert.ok(cta > 0 && cta < note && note < disc && disc < html.indexOf('/out/safetywing'));
  assert.ok(DISCLOSURE_TEXT.startsWith('Sponsored link:') && DISCLOSURE_TEXT.includes("Sparkfare doesn't sell or book travel."));
  assert.ok(html.indexOf('Round out your trip') > cta);
  assert.ok(!html.includes('Away Mode'));
  assert.ok(!html.includes('setTimeout(function () { window.location.replace'));
});

test('flight button goes through /out/aviasales with the trip id; service links tagged; rel and target set', () => {
  const html = interstitialHtml(sample);
  assert.ok(html.includes('href="/out/aviasales?trip_id=trip-123&amp;url=' + encodeURIComponent(TARGET).replace(/&/g, '&amp;') + '"'));
  for (const slug of ['safetywing', 'airhelp', 'yesim', 'wise', 'qeeq', 'welcome-pickups']) {
    assert.ok(html.includes(`href="/out/${slug}?trip_id=trip-123"`), slug);
  }
  const anchors = html.match(/<a [^>]*target="_blank"[^>]*>/g);
  assert.ok(anchors.length >= 7);
  for (const a of anchors.filter((x) => x.includes('/out/'))) assert.match(a, /rel="sponsored nofollow noopener noreferrer"/);
});

test('hotel row is inert: not a link, aria-disabled, "coming soon"', () => {
  const html = interstitialHtml(sample);
  const row = html.match(/<li class="svc inert"[^>]*>.*?<\/li>/s)[0];
  assert.match(row, /aria-disabled="true"/);
  assert.match(row, /Hotels: coming soon/);
  assert.ok(!row.includes('<a '));
});

test('close control is a labelled button and Escape closes', () => {
  const html = interstitialHtml(sample);
  assert.match(html, /<button type="button" class="close" id="close" aria-label="Close">/);
  assert.match(html, /e\.key === 'Escape'/);
});

test('missing or invalid target never produces an outbound link to it', () => {
  for (const target of [null, 'https://evil.com/x', 'javascript:alert(1)']) {
    const html = interstitialHtml({ ...sample, target });
    assert.ok(!html.includes('evil.com') && !html.includes('javascript:alert'));
    assert.match(html, /Return to Sparkfare/);
  }
});

test('no price: caveat still shown, no price line', () => {
  const html = interstitialHtml({ ...sample, price: null });
  assert.doesNotMatch(html, /From <strong>/);
  assert.ok(html.includes(FARE_CAVEAT));
});

test('destination is HTML-escaped', () => {
  assert.ok(!interstitialHtml({ ...sample, destination: '<script>x</script>' }).includes('<script>x</script>'));
});

test('/departing renders through the worker; /out/aviasales redirects only to Aviasales', async () => {
  const res = await worker.fetch(new Request('https://sparkfare.com/departing/trip-123?url=' + encodeURIComponent(TARGET)), {}, { waitUntil() {} });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Continue to fare search/);

  const ok = await worker.fetch(new Request('https://sparkfare.com/out/aviasales?trip_id=trip-123&url=' + encodeURIComponent(TARGET), { redirect: 'manual' }), {}, { waitUntil() {} });
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get('location'), TARGET);

  const bad = await worker.fetch(new Request('https://sparkfare.com/out/aviasales?url=' + encodeURIComponent('https://evil.com/'), { redirect: 'manual' }), {}, { waitUntil() {} });
  assert.equal(bad.status, 400);
});
