import test from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest, reconcileBookings, sendDepartingSoonAlerts } from '../src/index.js';
import { sendAwayModeFollowUpEmail, sendBookingConfirmedEmail, sendDepartingSoonEmail } from '../src/email.js';

function makeDb() {
  const rows = [];
  const trips = [];
  return {
    rows,
    trips,
    prepare(statement) {
      const normalized = statement.trimStart();
      function makeQuery(params) {
        const query = {
            async run() {
              if (normalized.startsWith("UPDATE trips SET status = 'booked'")) {
                const trip = trips.find((t) => t.trip_id === params[1] && t.status === 'clicked');
                if (!trip) return { success: true, meta: { changes: 0 } };
                trip.status = 'booked';
                trip.price_eur = params[0];
                return { success: true, meta: { changes: 1 } };
              }
              if (normalized.startsWith('INSERT INTO users')) {
                rows.push({
                  id: params[0],
                  email: params[1],
                  verified_email: params[2],
                  origin_iata: params[3],
                  pet_owner: params[4],
                  trip_length: params[5],
                  subscription_tier: params[6],
                  partner_id: params[7] ?? null,
                  early_access: params[8] ?? 0,
                  referred_by: params[9] ?? null,
                  unsubscribed_at: null,
                });
                return { success: true };
              }

              if (normalized.startsWith('UPDATE users SET verified_email = 1')) {
                const row = rows.find((entry) => entry.email === params[0]);
                if (!row) return { success: false };
                row.verified_email = 1;
                return { success: true };
              }

              if (normalized.startsWith('UPDATE users SET unsubscribed_at')) {
                const row = rows.find((entry) => entry.email === params[0]);
                if (!row) return { success: false };
                row.unsubscribed_at = new Date().toISOString();
                return { success: true };
              }

              if (normalized.startsWith('UPDATE users SET early_access = 1 WHERE id = ?')) {
                const row = rows.find((entry) => entry.id === params[0]);
                if (!row) return { success: false };
                row.early_access = 1;
                return { success: true };
              }

              return { success: true };
            },
            async first() {
              if (
                normalized.startsWith('SELECT * FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, verified_email FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, verified_email, partner_id FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, verified_email, partner_id, early_access FROM users WHERE email = ?')
              ) {
                return rows.find((row) => row.email === params[0]) || null;
              }
              if (normalized.startsWith('SELECT email FROM users WHERE id = ?')) {
                return rows.find((row) => row.id === params[0]) || null;
              }
              if (normalized.startsWith('SELECT id FROM users WHERE id = ?')) {
                return rows.find((row) => row.id === params[0]) || null;
              }
              if (normalized.startsWith('SELECT trips.destination AS destination, users.email AS email')) {
                const trip = trips.find((t) => t.trip_id === params[0]);
                if (!trip) return null;
                const user = rows.find((r) => r.id === trip.user_id);
                return { destination: trip.destination, email: user?.email || null, partner_id: user?.partner_id || null };
              }
              return null;
            },
            async all() {
              if (normalized.startsWith("SELECT trip_id FROM trips WHERE status = 'clicked'")) {
                return { results: trips.filter((t) => t.status === 'clicked').map((t) => ({ trip_id: t.trip_id })) };
              }
              return { results: [] };
            },
        };
        return query;
      }
      return { bind: (...params) => makeQuery(params), ...makeQuery([]) };
    },
  };
}

// Mimics the Workers Static Assets binding well enough for loadJsonAsset()/`/api/deals` --
// `files` maps a bare filename (as loadJsonAsset requests it) to the JSON object it should return.
function makeAssets(files) {
  return {
    async fetch(request) {
      const filename = new URL(request.url).pathname.replace(/^\//, '');
      if (!(filename in files)) return new Response('Not found', { status: 404 });
      return new Response(JSON.stringify(files[filename]), { status: 200 });
    },
  };
}

test('signup endpoint validates origin and stores user data', async () => {
  const env = { DB: makeDb() };
  const request = new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_123',
      email: 'test@example.com',
      origin_iata: 'JFK',
      pet_owner: 0,
      trip_length: '7-10',
      subscription_tier: 'free',
    }),
  });

  const response = await handleRequest(request, env);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.email, 'test@example.com');
  assert.equal(body.user.origin_iata, 'JFK');
});

test('signup endpoint rejects invalid origin codes', async () => {
  const env = { DB: makeDb() };
  const request = new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_456',
      email: 'bad@example.com',
      origin_iata: 'JFKX',
      pet_owner: 0,
      trip_length: '7-10',
      subscription_tier: 'free',
    }),
  });

  const response = await handleRequest(request, env);
  assert.equal(response.status, 400);

  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /origin/i);
});

test('signup endpoint updates an existing alert instead of failing on duplicate email', async () => {
  const env = { DB: makeDb() };
  const first = {
    id: 'user_existing',
    email: 'repeat@example.com',
    origin_iata: 'JFK',
    pet_owner: 0,
    trip_length: '7-10',
    subscription_tier: 'free',
  };

  await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(first),
  }), env);

  const response = await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...first, id: 'local_retry', origin_iata: 'LAX' }),
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.id, 'user_existing');
});

test('signup endpoint stores partner_id on a new signup', async () => {
  const env = { DB: makeDb() };
  const response = await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_partner',
      email: 'partner@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
      partner_id: 'denver_guide',
    }),
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.partner_id, 'denver_guide');
  assert.equal(env.DB.rows.find((r) => r.email === 'partner@example.com').partner_id, 'denver_guide');
});

test('signup endpoint never overwrites an existing partner_id on resubmit (first-touch attribution)', async () => {
  const env = { DB: makeDb() };
  await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_firsttouch',
      email: 'firsttouch@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
      partner_id: 'austin_nomads',
    }),
  }), env);

  // A later resubmit with no partner_id (e.g. updating trip_length directly on the site) must
  // not erase which publisher originally referred this user.
  const response = await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'local_retry',
      email: 'firsttouch@example.com',
      origin_iata: 'LAX',
      trip_length: '11-14',
    }),
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.partner_id, 'austin_nomads');
});

test('signup endpoint bumps both the referrer and the new signup to early_access on a valid ref', async () => {
  const env = { DB: makeDb() };
  await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_referrer',
      email: 'referrer@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
    }),
  }), env);

  const response = await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_friend',
      email: 'friend@example.com',
      origin_iata: 'LAX',
      trip_length: '7-10',
      ref: 'user_referrer',
    }),
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.early_access, 1);
  assert.equal(env.DB.rows.find((r) => r.email === 'referrer@example.com').early_access, 1);
  assert.equal(env.DB.rows.find((r) => r.email === 'friend@example.com').referred_by, 'user_referrer');
});

test('signup endpoint ignores a self-referral', async () => {
  const env = { DB: makeDb() };
  const response = await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_self',
      email: 'self@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
      ref: 'user_self',
    }),
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.early_access, 0);
});

test('signup endpoint ignores an unrecognized ref without erroring the signup', async () => {
  const env = { DB: makeDb() };
  const response = await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_orphan',
      email: 'orphan@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
      ref: 'does_not_exist',
    }),
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.early_access, 0);
});

test('signup endpoint never grants early_access on a resubmit even with a ref present', async () => {
  const env = { DB: makeDb() };
  await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_referrer2',
      email: 'referrer2@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
    }),
  }), env);
  await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_existing2',
      email: 'existing2@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
    }),
  }), env);

  // A resubmit of an already-existing signup must not retroactively grant early access just
  // because a ref happens to be present -- referral credit only applies to a genuinely new signup.
  const response = await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'local_retry2',
      email: 'existing2@example.com',
      origin_iata: 'LAX',
      trip_length: '11-14',
      ref: 'user_referrer2',
    }),
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.early_access, 0);
  assert.equal(env.DB.rows.find((r) => r.email === 'referrer2@example.com').early_access, 0);
});

test('verify endpoint marks a user as verified', async () => {
  const env = { DB: makeDb() };
  const signupRequest = new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_789',
      email: 'verify@example.com',
      origin_iata: 'LAX',
      pet_owner: 1,
      trip_length: '11-14',
      subscription_tier: 'free',
    }),
  });

  await handleRequest(signupRequest, env);

  const verifyRequest = new Request('http://localhost/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'verify@example.com',
    }),
  });

  const response = await handleRequest(verifyRequest, env);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.verified_email, 1);
});

test('unsubscribe endpoint stops the user from receiving alerts', async () => {
  const env = { DB: makeDb() };
  const signupRequest = new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_101',
      email: 'unsubscribe@example.com',
      origin_iata: 'SEA',
      pet_owner: 0,
      trip_length: 'weekend',
      subscription_tier: 'free',
    }),
  });

  await handleRequest(signupRequest, env);

  const unsubscribeRequest = new Request('http://localhost/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'unsubscribe@example.com',
    }),
  });

  const response = await handleRequest(unsubscribeRequest, env);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.unsubscribed, true);
});

test('unsubscribe link stops daily emails with a GET request', async () => {
  const env = { DB: makeDb() };
  await handleRequest(new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_get_unsubscribe',
      email: 'get-unsubscribe@example.com',
      origin_iata: 'JFK',
      pet_owner: 0,
      trip_length: 'weekend',
      subscription_tier: 'free',
    }),
  }), env);

  const response = await handleRequest(new Request(
    'http://localhost/api/unsubscribe?email=get-unsubscribe%40example.com'
  ), env);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /unsubscribed/i);
});

test('account endpoint rejects unauthenticated requests', async () => {
  const request = new Request('http://localhost/api/account');
  const response = await handleRequest(request, { CLERK_SECRET_KEY: 'configured' });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /authenticated/i);
});

test('preferences endpoint rejects unauthenticated requests', async () => {
  const request = new Request('http://localhost/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin_iata: 'LAX', pet_owner: 0, trip_length: 'weekend' }),
  });

  const response = await handleRequest(request, { CLERK_SECRET_KEY: 'configured' });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /authenticated/i);
});

test('session endpoint reports an unconfigured Clerk environment', async () => {
  const response = await handleRequest(new Request('http://localhost/api/session'), {});

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.configured, false);
  assert.equal(body.authenticated, false);
});

test('verify endpoint completes with mocked email delivery when Resend is not configured', async () => {
  const response = await handleRequest(new Request('http://localhost/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'verify-with-mock@example.com' }),
  }), {});

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.verified_email, 1);
});

test('daily alert endpoint completes with mocked email delivery', async () => {
  const response = await handleRequest(new Request('http://localhost/api/send-daily-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'daily-with-mock@example.com',
      origin: 'JFK',
      deals: [{ display_name: 'Tokyo, Japan', price: 500, booking_link: 'https://example.com/book' }],
    }),
  }), {});

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sent, true);
  assert.equal(body.mocked, true);
});

test('away mode follow-up email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendAwayModeFollowUpEmail({
    email: 'away-mode@example.com',
    destination: 'Marrakech, Morocco',
    departure_at: '2027-02-02T10:30:00-05:00',
  }, {});

  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('booking-confirmed email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendBookingConfirmedEmail({
    email: 'booking-confirmed@example.com',
    destination: 'Marrakech, Morocco',
  }, {});

  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('departing-soon email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendDepartingSoonEmail({
    email: 'departing-soon@example.com',
    destination: 'Marrakech, Morocco',
    departure_at: '2026-10-04T15:32:00-04:00',
    daysUntil: 3,
  }, {});

  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('sendDepartingSoonAlerts reports DB not configured when no DB is bound', async () => {
  const result = await sendDepartingSoonAlerts({});

  assert.equal(result.sent, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.reason, 'DB not configured');
});

test('send-departing-soon-alerts endpoint completes when no DB is bound', async () => {
  const response = await handleRequest(new Request('http://localhost/api/send-departing-soon-alerts', {
    method: 'POST',
  }), {});

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sent, 0);
  assert.equal(body.reason, 'DB not configured');
});

test('booking reconciliation is mocked when TRAVELPAYOUTS_TOKEN is not configured', async () => {
  const result = await reconcileBookings({ DB: makeDb() });

  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('reconcile-bookings endpoint completes with mocked result when token is not configured', async () => {
  const response = await handleRequest(new Request('http://localhost/api/reconcile-bookings', {
    method: 'POST',
  }), { DB: makeDb() });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mocked, true);
});

test('reconcileBookings persists price_eur on a matched paid booking (Workplan Step 101)', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_1', email: 'traveler@example.com', partner_id: 'denver_guide' });
  db.trips.push({
    trip_id: 'trip_abc',
    user_id: 'user_1',
    destination: 'Lisbon, Portugal',
    status: 'clicked',
    price_eur: null,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    results: [{ sub_id: 'trip_abc', state: 'paid', date: '2026-09-01', price_eur: 214.5 }],
  }), { status: 200 });

  let result;
  try {
    result = await reconcileBookings({ DB: db, TRAVELPAYOUTS_TOKEN: 'test-token' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(result.matched, 1);
  assert.equal(result.updated, 1);

  const trip = db.trips.find((t) => t.trip_id === 'trip_abc');
  assert.equal(trip.status, 'booked');
  assert.equal(trip.price_eur, 214.5);
});

test('reconcileBookings leaves price_eur null when Travelpayouts omits it', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_2', email: 'other@example.com', partner_id: null });
  db.trips.push({
    trip_id: 'trip_xyz',
    user_id: 'user_2',
    destination: 'Bali, Indonesia',
    status: 'clicked',
    price_eur: null,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    results: [{ sub_id: 'trip_xyz', state: 'paid', date: '2026-09-01' }],
  }), { status: 200 });

  let result;
  try {
    result = await reconcileBookings({ DB: db, TRAVELPAYOUTS_TOKEN: 'test-token' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(result.updated, 1);
  const trip = db.trips.find((t) => t.trip_id === 'trip_xyz');
  assert.equal(trip.status, 'booked');
  assert.equal(trip.price_eur, null);
});

test('trip endpoint requires an authenticated Clerk session', async () => {
  const response = await handleRequest(new Request('http://localhost/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: 'Tokyo, Japan',
      origin_iata: 'JFK',
      departure_at: '2027-02-02T10:30:00-05:00',
      return_at: '2027-02-22T01:20:00+08:00',
      price_at_click: 810,
      booking_link: 'https://www.aviasales.com/search/JFK0202HND22021?marker=314524',
    }),
  }), { CLERK_SECRET_KEY: 'configured' });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /authenticated/i);
});

test('GET trips endpoint requires an authenticated Clerk session', async () => {
  const response = await handleRequest(new Request('http://localhost/api/trips'), { CLERK_SECRET_KEY: 'configured' });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /authenticated/i);
});

// Workplan Step 67 (free/paid serving-layer split). A real authenticated-paid-tier request isn't
// covered here -- same accepted boundary as /api/trips' authenticated-success path above: there's
// no existing pattern in this test file for mocking a real Clerk-verified session
// (getClerkSession() calls the real @clerk/backend verifyToken), so only the
// unauthenticated/free-tier branches, which don't need one, are exercised.
const SAMPLE_JFK_FEED = {
  generated_at: '2026-09-13T00:00:00Z',
  deals: [{ display_name: 'Lisbon, Portugal', origin: 'JFK', price: 400 }],
  featured: [],
  priced_no_deal: [],
  insufficient_history: [],
  no_data: [],
};
const SAMPLE_OTHER_ORIGINS_FEED = {
  generated_at: '2026-09-13T00:00:00Z',
  deals: [
    { display_name: 'Lisbon, Portugal', origin: 'LAX', price: 410 },
    { display_name: 'Bali, Indonesia', origin: 'ORD', price: 900 },
  ],
  featured: [],
  priced_no_deal: [],
  insufficient_history: [],
  no_data: [],
};

test('/api/deals rejects an unknown or missing origin', async () => {
  const response = await handleRequest(new Request('http://localhost/api/deals?origin=XXX'), {});
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.ok, false);
});

test('/api/deals serves the free-tier JFK feed for an unauthenticated request', async () => {
  const env = {
    ASSETS: makeAssets({ 'sparkfare_ranked_deals.json': SAMPLE_JFK_FEED }),
  };
  const response = await handleRequest(new Request('http://localhost/api/deals?origin=JFK'), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.tier, 'free');
  assert.equal(body.origin, 'JFK');
  assert.equal(body.deals.length, 1);
  assert.equal(body.deals[0].origin, 'JFK');
});

test('/api/deals serves the free-tier (24h-delayed) combined feed for a non-JFK origin, filtered to that origin', async () => {
  const env = {
    ASSETS: makeAssets({ 'sparkfare_ranked_deals_other_origins.json': SAMPLE_OTHER_ORIGINS_FEED }),
  };
  const response = await handleRequest(new Request('http://localhost/api/deals?origin=LAX'), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.tier, 'free');
  assert.equal(body.origin, 'LAX');
  assert.equal(body.deals.length, 1);
  assert.equal(body.deals[0].origin, 'LAX');
});

test('/api/deals never upgrades tier without a real authenticated session, even with DB configured', async () => {
  const env = {
    DB: makeDb(),
    ASSETS: makeAssets({ 'sparkfare_ranked_deals.json': SAMPLE_JFK_FEED }),
  };
  const response = await handleRequest(new Request('http://localhost/api/deals?origin=JFK'), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tier, 'free');
});

test('/api/deals returns 502 when the underlying data file is unavailable', async () => {
  const env = { ASSETS: makeAssets({}) };
  const response = await handleRequest(new Request('http://localhost/api/deals?origin=JFK'), env);

  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.ok, false);
});
