// POST /api/signup is public. It used to write whatever `subscription_tier` the request body carried, on
// both a new row and (through the resubmit path) any existing email's row, so anyone could mark any
// account "paid". Harmless while no tier is sold; a free Plus subscription for everyone once one is.
// The tier now comes only from a verified payment event, never from this endpoint.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: (p) => p };

function signup(DB, body) {
  return worker.fetch(new Request('https://sparkfare.com/api/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { DB }, ctx);
}
const tierOf = (DB, email) => DB.raw.prepare('SELECT subscription_tier AS t FROM users WHERE email = ?').get(email)?.t;
const base = (email, extra = {}) => ({ id: `local_${email}`, email, origin_iata: 'JFK', trip_length: '7-10', ...extra });

test('a new signup that asks for the paid tier gets the free tier', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const res = await signup(DB, base('new@example.com', { subscription_tier: 'paid' }));
  assert.equal(res.status, 200);
  assert.equal(tierOf(DB, 'new@example.com'), 'free');
  assert.equal((await res.json()).user.subscription_tier, 'free');
});

test('resubmitting the public form with tier "paid" does not upgrade an existing free user', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await signup(DB, base('victim@example.com'));
  const res = await signup(DB, base('victim@example.com', { subscription_tier: 'paid', origin_iata: 'LAX' }));
  assert.equal(res.status, 200);
  assert.equal(tierOf(DB, 'victim@example.com'), 'free');
  assert.equal(DB.raw.prepare("SELECT origin_iata AS o FROM users WHERE email = 'victim@example.com'").get().o, 'LAX', 'the rest of the resubmit still applies');
});

test('resubmitting the form never downgrades a user who really is paid, whatever the body says', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await signup(DB, base('plus@example.com'));
  DB.raw.prepare("UPDATE users SET subscription_tier = 'paid' WHERE email = 'plus@example.com'").run(); // what a payment webhook will do
  for (const body of [base('plus@example.com'), base('plus@example.com', { subscription_tier: 'free' }), base('plus@example.com', { subscription_tier: 'paid' })]) {
    assert.equal((await signup(DB, body)).status, 200);
    assert.equal(tierOf(DB, 'plus@example.com'), 'paid');
  }
});

test('junk tier values are ignored too', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  for (const [i, v] of [null, '', 'admin', 'PAID', { tier: 'paid' }, ['paid']].entries()) {
    const email = `junk${i}@example.com`;
    assert.equal((await signup(DB, base(email, { subscription_tier: v }))).status, 200, String(i));
    assert.equal(tierOf(DB, email), 'free', String(i));
  }
});
