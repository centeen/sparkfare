// Category-limited placement (Design Council D-013, Addendum C). A pet_care partner may appear on Away Mode and
// nowhere else: not on route pages next to fare results, not in the generic Away Mode emails. Every other category
// keeps every surface, so nothing changes for the partners that are live today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';
import { getAwayModePartners, AWAY_MODE_PARTNERS, sendAwayModeFollowUpEmail, sendBookingConfirmedEmail, sendDepartingSoonEmail } from '../src/email.js';
import { PLACEMENT_BY_CATEGORY, PARTNER_SURFACES, partnersForSurface, partnerAllowedOnSurface, PARTNER_REGISTRY } from '../src/meters.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LIVE_PET = { slug: 'petcube', name: 'Petcube', category: 'Pet Care', link: 'https://example.invalid/petcube', blurb: 'Check in on a pet you leave at home.' };

function envWith(rows, extra = {}) {
  return {
    ...extra,
    DB: {
      prepare: () => ({
        all: async () => ({ results: rows }),
        bind: () => ({ first: async () => null, run: async () => ({ success: true }), all: async () => ({ results: [] }) }),
        run: async () => ({ success: true }),
        first: async () => null,
      }),
    },
  };
}

test('pet_care is limited to away_mode, and nothing else in the registry has a limit', () => {
  assert.deepEqual(PLACEMENT_BY_CATEGORY, { pet_care: ['away_mode'] });
  assert.deepEqual(PARTNER_SURFACES, ['away_mode', 'email', 'route_page']);
});

test('no regression: every current partner is allowed on every surface', () => {
  for (const p of AWAY_MODE_PARTNERS) {
    for (const surface of PARTNER_SURFACES) {
      assert.equal(partnerAllowedOnSurface(p, surface), true, `${p.slug} on ${surface}`);
    }
  }
  for (const surface of PARTNER_SURFACES) {
    assert.deepEqual(partnersForSurface(AWAY_MODE_PARTNERS, surface).map((p) => p.slug), AWAY_MODE_PARTNERS.map((p) => p.slug));
  }
});

test('petcube is allowed on away_mode only; an unlisted or unknown category is allowed everywhere', () => {
  assert.equal(PARTNER_REGISTRY.petcube.category_slug, 'pet_care');
  assert.equal(partnerAllowedOnSurface({ slug: 'petcube' }, 'away_mode'), true);
  assert.equal(partnerAllowedOnSurface({ slug: 'petcube' }, 'route_page'), false);
  assert.equal(partnerAllowedOnSurface({ slug: 'petcube' }, 'email'), false);
  assert.equal(partnerAllowedOnSurface({ slug: 'not-in-registry' }, 'route_page'), true);
  assert.equal(partnerAllowedOnSurface({ slug: 'x', category_slug: 'pet_care' }, 'email'), false, 'an explicit category_slug on the row is honoured');
});

test('getAwayModePartners: surface filters, no surface returns everything', async () => {
  const env = envWith([{ slug: 'bounce', name: 'Bounce', category: 'Luggage', link: 'https://x', blurb: 'b' }, LIVE_PET]);
  assert.deepEqual((await getAwayModePartners(env)).map((p) => p.slug), ['bounce', 'petcube']);
  assert.deepEqual((await getAwayModePartners(env, { surface: 'away_mode' })).map((p) => p.slug), ['bounce', 'petcube']);
  assert.deepEqual((await getAwayModePartners(env, { surface: 'email' })).map((p) => p.slug), ['bounce']);
  assert.deepEqual((await getAwayModePartners(env, { surface: 'route_page' })).map((p) => p.slug), ['bounce']);
});

async function captureEmail(fn, args, env) {
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
    await fn(args, { RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com', ...env });
  } finally { globalThis.fetch = original; }
  return sent;
}

const TRIP = { email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-12-01T10:00:00Z', return_at: '2026-12-08T10:00:00Z', origin_iata: 'JFK', price_at_click: 400, booking_link: 'https://www.aviasales.com/x', trip_id: 't1', trip_length: '7-10', passenger_count: 1 };

for (const [name, fn, args] of [
  ['the click-triggered follow-up email', sendAwayModeFollowUpEmail, TRIP],
  ['the booking-confirmed email', sendBookingConfirmedEmail, TRIP],
  ['the departing-soon email', sendDepartingSoonEmail, { ...TRIP, daysUntil: 3 }],
]) {
  test(`${name} never lists a live pet_care partner`, async () => {
    const rows = [{ slug: 'bounce', name: 'Bounce', category: 'Luggage', link: 'https://go.bounce.com/x', blurb: 'Luggage storage.' }, LIVE_PET];
    const sent = await captureEmail(fn, args, envWith(rows));
    assert.ok(sent, 'an email was sent');
    assert.doesNotMatch(sent.html, /petcube/i);
    assert.match(sent.html, /\/out\/bounce/, 'the other live partner is still listed');
  });
}

test('a route page never lists a live pet_care partner but lists the others', async () => {
  const obs = Array(15).fill(0).map((_, i) => ({ price: 350 + (14 - i) * 5, date: new Date(Date.now() - (14 - i) * 864e5).toISOString() }));
  const env = {
    ASSETS: { fetch: async (req) => (req.url.includes('sparkfare_ranked_deals')
      ? { ok: true, json: async () => ({ deals: [{ origin: 'JFK', display_name: 'CDG', price: 350, observations: obs }] }) }
      : { ok: true, json: async () => ({ deals: [] }) }) },
    ...envWith([{ slug: 'bounce', name: 'Bounce', category: 'Storage', link: 'https://x', blurb: 'b' }, LIVE_PET]),
  };
  const res = await worker.fetch(new Request('https://sparkfare.com/flight/JFK/CDG'), env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Bounce/);
  assert.doesNotMatch(html, /petcube/i);
});

test('/api/partners (the Away Mode list) still includes a live pet_care partner', async () => {
  const env = envWith([{ slug: 'bounce', name: 'Bounce', category: 'Luggage', link: 'https://x', blurb: 'b' }, LIVE_PET]);
  const res = await worker.fetch(new Request('https://sparkfare.com/api/partners'), env, { waitUntil: () => {} });
  const body = await res.json();
  assert.deepEqual(body.partners.map((p) => p.slug), ['bounce', 'petcube']);
});

test('source guard: the route page and every full-list Away Mode email ask for their surface', () => {
  const idx = read('src/index.js');
  const i = idx.indexOf('const partnersHtml = activePartners.map');
  assert.ok(i > 0);
  const before = idx.slice(Math.max(0, i - 400), i);
  assert.match(before, /getAwayModePartners\(env, \{ surface: 'route_page' \}\)/);

  const email = read('src/email.js');
  for (const fnName of ['sendAwayModeFollowUpEmail', 'sendStressValveEmail', 'sendDepartureBriefingEmail', 'sendBookingConfirmedEmail', 'sendDepartingSoonEmail', 'sendPreDepartureSequenceEmail']) {
    const start = email.indexOf(`export async function ${fnName}`);
    assert.ok(start > 0, `${fnName} exists`);
    const next = email.indexOf('\nexport ', start + 10);
    const body = email.slice(start, next > 0 ? next : undefined);
    assert.match(body, /getAwayModePartners\(env, \{ surface: 'email' \}\)/, `${fnName} must filter by surface`);
  }
});
