import test from 'node:test';
import assert from 'node:assert';
import { handleRequest } from '../src/index.js';
import { randomUUID } from 'node:crypto';

// A mock environment
function makeEnv(overrides = {}) {
  const db = {
    queries: [],
    prepare: (sql) => ({
      // F2: /api/signup now runs a no-bind CREATE TABLE IF NOT EXISTS consent_log guard before
      // its own consent_log queries -- same no-bind .run() gap already hit for T5c/F1/F2's other
      // mocks.
      run: async () => ({ success: true }),
      bind: (...params) => ({
        first: async () => {
          db.queries.push({ sql, params });
          // Mocks for lookups
          if (sql.includes('SELECT user_id FROM referral_codes WHERE code = ?')) {
            if (params[0] === 'ref_valid') return { user_id: 'user_referrer_1' };
            if (params[0] === 'ref_self') return { user_id: 'user_self_id' };
            return null;
          }
          if (sql.includes('SELECT count(*) as c FROM consent_log')) {
            // No IP abuse by default
            return { c: 0 };
          }
          if (sql.includes('SELECT id, verified_email, partner_id, early_access FROM users WHERE email = ?')) {
             return null; // new user
          }
          return null;
        },
        run: async () => {
          db.queries.push({ sql, params });
          return { success: true };
        }
      })
    })
  };
  return {
    DB: db,
    ENABLE_T3_REFERRALS: 'true',
    ...overrides
  };
}

test('POST /api/signup inserts into referrals when valid ref code is used', async () => {
  const env = makeEnv();
  const req = new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_new_1',
      email: 'new@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
      passenger_count: 1,
      ref: 'ref_valid'
    })
  });

  const res = await handleRequest(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);

  // Check if INSERT INTO referrals happened
  const hasReferralInsert = env.DB.queries.some(q => 
    q.sql.includes('INSERT INTO referrals') &&
    q.params.includes('user_referrer_1') &&
    q.params.includes('user_new_1')
  );
  assert.ok(hasReferralInsert, 'Should insert into referrals with correct referrer_id and referred_id');
});

test('POST /api/signup rejects self-referral', async () => {
  const env = makeEnv();
  const req = new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'user_self_id',
      email: 'self@example.com',
      origin_iata: 'JFK',
      trip_length: '7-10',
      passenger_count: 1,
      ref: 'ref_self'
    })
  });

  const res = await handleRequest(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);

  // Check that no referral insert happened
  const hasReferralInsert = env.DB.queries.some(q => 
    q.sql.includes('INSERT INTO referrals')
  );
  assert.equal(hasReferralInsert, false, 'Should not insert into referrals for self-referral');
});

test('GET /hub returns 404 when ENABLE_T3_REFERRALS is false', async () => {
  const env = makeEnv({ ENABLE_T3_REFERRALS: 'false' });
  const req = new Request('http://localhost/hub', { method: 'GET' });
  
  const res = await handleRequest(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 404);
});

test('GET /api/referrals/status returns 404 when ENABLE_T3_REFERRALS is false', async () => {
  const env = makeEnv({ ENABLE_T3_REFERRALS: 'false' });
  const req = new Request('http://localhost/api/referrals/status', { method: 'GET' });
  
  const res = await handleRequest(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 404);
});
