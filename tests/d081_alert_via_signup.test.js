// D-081: homepage "Create alert" via Clerk sign-up, built dark (ENABLE_ALERT_VIA_SIGNUP, default "false").
// Worker routes run against a real in-memory SQLite D1 with a real signed JWT (same technique as leave_answers_prefs); the browser script is
// run with a small fake window. Flag off must leave today's email form and /api/signup untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleRequest, subscribeFromAccount, alertViaSignupEnabled } from '../src/index.js';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// The browser file is a classic script (the repo is type: module), so run it the way a browser would and take its exports.
const via = (() => { const m = { exports: {} }; vm.runInNewContext(read('alert-via-signup.js'), { module: m, setTimeout, Promise, JSON, Date, RegExp, String, encodeURIComponent }); return m.exports; })();

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' });
function jwtFor(sub) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b({ alg: 'RS256', typ: 'JWT', kid: 'test' });
  const pay = b({ sub, sid: 'sess_1', iat: now, nbf: now - 5, exp: now + 600, iss: 'https://clerk.test' });
  return `${head}.${pay}.${crypto.sign('RSA-SHA256', Buffer.from(`${head}.${pay}`), privateKey).toString('base64url')}`;
}
const migrations = () => fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
function makeDb() {
  const d1 = makeSqliteD1([]);
  d1.raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, verified_email INTEGER DEFAULT 0, origin_iata TEXT,
    passenger_count INTEGER DEFAULT 1, trip_length TEXT, subscription_tier TEXT DEFAULT 'free', created_at TEXT DEFAULT (datetime('now')),
    unsubscribed_at TEXT, is_subscribed INTEGER DEFAULT 1, referred_by TEXT, early_access INTEGER DEFAULT 0);
    CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')));`);
  return d1;
}
const env = (d1, extra = {}) => ({ DB: d1, CLERK_SECRET_KEY: 'sk_test_x', CLERK_JWT_KEY: PEM, ENABLE_ALERT_VIA_SIGNUP: 'true', ...extra });
const call = (e, path, { method = 'GET', body, sub } = {}) => handleRequest(new Request(`https://sparkfare.com${path}`, {
  method, headers: { 'content-type': 'application/json', ...(sub ? { authorization: `Bearer ${jwtFor(sub)}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
}), e, { waitUntil() {} });
const one = (d1, sql, ...p) => d1.raw.prepare(sql).get(...p);

test('the flag defaults to "false" in wrangler.jsonc and only the exact string "true" turns it on', () => {
  assert.match(read('wrangler.jsonc'), /"ENABLE_ALERT_VIA_SIGNUP":\s*"false"/);
  for (const v of [undefined, '', 'false', 'TRUE', 'True', '1', true, 'yes']) assert.equal(alertViaSignupEnabled({ ENABLE_ALERT_VIA_SIGNUP: v }), false, String(v));
  assert.equal(alertViaSignupEnabled({ ENABLE_ALERT_VIA_SIGNUP: 'true' }), true);
  assert.equal(alertViaSignupEnabled(undefined), false);
});

test('GET /api/alert-via-signup answers the flag, never cached', async () => {
  for (const [value, expected] of [['true', true], ['false', false], [undefined, false], ['TRUE', false]]) {
    const res = await call({ ENABLE_ALERT_VIA_SIGNUP: value }, '/api/alert-via-signup');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { enabled: expected });
  }
});

test('POST /api/alert-subscribe: 404 for everyone while the flag is off, 405 for a GET, 401 without a session', async () => {
  const d1 = makeDb();
  d1.raw.prepare("INSERT INTO users (id, email) VALUES ('user_a', 'a@example.com')").run();
  for (const flag of ['false', undefined, 'TRUE']) {
    const res = await call(env(d1, { ENABLE_ALERT_VIA_SIGNUP: flag }), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'LAX' }, sub: 'user_a' });
    assert.equal(res.status, 404);
  }
  assert.equal((await call(env(d1), '/api/alert-subscribe')).status, 405);
  assert.equal((await call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'LAX' } })).status, 401);
  assert.equal(one(d1, 'SELECT origin_iata FROM users WHERE id = ?', 'user_a').origin_iata, null, 'nothing written');
});

test('a signed-in visitor is subscribed: airport, verified, re-subscribed, default length, and a consent_log row', async () => {
  const d1 = makeDb();
  d1.raw.prepare("INSERT INTO users (id, email, verified_email, is_subscribed, unsubscribed_at) VALUES ('user_a', 'a@example.com', 0, 0, '2026-10-01')").run();
  const res = await call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'lax', email: 'evil@example.com' }, sub: 'user_a' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.email, 'a@example.com', 'the account email is used; a body email is ignored');
  const u = one(d1, 'SELECT * FROM users WHERE id = ?', 'user_a');
  assert.deepEqual({ o: u.origin_iata, v: u.verified_email, s: u.is_subscribed, un: u.unsubscribed_at, t: u.trip_length }, { o: 'LAX', v: 1, s: 1, un: null, t: '7-10' });
  assert.equal(one(d1, 'SELECT count(*) c FROM users').c, 1);
  const c = one(d1, 'SELECT * FROM consent_log');
  assert.equal(c.user_id, 'user_a');
  assert.equal(c.email, 'a@example.com');
  assert.equal(c.source, 'alert_via_signup');
  assert.equal(c.wording_version, 'v2_account_signup');
  assert.match(c.ip_hash, /^[0-9a-f]{64}$/);
});

test('a saved trip length is kept; an invalid airport is a 400 and writes nothing', async () => {
  const d1 = makeDb();
  d1.raw.prepare("INSERT INTO users (id, email, trip_length) VALUES ('user_a', 'a@example.com', 'weekend')").run();
  assert.equal((await call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'XXX' }, sub: 'user_a' })).status, 400);
  assert.equal(one(d1, "SELECT count(*) c FROM sqlite_master WHERE name = 'consent_log'").c, 0, 'rejected before anything is written');
  assert.equal((await call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'SEA' }, sub: 'user_a' })).status, 200);
  assert.equal(one(d1, 'SELECT trip_length FROM users').trip_length, 'weekend');
});

test('a brand-new Clerk user gets a row; an email-only local_* row for the same address is merged, not duplicated', async () => {
  const fresh = makeDb();
  const session = { authenticated: true, user: { id: 'user_new', email: null } };
  const r1 = await subscribeFromAccount(env(fresh), session, 'JFK', { lookupEmail: async () => 'new@example.com' });
  assert.equal(r1.ok, true);
  assert.deepEqual({ ...one(fresh, 'SELECT id, email, origin_iata, verified_email FROM users') }, { id: 'user_new', email: 'new@example.com', origin_iata: 'JFK', verified_email: 1 });

  const d1 = makeSqliteD1(migrations());
  d1.raw.prepare("INSERT INTO users (id, email, origin_iata, verified_email) VALUES ('local_1', 'dup@example.com', 'ORD', 0)").run();
  const r2 = await subscribeFromAccount(env(d1), { authenticated: true, user: { id: 'user_dup', email: null } }, 'ORD', { lookupEmail: async () => 'dup@example.com' });
  assert.equal(r2.ok, true);
  assert.equal(one(d1, "SELECT count(*) c FROM users WHERE email = 'dup@example.com'").c, 1);
  assert.deepEqual({ ...one(d1, "SELECT id, verified_email FROM users WHERE email = 'dup@example.com'") }, { id: 'user_dup', verified_email: 1 });
});

test('if the consent row cannot be written, nothing is half done: the airport is not changed and ok is false', async () => {
  const d1 = makeDb();
  d1.raw.prepare("INSERT INTO users (id, email, origin_iata, verified_email) VALUES ('user_a', 'a@example.com', 'JFK', 0)").run();
  const broken = { ...d1, prepare: d1.prepare, batch: async (statements) => d1.batch([statements[0], { sql: 'INSERT INTO no_such_table VALUES (1)', params: [] }]) };
  const result = await subscribeFromAccount({ DB: broken }, { authenticated: true, user: { id: 'user_a', email: null } }, 'LAX');
  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(one(d1, 'SELECT origin_iata FROM users').origin_iata, 'JFK');
  assert.equal(one(d1, 'SELECT verified_email v FROM users').v, 0);
});

// ---- browser script ----
function fakeWin({ answer, fetchThrows = false, session = null, ok = true, intent = null } = {}) {
  const calls = { fetch: [], href: null, classes: [] };
  const store = new Map(intent ? [[via.INTENT_KEY, JSON.stringify(intent)]] : []);
  const el = () => ({ style: {}, setAttribute() {}, insertAdjacentElement() {}, appendChild() {}, textContent: '', className: '' });
  const win = {
    document: { documentElement: { classList: { add: (c) => calls.classes.push(c) } }, head: el(), createElement: el, getElementById: () => null },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    location: { origin: 'https://sparkfare.com', pathname: '/', search: '?utm_source=x', set href(v) { calls.href = v; } },
    loadClerk: async () => (session ? { session: { getToken: async () => 'tok' } } : { session: null }),
    fetch: async (url, opts) => {
      calls.fetch.push({ url, opts });
      if (url === '/api/alert-via-signup') { if (fetchThrows) throw new Error('down'); return { ok, json: async () => answer }; }
      return { ok: true, json: async () => ({ ok: true, user: { email: 'a@example.com' } }) };
    },
  };
  return { win, calls, store };
}

test('script: it changes nothing unless the answer is exactly {enabled: true}', async () => {
  for (const opts of [{ answer: { enabled: false } }, { answer: { enabled: 'true' } }, { answer: {} }, { answer: null }, { answer: { enabled: true }, ok: false }, { fetchThrows: true }]) {
    const { win, calls } = fakeWin(opts);
    assert.equal(await via.start(win), false);
    assert.deepEqual(calls.classes, [], 'the page is untouched');
    assert.equal(win.sparkfareHomeSignup, undefined);
  }
  const on = fakeWin({ answer: { enabled: true } });
  assert.equal(await via.start(on.win), true);
  assert.deepEqual(on.calls.classes, ['alert-via-signup']);
  assert.equal(typeof on.win.sparkfareHomeSignup, 'function');
});

test('script: the status answer is requested on every load with no caching and nothing is stored about it', async () => {
  const { win, calls } = fakeWin({ answer: { enabled: false } });
  await via.start(win);
  assert.equal(calls.fetch[0].url, '/api/alert-via-signup');
  assert.equal(calls.fetch[0].opts.cache, 'no-store');
  const src = read('alert-via-signup.js');
  assert.ok(!/sessionStorage/.test(src), 'no remembered answer');
  assert.ok(/data\.enabled === true/.test(src));
});

test('script: signed out goes to Clerk sign-up with only the current page as the return URL and the airport kept', async () => {
  const { win, calls, store } = fakeWin({ answer: { enabled: true } });
  await via.start(win);
  await win.sparkfareHomeSignup({ email: 'ignored@example.com', origin: 'lax', statusEl: { textContent: '' } });
  assert.equal(calls.href, 'https://accounts.sparkfare.com/sign-up?redirect_url=' + encodeURIComponent('https://sparkfare.com/?utm_source=x'));
  assert.equal(calls.fetch.filter((c) => c.url === '/api/alert-subscribe').length, 0);
  assert.equal(JSON.parse(store.get(via.INTENT_KEY)).origin, 'LAX');
  assert.ok(!store.get(via.INTENT_KEY).includes('ignored@example.com'), 'the typed email is never stored');
});

test('script: signed in subscribes directly with the bearer token and only the airport, no redirect', async () => {
  const { win, calls } = fakeWin({ answer: { enabled: true }, session: true });
  await via.start(win);
  await win.sparkfareHomeSignup({ email: 'ignored@example.com', origin: 'SEA', statusEl: { textContent: '' } });
  const sub = calls.fetch.find((c) => c.url === '/api/alert-subscribe');
  assert.equal(sub.opts.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(sub.opts.body), { origin_iata: 'SEA' });
  assert.equal(calls.href, null);
});

test('script: back from Clerk with a saved airport subscribes once, then forgets it; an old or damaged value is ignored', async () => {
  const fresh = fakeWin({ answer: { enabled: true }, session: true, intent: { origin: 'ORD', t: Date.now() } });
  await via.start(fresh.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(fresh.calls.fetch.filter((c) => c.url === '/api/alert-subscribe').length, 1);
  assert.equal(fresh.store.has(via.INTENT_KEY), false);
  const old = fakeWin({ answer: { enabled: true }, session: true, intent: { origin: 'ORD', t: Date.now() - via.INTENT_TTL_MS - 1 } });
  await via.start(old.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(old.calls.fetch.filter((c) => c.url === '/api/alert-subscribe').length, 0);
  const store = new Map([[via.INTENT_KEY, '{bad json']]);
  assert.equal(via.readIntent({ getItem: (k) => store.get(k) }, Date.now()), null);
});

test('script: the beside-button line is the proposed string with the airport (pending the Hub Guard read)', () => {
  assert.equal(via.noteText('JFK'), 'Free account. At most one fare email a day, with fares from JFK. Unsubscribe any time.');
});

// ---- flag off must leave today's page alone ----
test('index.html keeps today\'s email form and posts to /api/signup; only the hero handler indirection and the script tag were added', () => {
  const html = read('index.html');
  assert.ok(html.includes('<button type="submit">Create alert</button>'));
  assert.ok(html.includes('<input id="email" name="email" type="email"'));
  assert.ok(html.includes("fetch('/api/signup'"));
  assert.ok(html.includes('(window.sparkfareHomeSignup || submitHomeSignup)('));
  assert.ok(html.includes('window.sparkfareHomeSignup = submitHomeSignup;'));
  assert.equal(html.split('<script src="/alert-via-signup.js" defer></script>').length - 1, 1);
});

test('the /data/ route pages and other surfaces are not part of this change', () => {
  for (const f of ['check.html', 'leave.html', 'widget.html']) assert.ok(!read(f).includes('alert-via-signup'), f);
  assert.ok(!read('Phase 17 pSEO Generator (Step 106).py').includes('alert-via-signup'));
});
