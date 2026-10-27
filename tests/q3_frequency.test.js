// Q3 (Addendum Q, ROADMAP step 169): frequency has two honest choices, daily and weekly. 'instant' is gone from the pages and
// the API, stored 'instant' and empty values are daily readers, and migration 0038 rewrites them.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { handleRequest, sendDailyAlerts } from '../src/index.js';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('both pages offer exactly two options, labelled honestly, and no Instant', () => {
  for (const f of ['account.html', 'preferences.html']) {
    const sel = read(f).match(/<select id="frequency">([\s\S]*?)<\/select>/)[1];
    const opts = [...sel.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(opts, [['daily', 'Daily digest, at most one email a day'], ['weekly', 'Weekly edition, Sundays']], f);
    assert.doesNotMatch(read(f), /Instant|instant/, f);
  }
});

test('the account page shows a stored instant value as daily', () => {
  assert.match(read('account.html'), /data\.preferences\.frequency === 'weekly' \? 'weekly' : 'daily'/);
});

// ---- API ------------------------------------------------------------------------------------------------
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' });
function jwtFor(sub) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b({ alg: 'RS256', typ: 'JWT', kid: 'test' });
  const pay = b({ sub, sid: 's', iat: now, nbf: now - 5, exp: now + 600, iss: 'https://clerk.test' });
  return `${head}.${pay}.${crypto.sign('RSA-SHA256', Buffer.from(`${head}.${pay}`), privateKey).toString('base64url')}`;
}
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, origin_iata TEXT, passenger_count INTEGER DEFAULT 1,
    trip_length TEXT, has_pet BOOLEAN DEFAULT 0, away_needs TEXT, frequency TEXT DEFAULT 'daily', paused_until TEXT,
    notify_email INTEGER DEFAULT 1, notify_push INTEGER DEFAULT 0)`);
  db.prepare("INSERT INTO users (id, email, origin_iata) VALUES ('user_a', 'a@example.com', 'JFK')").run();
  const stmt = (sql, p) => ({
    run: async () => { const r = db.prepare(sql).run(...p); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...p) }),
  });
  return { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}
const save = (env, body) => handleRequest(new Request('https://sparkfare.com/api/preferences', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${jwtFor('user_a')}` }, body: JSON.stringify(body),
}), env, { waitUntil() {} });

test('the preferences API accepts daily and weekly and rejects instant and anything else with 400', async () => {
  const db = d1(); const env = { DB: db, CLERK_SECRET_KEY: 'sk_test_x', CLERK_JWT_KEY: PEM };
  for (const bad of ['instant', 'hourly', '', 'DAILY', 5]) {
    const res = await save(env, { frequency: bad });
    assert.equal(res.status, 400, `rejects ${JSON.stringify(bad)}`);
  }
  assert.equal(db._db.prepare("SELECT frequency FROM users WHERE id='user_a'").get().frequency, 'daily', 'a rejected save changes nothing');
  assert.equal((await save(env, { frequency: 'weekly' })).status, 200);
  assert.equal(db._db.prepare("SELECT frequency FROM users WHERE id='user_a'").get().frequency, 'weekly');
  assert.equal((await save(env, { frequency: 'daily' })).status, 200);
  assert.equal((await save(env, { origin_iata: 'JFK' })).status, 200, 'a save that omits frequency still works');
});

// ---- the send -------------------------------------------------------------------------------------------
const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const TODAY = new Date().toISOString().slice(0, 10);
const now = Date.now();
const deal = { display_name: 'Lisbon, Portugal', route_key: 'JFK:Lisbon, Portugal', origin: 'JFK', price: 400, found_at: new Date(now - 3600000).toISOString(),
  observations: Array.from({ length: 15 }, (_, i) => ({ price: 430 + (14 - i) * 2, date: new Date(now - (14 - i) * 86400000).toISOString() })) };
const assets = { async fetch(r) {
  return new URL(r.url).pathname === '/sparkfare_ranked_deals.json'
    ? new Response(JSON.stringify({ generated_at: new Date().toISOString(), deals: [deal], featured: [] })) : new Response('x', { status: 404 });
} };

test('daily, stored instant and empty readers get the digest; weekly readers and unknown values do not', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec('CREATE TABLE IF NOT EXISTS early_bird_snapshots (route_key TEXT NOT NULL, snapshot_date TEXT NOT NULL, price INTEGER, PRIMARY KEY (route_key, snapshot_date))');
  const rows = [['d', 'daily'], ['i', 'instant'], ['n', null], ['w', 'weekly'], ['x', 'hourly']];
  for (const [id, f] of rows) {
    db.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed, frequency, created_at) VALUES (?, ?, 1, 'JFK', 1, ?, ?)")
      .run(id, `${id}@example.com`, f, new Date().toISOString());
  }
  await sendDailyAlerts({ DB: db, ASSETS: assets }, { earlyOnly: false });
  const got = (id) => db.raw.prepare('SELECT status FROM daily_alert_deliveries WHERE delivery_key = ?').get(`${id}@example.com:${TODAY}`)?.status;
  assert.equal(got('d'), 'sent');
  assert.equal(got('i'), 'sent', 'stored instant is a daily reader');
  assert.equal(got('n'), 'sent', 'an empty value is a daily reader');
  assert.equal(got('w'), undefined, 'weekly readers are the Sunday edition (Q2), not the daily send,');
  assert.equal(got('x'), undefined);
});

test('migration 0038 rewrites instant and empty to daily and leaves weekly alone', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE users (id TEXT, frequency TEXT)");
  db.exec("INSERT INTO users VALUES ('a','instant'),('b',NULL),('c','weekly'),('d','daily')");
  db.exec(read('migrations/0038_frequency_two_choices.sql'));
  db.exec(read('migrations/0038_frequency_two_choices.sql'));
  assert.deepEqual(db.prepare('SELECT id, frequency FROM users ORDER BY id').all().map((r) => ({ ...r })),
    [{ id: 'a', frequency: 'daily' }, { id: 'b', frequency: 'daily' }, { id: 'c', frequency: 'weekly' }, { id: 'd', frequency: 'daily' }]);
});
