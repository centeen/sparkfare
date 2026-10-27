// An email-only subscriber has a placeholder local_* id. When they later sign in (Clerk), their row is re-keyed to the real id.
// Everything that points at the old id must follow, or the referral credit they earned (and the link they already shared) is lost:
// referral_codes.user_id, referrals.referrer_id and referred_id, and other users' referred_by. Real SQLite with the real migrations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { ensureUserRow } from '../src/index.js';
import { getEntitlements, watchlistLimitFor } from '../src/rewards.js';

const files = () => fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const session = (id, email) => ({ authenticated: true, user: { id, email } });

function seed() {
  const d1 = makeSqliteD1(files());
  const db = d1.raw;
  db.exec(`INSERT INTO users (id, email, verified_email) VALUES ('local_a', 'a@example.com', 1), ('f1', 'f1@example.com', 1), ('f2', 'f2@example.com', 1), ('f3', 'f3@example.com', 1)`);
  db.exec(`UPDATE users SET referred_by = 'local_a' WHERE id IN ('f1', 'f2', 'f3')`);
  db.exec(`INSERT INTO referral_codes (id, user_id, code) VALUES ('c1', 'local_a', 'ref_shared')`);
  db.exec(`INSERT INTO referrals (id, referrer_id, referred_id, status) VALUES ('r1', 'local_a', 'f1', 'confirmed'), ('r2', 'local_a', 'f2', 'confirmed'), ('r3', 'local_a', 'f3', 'confirmed')`);
  return d1;
}

test('three confirmed referrals earned by an email-only subscriber still count after they sign in', async () => {
  const d1 = seed();
  assert.equal(watchlistLimitFor((await getEntitlements({ DB: d1 }, 'local_a')).confirmedReferrals), 10);
  await ensureUserRow({ DB: d1 }, session('user_clerk', 'a@example.com'), async () => null);
  const e = await getEntitlements({ DB: d1 }, 'user_clerk');
  assert.equal(e.confirmedReferrals, 3);
  assert.equal(e.maxWatchlists, 10);
  assert.equal((await getEntitlements({ DB: d1 }, 'local_a')).confirmedReferrals, 0, 'nothing is left under the old id');
});

test('the link they already shared still points at them, and no second code is needed', async () => {
  const d1 = seed();
  await ensureUserRow({ DB: d1 }, session('user_clerk', 'a@example.com'), async () => null);
  assert.equal(d1.raw.prepare("SELECT user_id FROM referral_codes WHERE code = 'ref_shared'").get().user_id, 'user_clerk');
  assert.equal(d1.raw.prepare("SELECT count(*) c FROM referral_codes WHERE user_id = 'local_a'").get().c, 0);
});

test('friends they referred stay pointed at them (users.referred_by), so a later confirmation is credited to the right id', async () => {
  const d1 = seed();
  await ensureUserRow({ DB: d1 }, session('user_clerk', 'a@example.com'), async () => null);
  assert.deepEqual(d1.raw.prepare("SELECT id FROM users WHERE referred_by = 'user_clerk' ORDER BY id").all().map((r) => r.id), ['f1', 'f2', 'f3']);
  assert.equal(d1.raw.prepare("SELECT count(*) c FROM users WHERE referred_by = 'local_a'").get().c, 0);
});

test('a person who was themselves referred keeps that credit for their referrer after they sign in', async () => {
  const d1 = seed();
  await ensureUserRow({ DB: d1 }, session('user_f1', 'f1@example.com'), async () => null);
  assert.equal(d1.raw.prepare("SELECT referred_id FROM referrals WHERE id = 'r1'").get().referred_id, 'user_f1');
  assert.equal((await getEntitlements({ DB: d1 }, 'local_a')).confirmedReferrals, 3);
});

test('a row that is already under the real id is left alone', async () => {
  const d1 = seed();
  d1.raw.exec(`UPDATE users SET id = 'user_clerk' WHERE id = 'local_a'`);
  d1.raw.exec(`UPDATE referral_codes SET user_id = 'user_clerk'; UPDATE referrals SET referrer_id = 'user_clerk'; UPDATE users SET referred_by = 'user_clerk' WHERE referred_by IS NOT NULL`);
  await ensureUserRow({ DB: d1 }, session('user_clerk', 'a@example.com'), async () => { throw new Error('no lookup needed'); });
  assert.equal((await getEntitlements({ DB: d1 }, 'user_clerk')).confirmedReferrals, 3);
});

// ---- the signup path, with a real signed token --------------------------------------------------------------------------------
import crypto from 'node:crypto';
import worker from '../src/index.js';

function signedIn(sub, email) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT', kid: 'test' });
  const body = b64({ sub, email, iat: now - 5, nbf: now - 5, exp: now + 600, iss: 'https://clerk.example.test', azp: 'https://sparkfare.com' });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url');
  return { token: `${head}.${body}.${sig}`, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }) };
}

test('signup while signed in re-keys the referral rows, not just the users row (real signed token, real handler)', async () => {
  const d1 = seed();
  const { token, jwtKey } = signedIn('user_clerk', 'a@example.com');
  const env = { DB: d1, APP_URL: 'https://sparkfare.com', CLERK_SECRET_KEY: 'sk_test_x', CLERK_JWT_KEY: jwtKey };
  const ctx = { waitUntil: () => {} };
  const res = await worker.fetch(new Request('https://sparkfare.com/api/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id: 'local_ignored', email: 'a@example.com', origin_iata: 'MIA', trip_length: '7-10' }),
  }), env, ctx);
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(d1.raw.prepare("SELECT id FROM users WHERE email = 'a@example.com'").get().id, 'user_clerk');
  const e = await getEntitlements({ DB: d1 }, 'user_clerk');
  assert.equal(e.confirmedReferrals, 3);
  assert.equal(d1.raw.prepare("SELECT user_id FROM referral_codes WHERE code = 'ref_shared'").get().user_id, 'user_clerk');
  assert.equal(d1.raw.prepare("SELECT count(*) c FROM users WHERE referred_by = 'user_clerk'").get().c, 3);
});

test('an unsigned resubmit never moves the id or the referral rows', async () => {
  const d1 = seed();
  const env = { DB: d1, APP_URL: 'https://sparkfare.com' };
  await worker.fetch(new Request('https://sparkfare.com/api/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'local_other', email: 'a@example.com', origin_iata: 'MIA', trip_length: '7-10' }),
  }), env, { waitUntil: () => {} });
  assert.equal(d1.raw.prepare("SELECT id FROM users WHERE email = 'a@example.com'").get().id, 'local_a');
  assert.equal((await getEntitlements({ DB: d1 }, 'local_a')).confirmedReferrals, 3);
});

test('docs/referral_reads.sql runs on the real schema and finds orphaned rows and pre-Oct-20 credit', () => {
  const d1 = seed();
  d1.raw.exec(`UPDATE referrals SET created_at = '2026-10-01 10:00:00', updated_at = '2026-10-01 10:00:00'`);
  d1.raw.exec(`UPDATE users SET id = 'user_clerk' WHERE id = 'local_a'`); // what the old re-key did: the users row moved, the referral rows did not
  const sql = fs.readFileSync(new URL('../docs/referral_reads.sql', import.meta.url), 'utf8');
  const statements = sql.split('\n').filter((l) => !l.startsWith('--')).join('\n').split(';').map((x) => x.trim()).filter(Boolean);
  assert.equal(statements.length, 3);
  const [pre, orphans, codes] = statements.map((q) => ({ ...d1.raw.prepare(q).get() }));
  assert.deepEqual(pre, { accounts_with_a_confirmed_referral_before_oct_20: 1, of_which_three_or_more: 1, of_which_five_or_more: 0 });
  assert.deepEqual(orphans, { orphaned_referral_rows: 3, orphaned_referrers: 1, orphaned_confirmed: 3 });
  assert.deepEqual(codes, { orphaned_referral_codes: 1 });
});
