import test from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest, reconcileBookings } from '../src/index.js';
import { sendAwayModeFollowUpEmail } from '../src/email.js';

function makeDb() {
  const rows = [];
  return {
    rows,
    prepare(statement) {
      return {
        bind(...params) {
          const normalized = statement.trimStart();
          const query = {
            async run() {
              if (normalized.startsWith('INSERT INTO users')) {
                rows.push({
                  id: params[0],
                  email: params[1],
                  verified_email: params[2],
                  origin_iata: params[3],
                  pet_owner: params[4],
                  trip_length: params[5],
                  subscription_tier: params[6],
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

              return { success: true };
            },
            async first() {
              if (
                normalized.startsWith('SELECT * FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, verified_email FROM users WHERE email = ?')
              ) {
                return rows.find((row) => row.email === params[0]) || null;
              }
              if (normalized.startsWith('SELECT email FROM users WHERE id = ?')) {
                return rows.find((row) => row.id === params[0]) || null;
              }
              return null;
            },
          };
          return query;
        },
      };
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
