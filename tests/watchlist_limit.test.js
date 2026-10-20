// Tier 3 of the referral hub (2026-10-20): a person can watch 3 routes at once, or 10 with three confirmed referrals.
// Authenticated route tests: a real RS256 JWT is verified by the real @clerk/backend against a real in-memory SQLite D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { handleRequest } from '../src/index.js';
import { watchlistLimitFor, WATCHLIST_LIMIT_FREE, WATCHLIST_LIMIT_REFERRED } from '../src/rewards.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' });
function jwtFor(sub) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b({ alg: 'RS256', typ: 'JWT', kid: 'test' });
  const pay = b({ sub, sid: 'sess_1', iat: now, nbf: now - 5, exp: now + 600, iss: 'https://clerk.test' });
  return `${head}.${pay}.${crypto.sign('RSA-SHA256', Buffer.from(`${head}.${pay}`), privateKey).toString('base64url')}`;
}
const DESTS = Object.fromEntries(['Lisbon, Portugal', 'Madrid, Spain', 'Bali, Indonesia', 'Prague, Czechia', 'Athens, Greece', 'Tulum, Mexico', 'Budapest, Hungary', 'Krakow, Poland', 'Cusco, Peru', 'Petra, Jordan', 'Phuket, Thailand', 'Oaxaca, Mexico'].map((d) => [d, {}]));

function makeEnv({ confirmed = 0 } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT);
    CREATE TABLE referrals (id TEXT PRIMARY KEY, referrer_id TEXT, referred_id TEXT, status TEXT);`);
  db.prepare("INSERT INTO users (id, email) VALUES ('user_a', 'a@example.com'), ('user_b', 'b@example.com')").run();
  for (let i = 0; i < confirmed; i++) db.prepare("INSERT INTO referrals (id, referrer_id, referred_id, status) VALUES (?, 'user_a', ?, 'confirmed')").run(`r${i}`, `f${i}`);
  const stmt = (sql, p) => ({
    run: async () => { const r = db.prepare(sql).run(...p); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...p) }),
  });
  const DB = { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
  const ASSETS = { fetch: async () => new Response(JSON.stringify(DESTS), { status: 200 }) };
  return { DB, ASSETS, CLERK_SECRET_KEY: 'sk_test_x', CLERK_JWT_KEY: PEM };
}
const ctx = { waitUntil() {} };
async function add(env, dest, sub = 'user_a', price = 300) {
  return handleRequest(new Request('https://sparkfare.com/api/watchlist', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${jwtFor(sub)}` },
    body: JSON.stringify({ origin_iata: 'JFK', destination: dest, target_price: price }),
  }), env, ctx);
}
async function list(env, sub = 'user_a') {
  const res = await handleRequest(new Request('https://sparkfare.com/api/watchlist', { headers: { authorization: `Bearer ${jwtFor(sub)}` } }), env, ctx);
  return res.json();
}
const dests = Object.keys(DESTS);

test('the limit function: 3 without referrals, 10 from three confirmed referrals', () => {
  assert.equal(WATCHLIST_LIMIT_FREE, 3);
  assert.equal(WATCHLIST_LIMIT_REFERRED, 10);
  assert.deepEqual([0, 1, 2, 3, 4, 10].map(watchlistLimitFor), [3, 3, 3, 10, 10, 10]);
});

test('without referrals: three watchlists are allowed and the fourth is refused with a reason', async () => {
  const env = makeEnv();
  for (const d of dests.slice(0, 3)) assert.equal((await add(env, d)).status, 200, d);
  const fourth = await add(env, dests[3]);
  assert.equal(fourth.status, 403);
  const body = await fourth.json();
  assert.equal(body.ok, false);
  assert.equal(body.code, 'watchlist_limit');
  assert.equal(body.limit, 3);
  assert.equal(body.active, 3);
  assert.match(body.error, /Invite 3 friends/);
  assert.equal(env.DB._db.prepare('SELECT COUNT(*) AS c FROM watchlists').get().c, 3, 'nothing was inserted');
});

test('three confirmed referrals raise the limit to 10, and the eleventh is refused', async () => {
  const env = makeEnv({ confirmed: 3 });
  for (const d of dests.slice(0, 10)) assert.equal((await add(env, d)).status, 200, d);
  const eleventh = await add(env, dests[10]);
  assert.equal(eleventh.status, 403);
  const body = await eleventh.json();
  assert.equal(body.limit, 10);
  assert.doesNotMatch(body.error, /Invite/);
});

test('two confirmed referrals do not raise it; a pending referral does not count', async () => {
  const env = makeEnv({ confirmed: 2 });
  env.DB._db.prepare("INSERT INTO referrals (id, referrer_id, referred_id, status) VALUES ('p1', 'user_a', 'f9', 'pending')").run();
  for (const d of dests.slice(0, 3)) await add(env, d);
  assert.equal((await add(env, dests[3])).status, 403);
});

test('a watchlist that already reached its target stops counting', async () => {
  const env = makeEnv();
  for (const d of dests.slice(0, 3)) await add(env, d);
  env.DB._db.prepare("UPDATE watchlists SET notified_at = datetime('now') WHERE destination = ?").run(dests[0]);
  assert.equal((await add(env, dests[3])).status, 200, 'a slot freed up');
  assert.equal((await add(env, dests[4])).status, 403);
});

test('existing watchlists over the limit are kept and still listed; only a new one is refused', async () => {
  const env = makeEnv();
  for (const d of dests.slice(0, 3)) await add(env, d);
  env.DB._db.exec("INSERT INTO watchlists (id, user_id, origin_iata, destination, target_price) VALUES ('x1', 'user_a', 'JFK', 'Cusco, Peru', 500), ('x2', 'user_a', 'JFK', 'Petra, Jordan', 500)");
  const data = await list(env);
  assert.equal(data.watchlists.length, 5);
  assert.equal(data.active, 5);
  assert.equal(data.limit, 3);
  assert.equal((await add(env, 'Phuket, Thailand')).status, 403);
});

test('the limit is per person: another user is not affected', async () => {
  const env = makeEnv();
  for (const d of dests.slice(0, 3)) await add(env, d);
  assert.equal((await add(env, dests[0], 'user_b')).status, 200);
});

test('GET reports the allowance the page shows', async () => {
  const env = makeEnv();
  await add(env, dests[0]);
  const data = await list(env);
  assert.equal(data.ok, true);
  assert.equal(data.active, 1);
  assert.equal(data.limit, 3);
  assert.equal(data.limit_with_referrals, 10);
  assert.equal(data.referrals_needed, 3);
});

test('a failing referrals read never raises the limit', async () => {
  const env = makeEnv();
  env.DB._db.exec('DROP TABLE referrals');
  for (const d of dests.slice(0, 3)) assert.equal((await add(env, d)).status, 200);
  assert.equal((await add(env, dests[3])).status, 403);
});
