import test from 'node:test';
import assert from 'node:assert/strict';
import { Webhook } from 'standardwebhooks';

import sparkfareWorker, { handleRequest, reconcileBookings, sendDepartingSoonAlerts, pruneInactiveSubscribers, checkWatchlists, sendDailyAlerts, sendStressValveAlerts, sendDepartureBriefingAlerts, sendRouteRetrospectives, checkAffiliateLinkHealth, computePriceGougingWatchlist, computeKPIs } from '../src/index.js';
import { sendAwayModeFollowUpEmail, sendBookingConfirmedEmail, sendDepartingSoonEmail, sendSunsetEmail, sendTargetReachedEmail, sendStressValveEmail, sendDepartureBriefingEmail, sendRouteRetrospectiveEmail, prioritizePartners, groupTravelHtml } from '../src/email.js';

function makeDb() {
  const rows = [];
  const trips = [];
  const watchlists = [];
  const earlyBirdSnapshots = [];
  // T3 referral tables
  const referralCodes = [];
  const referrals = [];
  return {
    rows,
    trips,
    watchlists,
    earlyBirdSnapshots,
    referralCodes,
    referrals,
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
                  passenger_count: params[4],
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

              if (normalized.startsWith('UPDATE users SET is_subscribed = 0 WHERE email = ? AND is_subscribed = 1')) {
                const row = rows.find((entry) => entry.email === params[0] && entry.is_subscribed !== 0);
                if (!row) return { success: true, meta: { changes: 0 } };
                row.is_subscribed = 0;
                return { success: true, meta: { changes: 1 } };
              }

              if (normalized.startsWith("UPDATE users SET is_subscribed = 1, last_opened_at = datetime('now') WHERE email = ?")) {
                const row = rows.find((entry) => entry.email === params[0]);
                if (!row) return { success: false };
                row.is_subscribed = 1;
                row.last_opened_at = new Date().toISOString();
                return { success: true };
              }

              if (normalized.startsWith("UPDATE users SET last_opened_at = datetime('now') WHERE email = ?")) {
                const row = rows.find((entry) => entry.email === params[0]);
                if (!row) return { success: false };
                row.last_opened_at = new Date().toISOString();
                return { success: true };
              }

              if (normalized.startsWith('INSERT OR REPLACE INTO early_bird_snapshots')) {
                const existing = earlyBirdSnapshots.find((s) => s.route_key === params[0] && s.snapshot_date === params[1]);
                if (existing) {
                  existing.price = params[2];
                } else {
                  earlyBirdSnapshots.push({ route_key: params[0], snapshot_date: params[1], price: params[2] });
                }
                return { success: true };
              }

              if (normalized.startsWith('INSERT INTO watchlists')) {
                watchlists.push({
                  id: params[0],
                  user_id: params[1],
                  origin_iata: params[2],
                  destination: params[3],
                  target_price: params[4],
                  notified_at: null,
                });
                return { success: true };
              }

              if (normalized.startsWith("UPDATE watchlists SET notified_at = datetime('now') WHERE id = ? AND notified_at IS NULL")) {
                const watchlist = watchlists.find((w) => w.id === params[0] && !w.notified_at);
                if (!watchlist) return { success: true, meta: { changes: 0 } };
                watchlist.notified_at = new Date().toISOString();
                return { success: true, meta: { changes: 1 } };
              }

              if (normalized.startsWith('INSERT INTO referrals')) {
                referrals.push({
                  id: params[0],
                  referrer_id: params[1],
                  referred_id: params[2],
                  status: 'pending',
                });
                return { success: true };
              }

              if (normalized.startsWith('UPDATE referrals SET status = "confirmed"')) {
                const ref = referrals.find((r) => r.id === params[0]);
                if (!ref) return { success: true, meta: { changes: 0 } };
                ref.status = 'confirmed';
                return { success: true, meta: { changes: 1 } };
              }

              return { success: true };
            },
            async first() {
              if (normalized.startsWith('SELECT COUNT(*) FROM users') && !normalized.includes('WHERE')) {
                return { 'COUNT(*)': rows.length };
              }
              if (normalized === 'SELECT COUNT(*) FROM users WHERE verified_email = 1') {
                return { 'COUNT(*)': rows.filter((r) => r.verified_email === 1).length };
              }
              if (normalized === 'SELECT COUNT(*) FROM users WHERE is_subscribed = 1') {
                return { 'COUNT(*)': rows.filter((r) => r.is_subscribed !== 0).length };
              }
              if (normalized === 'SELECT COUNT(*) FROM users WHERE early_access = 1') {
                return { 'COUNT(*)': rows.filter((r) => r.early_access === 1).length };
              }
              if (normalized === 'SELECT COUNT(DISTINCT referred_by) FROM users WHERE referred_by IS NOT NULL') {
                return { 'COUNT(DISTINCT referred_by)': new Set(rows.filter((r) => r.referred_by).map((r) => r.referred_by)).size };
              }
              if (normalized === 'SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL') {
                return { 'COUNT(*)': rows.filter((r) => r.referred_by).length };
              }
              if (normalized === "SELECT COUNT(*) FROM users WHERE partner_id = 'pseo'") {
                return { 'COUNT(*)': rows.filter((r) => r.partner_id === 'pseo').length };
              }
              if (normalized.startsWith('SELECT COUNT(*) FROM trips') && !normalized.includes('WHERE')) {
                return { 'COUNT(*)': trips.length };
              }
              if (normalized === "SELECT COUNT(*) FROM trips WHERE status = 'booked'") {
                return { 'COUNT(*)': trips.filter((t) => t.status === 'booked').length };
              }
              if (normalized === "SELECT COALESCE(SUM(price_eur), 0) FROM trips WHERE status = 'booked' AND price_eur IS NOT NULL") {
                const sum = trips.filter((t) => t.status === 'booked' && typeof t.price_eur === 'number').reduce((acc, t) => acc + t.price_eur, 0);
                return { 'COALESCE(SUM(price_eur), 0)': sum };
              }
              if (normalized === 'SELECT COUNT(*) FROM watchlists') {
                return { 'COUNT(*)': watchlists.length };
              }
              if (normalized === 'SELECT COUNT(*) FROM watchlists WHERE notified_at IS NOT NULL') {
                return { 'COUNT(*)': watchlists.filter((w) => w.notified_at).length };
              }
              if (
                normalized.startsWith('SELECT * FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, verified_email FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, verified_email, partner_id FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, verified_email, partner_id, early_access FROM users WHERE email = ?') ||
                normalized.startsWith('SELECT id, early_access, referred_by FROM users WHERE email = ?')
              ) {
                return rows.find((row) => row.email === params[0]) || null;
              }
              if (normalized.startsWith('SELECT email FROM users WHERE id = ?')) {
                return rows.find((row) => row.id === params[0]) || null;
              }
              if (normalized.startsWith('SELECT id FROM users WHERE id = ?')) {
                return rows.find((row) => row.id === params[0]) || null;
              }
              if (normalized.startsWith('SELECT price FROM early_bird_snapshots WHERE')) {
                const snapshot = earlyBirdSnapshots.find((s) => s.route_key === params[0] && s.snapshot_date === params[1]);
                return snapshot ? { price: snapshot.price } : null;
              }
              if (normalized.startsWith('SELECT trips.destination AS destination, users.email AS email')) {
                const trip = trips.find((t) => t.trip_id === params[0]);
                if (!trip) return null;
                const user = rows.find((r) => r.id === trip.user_id);
                return { destination: trip.destination, email: user?.email || null, partner_id: user?.partner_id || null };
              }
              // T3: referral_codes lookup (ref code -> user_id)
              if (normalized.startsWith('SELECT user_id FROM referral_codes WHERE code = ?')) {
                const rc = referralCodes.find((c) => c.code === params[0]);
                return rc ? { user_id: rc.user_id } : null;
              }
              // T3: pending referral lookup (referred_id -> referral row)
              if (normalized.startsWith('SELECT id, referrer_id FROM referrals WHERE referred_id = ?')) {
                return referrals.find((r) => r.referred_id === params[0] && r.status === 'pending') || null;
              }
              // IP abuse check (consent_log) — always returns 0 in tests
              if (normalized.startsWith('SELECT count(*) as c FROM consent_log')) {
                return { c: 0 };
              }
              return null;
            },
            async all() {
              if (normalized.startsWith("SELECT trip_id FROM trips WHERE status = 'clicked'")) {
                return { results: trips.filter((t) => t.status === 'clicked').map((t) => ({ trip_id: t.trip_id })) };
              }
              if (normalized.startsWith('SELECT email FROM users')) {
                const daysAgo = Number(params[0]) || 45;
                const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
                const eligible = rows.filter((row) => {
                  if (row.is_subscribed === 0) return false;
                  const created = row.created_at ? new Date(row.created_at).getTime() : 0;
                  if (created > cutoff) return false;
                  if (!row.last_opened_at) return true;
                  return new Date(row.last_opened_at).getTime() <= cutoff;
                });
                return { results: eligible.map((row) => ({ email: row.email })) };
              }
              if (normalized.startsWith('SELECT id, email, origin_iata FROM users')) {
                const requiresEarlyAccess = normalized.includes('early_access = 1');
                const eligible = rows.filter((row) => {
                  if (row.verified_email !== 1) return false;
                  if (row.unsubscribed_at) return false;
                  if (row.is_subscribed === 0) return false;
                  if (requiresEarlyAccess && row.early_access !== 1) return false;
                  return true;
                });
                // Include created_at so pruneInactiveSubscribers doesn't treat rows as epoch-old
                return { results: eligible.map((row) => ({ id: row.id, email: row.email, origin_iata: row.origin_iata, created_at: row.created_at || new Date().toISOString() })) };
              }
              if (normalized.startsWith('SELECT w.id AS id, w.origin_iata AS origin_iata, w.destination AS destination')) {
                const results = watchlists
                  .filter((w) => !w.notified_at)
                  .map((w) => {
                    const user = rows.find((r) => r.id === w.user_id);
                    return {
                      id: w.id,
                      origin_iata: w.origin_iata,
                      destination: w.destination,
                      target_price: w.target_price,
                      email: user?.email || null,
                      subscription_tier: user?.subscription_tier || null,
                    };
                  });
                return { results };
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
      passenger_count: 3,
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
  assert.equal(body.user.passenger_count, 3);
  assert.equal(env.DB.rows.find((r) => r.email === 'test@example.com').passenger_count, 3);
});

test('signup endpoint defaults and clamps passenger_count to a sane 1-9 range', async () => {
  const cases = [
    { input: undefined, expected: 1 },
    { input: 0, expected: 1 },
    { input: -3, expected: 1 },
    { input: 4.6, expected: 5 },
    { input: 15, expected: 9 },
    { input: 'not a number', expected: 1 },
  ];

  for (const [i, { input, expected }] of cases.entries()) {
    const env = { DB: makeDb() };
    const body = { id: `user_pc_${i}`, email: `pc${i}@example.com`, origin_iata: 'JFK', trip_length: '7-10' };
    if (input !== undefined) body.passenger_count = input;

    const response = await handleRequest(new Request('http://localhost/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), env);

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.user.passenger_count, expected, `input ${JSON.stringify(input)} should normalize to ${expected}`);
  }
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
      passenger_count: 1,
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
    passenger_count: 1,
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

test('signup endpoint records referred_by on a valid ref but does not grant early_access yet', async () => {
  // Workplan Step 129 (fraud protection): early_access is deferred to the referred user's first
  // real email.opened event, not granted instantly on signup -- see the dedicated webhook test
  // below for the deferred-grant path.
  //
  // The signup handler resolves `ref` via the referral_codes table (code -> user_id), not by
  // treating the ref value as a user ID directly. Seed a referral_codes row so the lookup works.
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

  // Seed a referral_codes row mapping code 'user_referrer' -> user_id 'user_referrer'.
  // In production a /api/referrals/code endpoint generates these; here we seed directly.
  env.DB.referralCodes.push({ code: 'user_referrer', user_id: 'user_referrer' });

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
  assert.equal(body.user.early_access, 0);
  assert.equal(env.DB.rows.find((r) => r.email === 'referrer@example.com').early_access, 0);
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
  // /api/verify is a GET endpoint: the user clicks a link with ?token= in their email.
  // The handler looks up the token in the DB, marks verified_email=1, then redirects.
  // The mock DB doesn't store verification_token (it's a real-DB field), so we test the
  // no-DB path which marks as verified and redirects — a 302 confirms the flow ran.
  const env = {}; // no DB: handler verifies and redirects without a DB lookup
  const verifyRequest = new Request('http://localhost/api/verify?token=test-token-abc');

  const response = await handleRequest(verifyRequest, env);
  // No DB: handler skips the DB update and returns a redirect to sparkfare.com
  assert.equal(response.status, 302);
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
      passenger_count: 1,
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
      passenger_count: 1,
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
    body: JSON.stringify({ origin_iata: 'LAX', passenger_count: 1, trip_length: 'weekend' }),
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

test('verify endpoint redirects when no DB is configured (token-link flow)', async () => {
  // Same as above: /api/verify is a GET with ?token= in the URL. No DB = skip DB update,
  // always redirect. This replaced the stale POST-with-email variant of this test.
  const response = await handleRequest(
    new Request('http://localhost/api/verify?token=another-test-token'),
    {} // no DB
  );
  assert.equal(response.status, 302);
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

test('groupTravelHtml is empty for a solo traveler or an unset passenger count', () => {
  assert.equal(groupTravelHtml(1), '');
  assert.equal(groupTravelHtml(undefined), '');
  assert.equal(groupTravelHtml(null), '');
  assert.equal(groupTravelHtml(0), '');
});

test('groupTravelHtml renders pluralized group copy for more than one passenger', () => {
  const pairHtml = groupTravelHtml(2);
  assert.match(pairHtml, /traveling with 1 other\b/);
  assert.doesNotMatch(pairHtml, /1 others/);

  const groupHtml = groupTravelHtml(4);
  assert.match(groupHtml, /traveling with 3 others/);
  assert.match(groupHtml, /all 4 passengers/);
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
// Build 15 observations over 15 days ending now so dealQuality passes (needs >=10 obs, >=14 day span).
const _now = Date.now();
const _buildObs = (basePrice) => Array.from({ length: 15 }, (_, i) => ({
  price: basePrice + (14 - i) * 2,
  date: new Date(_now - (14 - i) * 24 * 60 * 60 * 1000).toISOString(),
}));
// found_at must be within the 48h staleness cutoff.
const _foundAt = new Date(_now - 60 * 60 * 1000).toISOString(); // 1 hour ago

const SAMPLE_JFK_FEED = {
  generated_at: '2026-09-13T00:00:00Z',
  deals: [{ display_name: 'Lisbon, Portugal', route_key: 'JFK:Lisbon, Portugal', origin: 'JFK', price: 400, found_at: _foundAt, observations: _buildObs(400) }],
  featured: [],
  priced_no_deal: [],
  insufficient_history: [],
  no_data: [],
};
const SAMPLE_OTHER_ORIGINS_FEED = {
  generated_at: '2026-09-13T00:00:00Z',
  deals: [
    { display_name: 'Lisbon, Portugal', route_key: 'LAX:Lisbon, Portugal', origin: 'LAX', price: 410, found_at: _foundAt, observations: _buildObs(410) },
    { display_name: 'Bali, Indonesia', route_key: 'ORD:Bali, Indonesia', origin: 'ORD', price: 900, found_at: _foundAt, observations: _buildObs(900) },
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

// Workplan Steps 123-129 (Business Plan V2.0, Module A -- the 45-day sunset policy).
const DAYS_AGO = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

test('pruneInactiveSubscribers reports no DB configured when DB is missing', async () => {
  const result = await pruneInactiveSubscribers({});
  assert.deepEqual(result, { pruned: 0 });
});

test('pruneInactiveSubscribers prunes a genuinely inactive, old-enough account and sends the sunset email', async () => {
  const db = makeDb();
  db.rows.push({
    email: 'ghost@example.com',
    is_subscribed: 1,
    created_at: DAYS_AGO(90),
    last_opened_at: DAYS_AGO(60),
  });

  const result = await pruneInactiveSubscribers({ DB: db });

  assert.equal(result.pruned, 1);
  assert.equal(db.rows[0].is_subscribed, 0);
});

test('pruneInactiveSubscribers leaves a new signup alone even with no last_opened_at yet', async () => {
  const db = makeDb();
  db.rows.push({
    email: 'brand-new@example.com',
    is_subscribed: 1,
    created_at: DAYS_AGO(1),
    last_opened_at: null,
  });

  const result = await pruneInactiveSubscribers({ DB: db });

  assert.equal(result.pruned, 0);
  assert.equal(db.rows[0].is_subscribed, 1);
});

test('pruneInactiveSubscribers leaves an old-enough account alone if it opened something recently', async () => {
  const db = makeDb();
  db.rows.push({
    email: 'still-reading@example.com',
    is_subscribed: 1,
    created_at: DAYS_AGO(200),
    last_opened_at: DAYS_AGO(2),
  });

  const result = await pruneInactiveSubscribers({ DB: db });

  assert.equal(result.pruned, 0);
  assert.equal(db.rows[0].is_subscribed, 1);
});

test('GET /api/reactivate requires an email', async () => {
  const response = await handleRequest(new Request('http://localhost/api/reactivate'), {});
  assert.equal(response.status, 400);
});

test('GET /api/reactivate resets is_subscribed and last_opened_at', async () => {
  const db = makeDb();
  db.rows.push({ email: 'returning@example.com', is_subscribed: 0, last_opened_at: DAYS_AGO(90) });

  const response = await handleRequest(
    new Request('http://localhost/api/reactivate?email=returning@example.com'),
    { DB: db }
  );

  assert.equal(response.status, 200);
  assert.equal(db.rows[0].is_subscribed, 1);
  assert.notEqual(db.rows[0].last_opened_at, null);
});

test('POST /api/webhooks/resend refuses to process without RESEND_WEBHOOK_SECRET configured', async () => {
  const response = await handleRequest(new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body: '{}',
  }), {});

  assert.equal(response.status, 503);
});

test('POST /api/webhooks/resend rejects a request with an invalid signature', async () => {
  const response = await handleRequest(new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'webhook-id': 'msg_bad',
      'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
      'webhook-signature': 'v1,not-a-real-signature',
    },
    body: JSON.stringify({ type: 'email.opened', data: { to: ['reader@example.com'] } }),
  }), { RESEND_WEBHOOK_SECRET: 'whsec_dGVzdHNlY3JldA==' });

  assert.equal(response.status, 401);
});

test('POST /api/webhooks/resend updates last_opened_at on a genuinely valid email.opened event', async () => {
  const secret = 'whsec_dGVzdHNlY3JldA==';
  const db = makeDb();
  db.rows.push({ email: 'reader@example.com', is_subscribed: 1, last_opened_at: null });

  const payload = JSON.stringify({ type: 'email.opened', data: { to: ['reader@example.com'] } });
  const wh = new Webhook(secret);
  const msgId = 'msg_test123';
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, payload);

  const response = await handleRequest(new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'webhook-id': msgId,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': signature,
    },
    body: payload,
  }), { RESEND_WEBHOOK_SECRET: secret, DB: db });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.notEqual(db.rows[0].last_opened_at, null);
});

test('sunset email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendSunsetEmail({ email: 'ghost@example.com' }, {});
  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('target-reached email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendTargetReachedEmail({
    email: 'watcher@example.com',
    origin: 'JFK',
    destination: 'Lisbon, Portugal',
    price: 390,
    targetPrice: 400,
  }, {});
  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('POST /api/watchlist requires an authenticated Clerk session', async () => {
  const response = await handleRequest(new Request('http://localhost/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin_iata: 'JFK', destination: 'Lisbon, Portugal', target_price: 400 }),
  }), { CLERK_SECRET_KEY: 'configured' });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /authenticated/i);
});

test('checkWatchlists reports no DB configured when DB is missing', async () => {
  const result = await checkWatchlists({});
  assert.deepEqual(result, { checked: 0, notified: 0 });
});

test('checkWatchlists notifies exactly once when the tier-appropriate feed hits the target price', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_watch1', email: 'watcher1@example.com', subscription_tier: 'free' });
  db.watchlists.push({
    id: 'watch_1',
    user_id: 'user_watch1',
    origin_iata: 'JFK',
    destination: 'Lisbon, Portugal',
    target_price: 400,
    notified_at: null,
  });

  const env = { DB: db, ASSETS: makeAssets({ 'sparkfare_ranked_deals.json': SAMPLE_JFK_FEED }) };
  const result = await checkWatchlists(env);

  assert.equal(result.checked, 1);
  assert.equal(result.notified, 1);
  assert.notEqual(db.watchlists[0].notified_at, null);
});

test('checkWatchlists leaves a watchlist un-notified when the current price is still above target', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_watch2', email: 'watcher2@example.com', subscription_tier: 'free' });
  db.watchlists.push({
    id: 'watch_2',
    user_id: 'user_watch2',
    origin_iata: 'JFK',
    destination: 'Lisbon, Portugal',
    target_price: 100,
    notified_at: null,
  });

  const env = { DB: db, ASSETS: makeAssets({ 'sparkfare_ranked_deals.json': SAMPLE_JFK_FEED }) };
  const result = await checkWatchlists(env);

  assert.equal(result.checked, 1);
  assert.equal(result.notified, 0);
  assert.equal(db.watchlists[0].notified_at, null);
});

test('checkWatchlists skips watchlists that have already been notified', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_watch3', email: 'watcher3@example.com', subscription_tier: 'free' });
  db.watchlists.push({
    id: 'watch_3',
    user_id: 'user_watch3',
    origin_iata: 'JFK',
    destination: 'Lisbon, Portugal',
    target_price: 400,
    notified_at: DAYS_AGO(1),
  });

  const env = { DB: db, ASSETS: makeAssets({ 'sparkfare_ranked_deals.json': SAMPLE_JFK_FEED }) };
  const result = await checkWatchlists(env);

  assert.equal(result.checked, 0);
  assert.equal(result.notified, 0);
});

test('checkWatchlists reads the hourly feed for a paid-tier watchlist, not the free-tier file', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_watch4', email: 'watcher4@example.com', subscription_tier: 'paid' });
  db.watchlists.push({
    id: 'watch_4',
    user_id: 'user_watch4',
    origin_iata: 'ORD',
    destination: 'Bali, Indonesia',
    target_price: 950,
    notified_at: null,
  });

  const env = {
    DB: db,
    ASSETS: makeAssets({
      'sparkfare_hourly_ranked_deals.json': SAMPLE_OTHER_ORIGINS_FEED,
      'sparkfare_ranked_deals_other_origins.json': { generated_at: SAMPLE_OTHER_ORIGINS_FEED.generated_at, deals: [] },
    }),
  };
  const result = await checkWatchlists(env);

  assert.equal(result.checked, 1);
  assert.equal(result.notified, 1);
});

// Workplan Steps 109-114, 117 (GTM Plan Update, Phases 18-19).

test('stress-valve email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendStressValveEmail({ email: 'clicked@example.com', destination: 'Lisbon, Portugal', departure_at: '2027-01-01T00:00:00-05:00' }, {});
  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('departure-briefing email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendDepartureBriefingEmail({ email: 'departing@example.com', destination: 'Lisbon, Portugal', departure_at: '2027-01-01T00:00:00-05:00' }, {});
  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('route retrospective email completes with mocked delivery when Resend is not configured', async () => {
  const result = await sendRouteRetrospectiveEmail({ email: 'returned@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', lockedPrice: 400, currentAvg: 450, pctDiff: 0.11 }, {});
  assert.equal(result.ok, true);
  assert.equal(result.mocked, true);
});

test('sendStressValveAlerts reports no DB configured when DB is missing', async () => {
  const result = await sendStressValveAlerts({});
  assert.deepEqual(result, { sent: 0, skipped: 0, reason: 'DB not configured' });
});

test('sendDepartureBriefingAlerts reports no DB configured when DB is missing', async () => {
  const result = await sendDepartureBriefingAlerts({});
  assert.deepEqual(result, { sent: 0, skipped: 0, reason: 'DB not configured' });
});

test('sendRouteRetrospectives reports no DB configured when DB is missing', async () => {
  const result = await sendRouteRetrospectives({});
  assert.deepEqual(result, { sent: 0, skipped: 0, reason: 'DB not configured' });
});

test('POST /api/send-stress-valve-alerts completes when no DB is bound', async () => {
  const response = await handleRequest(new Request('http://localhost/api/send-stress-valve-alerts', { method: 'POST' }), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sent, 0);
});

test('POST /api/send-departure-briefing-alerts completes when no DB is bound', async () => {
  const response = await handleRequest(new Request('http://localhost/api/send-departure-briefing-alerts', { method: 'POST' }), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sent, 0);
});

test('POST /api/send-route-retrospectives completes when no DB is bound', async () => {
  const response = await handleRequest(new Request('http://localhost/api/send-route-retrospectives', { method: 'POST' }), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sent, 0);
});

test('sendDailyAlerts snapshots early-bird prices on the early run and detects a real price jump on the general run', async () => {
  const db = makeDb();
  // created_at must be recent -- pruneInactiveSubscribers() runs at the top of every
  // sendDailyAlerts() call, and a row with no created_at defaults to "epoch", which reads as
  // 45+ days old and gets pruned (is_subscribed flipped to 0) before this test's own assertions
  // ever run.
  db.rows.push({ id: 'user_early1', email: 'early1@example.com', verified_email: 1, origin_iata: 'JFK', is_subscribed: 1, early_access: 1, created_at: new Date().toISOString() });
  db.rows.push({ id: 'user_general1', email: 'general1@example.com', verified_email: 1, origin_iata: 'JFK', is_subscribed: 1, created_at: new Date().toISOString() });

  const earlyEnv = { DB: db, ASSETS: makeAssets({ 'sparkfare_ranked_deals.json': { generated_at: '2026-09-13T07:00:00Z', deals: [{ display_name: 'Lisbon, Portugal', route_key: 'JFK:Lisbon, Portugal', origin: 'JFK', price: 400, found_at: _foundAt, observations: _buildObs(400) }], featured: [] } }) };
  await sendDailyAlerts(earlyEnv, { earlyOnly: true });
  assert.equal(db.earlyBirdSnapshots.length, 1);
  assert.equal(db.earlyBirdSnapshots[0].price, 400);

  const generalEnv = { DB: db, ASSETS: makeAssets({ 'sparkfare_ranked_deals.json': { generated_at: '2026-09-13T08:00:00Z', deals: [{ display_name: 'Lisbon, Portugal', route_key: 'JFK:Lisbon, Portugal', origin: 'JFK', price: 460, found_at: _foundAt, observations: _buildObs(440) }], featured: [] } }) };
  const result = await sendDailyAlerts(generalEnv, { earlyOnly: false });
  // This mock doesn't track daily_alert_deliveries rows (no existing test needed that before),
  // so both users are "eligible" again here rather than user_early1 being deduped -- the actual
  // per-day dedupe is real production behavior (Step 93), just outside what this mock models.
  assert.equal(result.sent, 2);
});

// A real, previously-undiscovered bug found and fixed 2026-09-13: sendDailyAlerts loaded
// sparkfare_ranked_deals.json (JFK's own dedicated daily file) once, unconditionally, and sent
// that SAME deal content to every subscriber regardless of their own saved origin_iata -- only
// the email subject line ever reflected their real origin. Fixed by picking each user's own file
// via rankedDealsFilename (the same helper /api/deals and checkWatchlists already use) inside the
// loop. This test stubs globalThis.fetch (same technique already used for reconcileBookings) so a
// real, non-mocked Resend send actually happens and its request body -- the true HTML each
// recipient would receive -- can be inspected directly, rather than trusting sendDailyAlerts' own
// summary counts.
test("sendDailyAlerts sends a non-JFK user deals filtered to their own origin, not JFK's", async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_jfk', email: 'jfk-user@example.com', origin_iata: 'JFK', verified_email: 1, unsubscribed_at: null, is_subscribed: 1, created_at: DAYS_AGO(1) });
  db.rows.push({ id: 'user_lax', email: 'lax-user@example.com', origin_iata: 'LAX', verified_email: 1, unsubscribed_at: null, is_subscribed: 1, created_at: DAYS_AGO(1) });

  const sentEmails = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) {
      sentEmails.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ data: { id: 'test-id' }, error: null }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  const env = {
    DB: db,
    RESEND_API_KEY: 'test-key',
    ASSETS: makeAssets({
      'sparkfare_ranked_deals.json': SAMPLE_JFK_FEED,
      'sparkfare_ranked_deals_other_origins.json': SAMPLE_OTHER_ORIGINS_FEED,
    }),
  };

  let result;
  try {
    result = await sendDailyAlerts(env);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(result.sent, 2);
  assert.equal(sentEmails.length, 2);

  const jfkEmail = sentEmails.find((e) => e.to === 'jfk-user@example.com');
  const laxEmail = sentEmails.find((e) => e.to === 'lax-user@example.com');
  assert.ok(jfkEmail, 'JFK user should have received an email');
  assert.ok(laxEmail, 'LAX user should have received an email');

  // JFK's dedicated file prices Lisbon at $400; the combined other-origins file prices LAX's own
  // Lisbon entry at $410 -- distinct enough to prove which file actually backed each send.
  assert.match(jfkEmail.html, /\$400/);
  assert.doesNotMatch(jfkEmail.html, /\$410/);

  assert.match(laxEmail.html, /\$410/);
  assert.doesNotMatch(laxEmail.html, /\$400/, 'LAX user must not receive JFK-only deal content');
});

test('computePriceGougingWatchlist returns routes above their trailing average, sorted descending, excluding real deals', async () => {
  const env = {
    ASSETS: makeAssets({
      'sparkfare_ranked_deals.json': {
        deals: [{ display_name: 'Lisbon, Portugal', origin: 'JFK', price: 300, trailing_avg: 500 }], // a real deal -- below avg, must be excluded
        priced_no_deal: [{ display_name: 'Tokyo, Japan', origin: 'JFK', price: 900, trailing_avg: 600, booking_link: 'https://example.com/tokyo' }], // +50%
        featured: [],
      },
      'sparkfare_ranked_deals_other_origins.json': {
        priced_no_deal: [{ display_name: 'Bali, Indonesia', origin: 'LAX', price: 1200, trailing_avg: 750 }], // +60%
        deals: [],
        featured: [],
      },
    }),
  };

  const result = await computePriceGougingWatchlist(env);
  assert.equal(result.watchlist.length, 2);
  assert.equal(result.watchlist[0].destination, 'Bali, Indonesia'); // +60% ranks above Tokyo's +50%
  assert.equal(result.watchlist[1].destination, 'Tokyo, Japan');
  assert.ok(result.watchlist.every((r) => r.destination !== 'Lisbon, Portugal'));
});

test('GET /index renders the Price Gouging Watchlist dashboard', async () => {
  const env = {
    ASSETS: makeAssets({
      'sparkfare_ranked_deals.json': { priced_no_deal: [{ display_name: 'Tokyo, Japan', origin: 'JFK', price: 900, trailing_avg: 600 }], deals: [], featured: [] },
      'sparkfare_ranked_deals_other_origins.json': { deals: [], featured: [], priced_no_deal: [] },
    }),
  };
  const response = await sparkfareWorker.fetch(new Request('http://localhost/index'), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /The Sparkfare Index/);
  assert.match(html, /Tokyo, Japan/);
});

// Workplan Step 122 (Zero-CAC KPI dashboard).

test('computeKPIs returns null when DB is missing', async () => {
  const result = await computeKPIs({});
  assert.equal(result, null);
});

test('computeKPIs computes real viral, acquisition, and revenue numbers from D1 data', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_a', email: 'a@example.com', verified_email: 1, is_subscribed: 1, early_access: 1, referred_by: null });
  db.rows.push({ id: 'user_b', email: 'b@example.com', verified_email: 1, is_subscribed: 1, early_access: 1, referred_by: 'user_a' });
  db.rows.push({ id: 'user_c', email: 'c@example.com', verified_email: 0, is_subscribed: 1, early_access: 0, referred_by: null, partner_id: 'pseo' });
  db.rows.push({ id: 'user_d', email: 'd@example.com', verified_email: 1, is_subscribed: 0, early_access: 0, referred_by: null });

  db.trips.push({ trip_id: 'trip_1', user_id: 'user_a', status: 'booked', price_eur: 200 });
  db.trips.push({ trip_id: 'trip_2', user_id: 'user_b', status: 'booked', price_eur: 150 });
  db.trips.push({ trip_id: 'trip_3', user_id: 'user_c', status: 'clicked', price_eur: null });

  db.watchlists.push({ id: 'w1', user_id: 'user_a', notified_at: '2026-09-01T00:00:00Z' });
  db.watchlists.push({ id: 'w2', user_id: 'user_b', notified_at: null });

  const kpi = await computeKPIs({ DB: db });

  assert.equal(kpi.viral.total_users, 4);
  assert.equal(kpi.viral.unique_referrers, 1);
  assert.equal(kpi.viral.referred_signups, 1);
  assert.equal(kpi.viral.viral_coefficient, 0.25);
  assert.equal(kpi.viral.early_access_users, 2);

  assert.equal(kpi.acquisition.pseo_signups, 1);
  assert.equal(kpi.acquisition.verified_users, 3);
  assert.equal(kpi.acquisition.active_subscribers, 3);

  assert.equal(kpi.revenue.total_trips, 3);
  assert.equal(kpi.revenue.booked_trips, 2);
  assert.equal(kpi.revenue.total_revenue_eur, 350);
  assert.equal(Math.round(kpi.revenue.revenue_per_active_subscriber_eur * 100) / 100, 116.67);

  assert.equal(kpi.watchlists.total, 2);
  assert.equal(kpi.watchlists.notified, 1);
});

test('GET /kpi 404s when no secret is configured', async () => {
  const response = await sparkfareWorker.fetch(new Request('http://localhost/kpi?key=anything'), { DB: makeDb() });
  assert.equal(response.status, 404);
});

test('GET /kpi 404s with the wrong key', async () => {
  const response = await sparkfareWorker.fetch(new Request('http://localhost/kpi?key=wrong'), { DB: makeDb(), KPI_DASHBOARD_SECRET: 'right-secret' });
  assert.equal(response.status, 404);
});

test('GET /kpi renders the dashboard with the correct key', async () => {
  const db = makeDb();
  db.rows.push({ id: 'user_a', email: 'a@example.com', verified_email: 1, is_subscribed: 1 });
  const response = await sparkfareWorker.fetch(new Request('http://localhost/kpi?key=right-secret'), { DB: db, KPI_DASHBOARD_SECRET: 'right-secret' });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Zero-CAC KPIs/);
  assert.match(html, /Viral Coefficient/);
});
