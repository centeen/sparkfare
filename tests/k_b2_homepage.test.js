// K-B2 (ROADMAP step 124): the homepage order and signup, the nearest-hub notice, and the confirmation page that now asks for trip length.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { signWelcomeToken, verifyWelcomeToken } from '../src/welcome.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ctx = { waitUntil: (p) => p };
const SECRET = 'test-secret-value';

function makeD1(withChosenColumn = true) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, verified_email INTEGER DEFAULT 0, verification_token TEXT, origin_iata TEXT, trip_length TEXT DEFAULT '7-10', passenger_count INTEGER DEFAULT 1${withChosenColumn ? ', trip_length_chosen INTEGER DEFAULT 0' : ''});
    CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')), ua_class TEXT, schema_version INTEGER DEFAULT 1);`);
  const stmt = (sql, params) => ({
    run: async () => { db.prepare(sql).run(...params); return { success: true }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
  });
  return { raw: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}
const post = (path, body, env) => worker.fetch(new Request('https://sparkfare.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env, ctx);

test('the welcome token carries only the user id, verifies only with the secret that signed it, and rejects tampering', async () => {
  const t = await signWelcomeToken(SECRET, 'user_abc123');
  assert.equal(await verifyWelcomeToken(SECRET, t), 'user_abc123');
  assert.equal(await verifyWelcomeToken('another-secret', t), null);
  assert.equal(await verifyWelcomeToken(SECRET, t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), null);
  const [idPart, sig] = t.split('.');
  assert.equal(await verifyWelcomeToken(SECRET, Buffer.from('user_other').toString('base64url') + '.' + sig), null, 'a signature for one id does not fit another');
  for (const bad of ['', 'nodot', '.', null, undefined, 123, 'a'.repeat(500) + '.b']) assert.equal(await verifyWelcomeToken(SECRET, bad), null, String(bad).slice(0, 20));
  assert.equal(await verifyWelcomeToken('', t), null, 'no secret, no verification');
  assert.ok(!Buffer.from(idPart, 'base64url').toString().includes('@'), 'no email in the token');
});

test('verifying an email redirects to the confirmation page with a token for that user; without the secret it goes home; an unknown token is 404', async () => {
  const DB = makeD1();
  DB.raw.exec("INSERT INTO users (id, email, verification_token) VALUES ('user_1', 'a@example.com', 'tok-1')");
  const res = await worker.fetch(new Request('https://sparkfare.com/api/verify?token=tok-1'), { DB, UNSUBSCRIBE_SECRET: SECRET }, ctx);
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('Location'));
  assert.equal(loc.pathname, '/welcome');
  assert.equal(await verifyWelcomeToken(SECRET, loc.searchParams.get('t')), 'user_1');
  assert.equal(DB.raw.prepare("SELECT verified_email AS v FROM users WHERE id = 'user_1'").get().v, 1);
  DB.raw.exec("INSERT INTO users (id, email, verification_token) VALUES ('user_2', 'b@example.com', 'tok-2')");
  const noSecret = await worker.fetch(new Request('https://sparkfare.com/api/verify?token=tok-2'), { DB }, ctx);
  assert.equal(noSecret.status, 302);
  assert.equal(new URL(noSecret.headers.get('Location')).pathname, '/');
  const unknown = await worker.fetch(new Request('https://sparkfare.com/api/verify?token=nope'), { DB, UNSUBSCRIBE_SECRET: SECRET }, ctx);
  assert.equal(unknown.status, 404);
});

test('the confirmation page saves trip length and travelers for the signed user only, and marks the length as chosen', async () => {
  const DB = makeD1();
  DB.raw.exec("INSERT INTO users (id, email) VALUES ('user_1', 'a@example.com'), ('user_2', 'b@example.com')");
  const env = { DB, UNSUBSCRIBE_SECRET: SECRET };
  const token = await signWelcomeToken(SECRET, 'user_1');
  const res = await post('/api/welcome', { token, trip_length: '11-14', passenger_count: 3 }, env);
  assert.equal(res.status, 200);
  const rows = DB.raw.prepare('SELECT id, trip_length, passenger_count, trip_length_chosen FROM users ORDER BY id').all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { id: 'user_1', trip_length: '11-14', passenger_count: 3, trip_length_chosen: 1 },
    { id: 'user_2', trip_length: '7-10', passenger_count: 1, trip_length_chosen: 0 },
  ]);
  const ev = DB.raw.prepare("SELECT event_type, user_id, meta FROM events WHERE event_type = 'welcome_prefs'").get();
  assert.equal(ev.user_id, 'user_1');
  assert.ok(!JSON.stringify(ev).includes('@'), 'the event holds no email');
});

test('the confirmation page refuses a bad token, a bad length and bad JSON, clamps travelers, and still saves on a database without the chosen column', async () => {
  const DB = makeD1();
  DB.raw.exec("INSERT INTO users (id, email) VALUES ('user_1', 'a@example.com')");
  const env = { DB, UNSUBSCRIBE_SECRET: SECRET };
  const token = await signWelcomeToken(SECRET, 'user_1');
  assert.equal((await post('/api/welcome', { token: 'x.y', trip_length: '7-10' }, env)).status, 400);
  assert.equal((await post('/api/welcome', { token: await signWelcomeToken('other', 'user_1'), trip_length: '7-10' }, env)).status, 400);
  assert.equal((await post('/api/welcome', { token, trip_length: 'forever' }, env)).status, 400);
  assert.equal((await post('/api/welcome', '{not json', env)).status, 400);
  assert.equal((await post('/api/welcome', { token, trip_length: 'weekend' }, { DB })).status, 400, 'no secret configured: nothing verifies');
  assert.equal(DB.raw.prepare("SELECT trip_length AS t FROM users WHERE id = 'user_1'").get().t, '7-10', 'nothing was written by the refused requests');
  assert.equal((await post('/api/welcome', { token, trip_length: 'weekend', passenger_count: 47 }, env)).status, 200);
  assert.equal(DB.raw.prepare("SELECT passenger_count AS p FROM users WHERE id = 'user_1'").get().p, 9);
  assert.equal((await post('/api/welcome', { token, trip_length: 'weekend', passenger_count: 'abc' }, env)).status, 200);
  assert.equal(DB.raw.prepare("SELECT passenger_count AS p FROM users WHERE id = 'user_1'").get().p, 1);
  const old = makeD1(false);
  old.raw.exec("INSERT INTO users (id, email) VALUES ('user_1', 'a@example.com')");
  assert.equal((await post('/api/welcome', { token, trip_length: '4-6', passenger_count: 2 }, { DB: old, UNSUBSCRIBE_SECRET: SECRET })).status, 200);
  assert.equal(old.raw.prepare("SELECT trip_length AS t FROM users WHERE id = 'user_1'").get().t, '4-6');
});

test('welcome.html is private, keeps the token out of referrers, asks the two questions, posts to the API and carries the shared header', () => {
  const html = read('welcome.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /name="trip_length"/);
  assert.match(html, /name="passenger_count"/);
  assert.match(html, /fetch\('\/api\/welcome'/);
  assert.match(html, /class="site-nav sf-nav"/);
  assert.match(read('robots.txt'), /Disallow: \/welcome/);
  assert.doesNotMatch(read('sitemap.xml'), /\/welcome/);
});

test('the homepage signup is an email and the carried airport, labelled with the airport, and no longer asks trip length or travelers', () => {
  const html = read('index.html');
  const form = html.match(/<form class="signup-form"[\s\S]*?<\/form>/)[0];
  assert.deepEqual([...form.matchAll(/<(input|select)[^>]*name="([^"]+)"/g)].map((m) => m[2]), ['origin_iata', 'email']);
  assert.match(form, /type="hidden" id="origin_iata"/);
  assert.match(form, /Get daily alerts for <span id="signup-origin-label">/);
  assert.doesNotMatch(form, /trip_length|passenger_count|Travelers/);
  assert.match(html, /function syncSignupOrigin\(\)/);
  assert.match(html, /trip_length: '7-10',/);
  assert.doesNotMatch(html, /passenger_count/);
});

test('the homepage order: intro, airport, the fare, the signup, then the sort control and the board; tools, the airport request and promos after the board', () => {
  const html = read('index.html');
  const at = (n) => { const i = html.indexOf(n); assert.ok(i >= 0, 'missing ' + n); return i; };
  const order = ['<div class="home-top">', '<div class="home-intro">', '<section class="origin-bar" aria-labelledby="origin-bar-label">', '<div id="hero-section">', '<section class="signup-panel"', '<section class="origin-bar sort-bar"', '<div id="board-sections">', '<section class="tool-tiles"', '<div class="origin-request" id="origin-request"', '<section class="directory-promo"', '<footer>'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.doesNotMatch(html, /<section class="watchlist-promo"/);
  assert.match(html, /grid-template-areas: "intro" "origin" "hero" "signup"/);
  assert.match(html, /grid-template-areas: "intro hero" "origin hero" "signup hero"/);
});

test('three tool tiles, each with a one-line description', () => {
  const html = read('index.html');
  const tiles = [...html.matchAll(/<a class="tool-tile" href="([^"]+)"><strong>([^<]+)<\/strong><span>([^<]+)<\/span><\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(tiles, [['/check', 'Check a price'], ['/time-off', 'Plan your time off'], ['/leave', 'Leave-ready checklist']]);
});

test("the nearest hub is the closest airport that has a verdict, never the visitor's own, and none when nobody has one", () => {
  const html = read('index.html');
  const a = html.indexOf('const HUB_COORDS');
  const b = html.indexOf('async function hubsWithDeals');
  const c = vm.createContext({});
  vm.runInContext(html.slice(a, b), c);
  const f = vm.runInContext('({ nearestHub, hubDistanceKm, HUB_COORDS, HUB_CITY })', c);
  assert.equal(f.nearestHub('AUS', new Set(['DFW', 'ATL', 'JFK'])), 'DFW');
  assert.equal(f.nearestHub('LAX', new Set(['SFO', 'LAS', 'JFK'])), 'LAS');
  assert.equal(f.nearestHub('AUS', new Set(['AUS'])), null);
  assert.equal(f.nearestHub('AUS', new Set()), null);
  assert.equal(f.nearestHub('TLV', new Set(['JFK'])), null, 'an airport with no coordinates gets no suggestion');
  assert.ok(Math.abs(f.hubDistanceKm('JFK', 'LAX') - 3970) < 60, 'great-circle New York to Los Angeles is about 3,970 km');
  assert.deepEqual(Object.keys(f.HUB_COORDS).sort(), Object.keys(f.HUB_CITY).sort());
  assert.equal(Object.keys(f.HUB_COORDS).length, 22);
  assert.match(html, /No verdicts from ' \+ origin \+ ' yet\. Nearest hub with deals: ' \+ best/);
  assert.match(html, /a different airport/);
});
