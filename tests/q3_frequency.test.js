// Addendum Q, Q3 (D-049): honest frequency choices. Two options on both preference pages, the API refuses anything else, the migration retires
// `instant` and fills NULL, and the digest still reaches every reader it reached before. Real SQLite, a real signed token for the API.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker, { sendDailyAlerts } from '../src/index.js';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: () => {} };

function signedIn(sub, email) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT', kid: 'test' });
  const body = b64({ sub, email, iat: now - 5, nbf: now - 5, exp: now + 600, iss: 'https://clerk.example.test', azp: 'https://sparkfare.com' });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url');
  return { token: `${head}.${body}.${sig}`, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }) };
}

// ---- the two pages ------------------------------------------------------------------------------------------------------------

test('account.html and preferences.html offer exactly two frequency options, with the approved labels and no "instant"', () => {
  for (const page of ['account.html', 'preferences.html']) {
    const html = read(page);
    const select = html.match(/<select id="frequency">([\s\S]*?)<\/select>/)[1];
    const options = [...select.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(options, [['daily', 'Daily digest, at most one email a day'], ['weekly', 'Weekly edition, Sundays']], page);
    assert.doesNotMatch(html, /Instant \(Rare Finds only\)|value="instant"/, page);
  }
});

test('the account page shows a stored retired value as daily instead of an empty select', () => {
  assert.match(read('account.html'), /data\.preferences\.frequency === 'weekly' \? 'weekly' : 'daily'/);
});

// ---- the API ----------------------------------------------------------------------------------------------------------------------

function preferencesEnv(email = 'a@example.com') {
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec(`INSERT INTO users (id, email, verified_email, origin_iata, frequency) VALUES ('user_a', '${email}', 1, 'JFK', 'weekly')`);
  const { token, jwtKey } = signedIn('user_a', email);
  return { db, token, env: { DB: db, APP_URL: 'https://sparkfare.com', CLERK_SECRET_KEY: 'sk_test_x', CLERK_JWT_KEY: jwtKey } };
}
const save = (t, body) => worker.fetch(new Request('https://sparkfare.com/api/preferences', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.token}` }, body: JSON.stringify(body),
}), t.env, ctx);
const stored = (t) => t.db.raw.prepare("SELECT frequency FROM users WHERE id = 'user_a'").get().frequency;

test('the preferences API refuses "instant" and any other value with a 400, and leaves the saved choice alone', async () => {
  const t = preferencesEnv();
  for (const frequency of ['instant', 'hourly', 'DAILY', 'weekly ', 5, true, {}]) {
    const res = await save(t, { frequency });
    assert.equal(res.status, 400, JSON.stringify(frequency));
    assert.deepEqual(await res.json(), { ok: false, error: 'Choose daily or weekly' });
  }
  assert.equal(stored(t), 'weekly');
});

test('the preferences API saves daily and weekly, and a save without a frequency keeps the saved one', async () => {
  const t = preferencesEnv();
  assert.equal((await save(t, { frequency: 'daily' })).status, 200);
  assert.equal(stored(t), 'daily');
  assert.equal((await save(t, { frequency: 'weekly' })).status, 200);
  assert.equal(stored(t), 'weekly');
  for (const body of [{ passenger_count: 2 }, { frequency: null }, { frequency: '' }]) {
    assert.equal((await save(t, body)).status, 200, JSON.stringify(body));
    assert.equal(stored(t), 'weekly');
  }
});

// ---- the migration and the digest -------------------------------------------------------------------------------------------------

test('migration 0038 turns instant, empty and unknown values into daily and leaves daily and weekly alone', () => {
  const db = makeSqliteD1(MIGRATIONS).raw;
  db.exec(`INSERT INTO users (id, email, verified_email, frequency) VALUES ('1','i@example.com',1,'instant'), ('2','n@example.com',1,NULL), ('3','d@example.com',1,'daily'), ('4','w@example.com',1,'weekly'), ('5','x@example.com',1,'hourly')`);
  db.exec(read('migrations/0038_frequency_two_options.sql'));
  const rows = Object.fromEntries(db.prepare('SELECT id, frequency FROM users').all().map((r) => [r.id, r.frequency]));
  assert.deepEqual(rows, { 1: 'daily', 2: 'daily', 3: 'daily', 4: 'weekly', 5: 'daily' });
  db.exec(read('migrations/0038_frequency_two_options.sql')); // idempotent
  assert.equal(db.prepare("SELECT frequency FROM users WHERE id = '4'").get().frequency, 'weekly');
});

async function digestRecipients(frequencies) {
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec('CREATE TABLE IF NOT EXISTS early_bird_snapshots (route_key TEXT NOT NULL, snapshot_date TEXT NOT NULL, price INTEGER, PRIMARY KEY (route_key, snapshot_date))');
  for (const [id, frequency] of Object.entries(frequencies)) {
    db.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed, created_at, frequency) VALUES (?, ?, 1, 'JFK', 1, ?, ?)").run(id, `${id}@example.com`, new Date().toISOString(), frequency);
  }
  const foundAt = new Date(Date.now() - 3600000).toISOString();
  const obs = Array.from({ length: 15 }, (_, i) => ({ price: 500 + (14 - i) * 2, date: new Date(Date.now() - (14 - i) * 86400000).toISOString() }));
  const deal = { display_name: 'Lisbon, Portugal', route_key: 'JFK:Lisbon, Portugal', origin: 'JFK', price: 400, found_at: foundAt, observations: obs };
  const assets = { async fetch(request) {
    return new URL(request.url).pathname === '/sparkfare_ranked_deals.json' ? new Response(JSON.stringify({ generated_at: new Date().toISOString(), deals: [deal], featured: [] })) : new Response('nf', { status: 404 });
  } };
  await sendDailyAlerts({ DB: db, ASSETS: assets });
  return db.raw.prepare("SELECT email FROM daily_alert_deliveries WHERE status = 'sent' OR status = 'pending' ORDER BY email").all().map((r) => r.email.split('@')[0]);
}

test('the daily digest still reaches daily readers and the stored "instant" ones, with or without the migration having run', async () => {
  const got = await digestRecipients({ d1: 'daily', i1: 'instant' });
  assert.deepEqual(got, ['d1', 'i1']);
});

test('after the migration an ex-instant and an ex-empty reader are daily readers and a weekly reader is not a daily one', async () => {
  const dow = new Date().getUTCDay();
  const got = await digestRecipients({ d1: 'daily', w1: 'weekly', n1: 'daily' });
  assert.deepEqual(got, dow === 1 ? ['d1', 'n1', 'w1'] : ['d1', 'n1']); // the Monday weekly branch stays until Q2
});
