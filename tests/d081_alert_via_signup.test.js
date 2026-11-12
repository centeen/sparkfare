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
const VERIFIED = async () => true;
// The route tests go through the real handler, which asks Clerk's Backend API whether the address is verified. Stub only that one HTTP call.
// @clerk/backend captures the fetch it first sees, so the stub is installed once and reads mutable state.
const clerkState = { verified: true, email: 'a@example.com' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  if (!url.startsWith('https://api.clerk.com/')) return realFetch(input, init);
  return new Response(JSON.stringify({ object: 'user', id: 'x', primary_email_address_id: 'idn_1', phone_numbers: [], web3_wallets: [], passkeys: [], external_accounts: [], saml_accounts: [], enterprise_accounts: [], email_addresses: [{ id: 'idn_1', email_address: clerkState.email, linked_to: [], verification: { status: clerkState.verified ? 'verified' : 'unverified' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};
async function withClerk({ verified = true, email = 'a@example.com' } = {}, fn) {
  Object.assign(clerkState, { verified, email });
  try { return await fn(); } finally { Object.assign(clerkState, { verified: true, email: 'a@example.com' }); }
}
const WV = 'v2_account_signup';

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
  const res = await withClerk({}, () => call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'lax', email: 'evil@example.com', wording_version: WV }, sub: 'user_a' }));
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
  assert.equal((await withClerk({}, () => call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'XXX', wording_version: WV }, sub: 'user_a' }))).status, 400);
  assert.equal(one(d1, "SELECT count(*) c FROM sqlite_master WHERE name = 'consent_log'").c, 0, 'rejected before anything is written');
  assert.equal((await withClerk({}, () => call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'SEA', wording_version: WV }, sub: 'user_a' }))).status, 200);
  assert.equal(one(d1, 'SELECT trip_length FROM users').trip_length, 'weekend');
});

test('a brand-new Clerk user gets a row; an email-only local_* row for the same address is merged, not duplicated', async () => {
  const fresh = makeDb();
  const session = { authenticated: true, user: { id: 'user_new', email: null } };
  const r1 = await subscribeFromAccount(env(fresh), session, 'JFK', { lookupEmail: async () => 'new@example.com', lookupVerified: VERIFIED });
  assert.equal(r1.ok, true);
  assert.deepEqual({ ...one(fresh, 'SELECT id, email, origin_iata, verified_email FROM users') }, { id: 'user_new', email: 'new@example.com', origin_iata: 'JFK', verified_email: 1 });

  const d1 = makeSqliteD1(migrations());
  d1.raw.prepare("INSERT INTO users (id, email, origin_iata, verified_email) VALUES ('local_1', 'dup@example.com', 'ORD', 0)").run();
  const r2 = await subscribeFromAccount(env(d1), { authenticated: true, user: { id: 'user_dup', email: null } }, 'ORD', { lookupEmail: async () => 'dup@example.com', lookupVerified: VERIFIED });
  assert.equal(r2.ok, true);
  assert.equal(one(d1, "SELECT count(*) c FROM users WHERE email = 'dup@example.com'").c, 1);
  assert.deepEqual({ ...one(d1, "SELECT id, verified_email FROM users WHERE email = 'dup@example.com'") }, { id: 'user_dup', verified_email: 1 });
});

test('if the consent row cannot be written, nothing is half done: the airport is not changed and ok is false', async () => {
  const d1 = makeDb();
  d1.raw.prepare("INSERT INTO users (id, email, origin_iata, verified_email) VALUES ('user_a', 'a@example.com', 'JFK', 0)").run();
  const broken = { ...d1, prepare: d1.prepare, batch: async (statements) => d1.batch([statements[0], { sql: 'INSERT INTO no_such_table VALUES (1)', params: [] }]) };
  const result = await subscribeFromAccount({ DB: broken }, { authenticated: true, user: { id: 'user_a', email: null } }, 'LAX', { lookupVerified: VERIFIED });
  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(one(d1, 'SELECT origin_iata FROM users').origin_iata, 'JFK');
  assert.equal(one(d1, 'SELECT verified_email v FROM users').v, 0);
});

// ---- browser script ----
function fakeWin({ answer, fetchThrows = false, session = null, ok = true, intent = null, createdAgoMs = null, label = null, attribution = null } = {}) {
  const calls = { fetch: [], href: null, classes: [], note: null, statusText: [] };
  const store = new Map(intent ? [[via.INTENT_KEY, JSON.stringify(intent)]] : []);
  const el = () => ({ style: {}, setAttribute() {}, insertAdjacentElement(_p, n) { calls.note = n; }, appendChild() {}, textContent: '', className: '' });
  const status = { textContent: '', className: '' };
  const win = {
    document: { documentElement: { classList: { add: (c) => calls.classes.push(c) } }, head: el(), createElement: el,
      getElementById: (id) => (id === 'signup-status' ? status : id === 'signup-form' && label !== null ? el() : id === 'signup-origin-label' && label !== null ? { textContent: label } : null) },
    sessionStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    get localStorage() { throw new Error('localStorage must not be used'); },
    location: { origin: 'https://sparkfare.com', pathname: '/', search: '?utm_source=x&ref=abc&origin=SEA', set href(v) { calls.href = v; } },
    loadClerk: async () => (session ? { session: { getToken: async () => 'tok' }, user: { createdAt: createdAgoMs === null ? new Date(0) : new Date(Date.now() - createdAgoMs) } } : { session: null }),
    fetch: async (url, opts) => {
      calls.fetch.push({ url, opts });
      if (url === '/api/alert-via-signup') { if (fetchThrows) throw new Error('down'); return { ok, json: async () => answer }; }
      return { ok: true, json: async () => ({ ok: true, user: { email: 'a@example.com' } }) };
    },
  };
  if (attribution) { win.sparkfareAttribution = () => attribution; win.sparkfareUtm = () => 'launch_nov7'; }
  return { win, calls, store, status };
}
const subscribeCalls = (calls) => calls.fetch.filter((c) => c.url === '/api/alert-subscribe');

test('script: the status answer is requested on every load with no caching and the answer itself is never stored', async () => {
  const { win, calls, store } = fakeWin({ answer: { enabled: false } });
  await via.start(win);
  assert.equal(calls.fetch[0].url, '/api/alert-via-signup');
  assert.equal(calls.fetch[0].opts.cache, 'no-store');
  assert.equal(store.size, 0);
  const src = read('alert-via-signup.js');
  assert.ok(!/localStorage/.test(src), 'intent lives in sessionStorage only (D-079 / handoff rule)');
  assert.ok(/data\.enabled === true/.test(src));
});

test('script: signed out goes to Clerk sign-up; the return URL is the page plus at most ?origin=XXX, nothing else; the airport is kept in this tab only', async () => {
  const { win, calls, store } = fakeWin({ answer: { enabled: true } });
  await via.start(win);
  await win.sparkfareHomeSignup({ email: 'ignored@example.com', origin: 'lax', statusEl: { textContent: '' } });
  assert.equal(calls.href, 'https://accounts.sparkfare.com/sign-up?redirect_url=' + encodeURIComponent('https://sparkfare.com/?origin=LAX'));
  assert.ok(!decodeURIComponent(calls.href).includes('utm_source') && !decodeURIComponent(calls.href).includes('ref='), 'no other parameter is carried');
  assert.equal(subscribeCalls(calls).length, 0);
  assert.equal(JSON.parse(store.get(via.INTENT_KEY)).origin, 'LAX');
  assert.ok(!store.get(via.INTENT_KEY).includes('ignored@example.com'), 'the typed email is never stored');
  assert.equal(via.signUpUrl({ origin: 'https://sparkfare.com', pathname: '/' }, 'not-a-code'), 'https://accounts.sparkfare.com/sign-up?redirect_url=' + encodeURIComponent('https://sparkfare.com/'));
});

test('script: signed in subscribes directly (no redirect) with the bearer token, the airport, the wording version and the same channel tags the email form carries', async () => {
  const { win, calls } = fakeWin({ answer: { enabled: true }, session: true, attribution: { channel: 'hackernews', campaign: 'launch', referrer_class: 'social', medium: 'post' } });
  await via.start(win);
  await win.sparkfareHomeSignup({ email: 'ignored@example.com', origin: 'SEA', statusEl: { textContent: '' } });
  const sub = subscribeCalls(calls)[0];
  assert.equal(sub.opts.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(sub.opts.body), { origin_iata: 'SEA', wording_version: 'v2_account_signup', channel: 'hackernews', campaign: 'launch', referrer_class: 'social', medium: 'post', utm: 'launch_nov7' });
  assert.equal(calls.href, null);
  assert.equal(calls.fetch.filter((c) => c.url === '/api/signup').length, 0, 'the email-signup endpoint is never posted to');
});

test('script: back from Clerk with a saved airport subscribes once, then forgets it; an old or damaged value is ignored', async () => {
  const fresh = fakeWin({ answer: { enabled: true }, session: true, intent: { origin: 'ORD', t: Date.now() } });
  await via.start(fresh.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(subscribeCalls(fresh.calls).length, 1);
  assert.equal(fresh.store.has(via.INTENT_KEY), false);
  const old = fakeWin({ answer: { enabled: true }, session: true, intent: { origin: 'ORD', t: Date.now() - via.INTENT_TTL_MS - 1 } });
  await via.start(old.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(subscribeCalls(old.calls).length, 0);
  const store = new Map([[via.INTENT_KEY, '{bad json']]);
  assert.equal(via.readIntent({ getItem: (k) => store.get(k) }, Date.now()), null);
});

test('C3 lost intent: a just-created account with no saved airport subscribes NOBODY and is told once; an old account or a signed-out visitor sees nothing', async () => {
  const lost = fakeWin({ answer: { enabled: true }, session: true, createdAgoMs: 5 * 60 * 1000 });
  await via.start(lost.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(subscribeCalls(lost.calls).length, 0, 'nothing is subscribed');
  assert.equal(lost.status.textContent, via.NOTICE_TEXT);
  lost.status.textContent = '';
  await via.start(lost.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(lost.status.textContent, '', 'shown once per tab session');
  const oldAccount = fakeWin({ answer: { enabled: true }, session: true, createdAgoMs: 3 * 24 * 3600 * 1000 });
  await via.start(oldAccount.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(oldAccount.status.textContent, '');
  assert.equal(subscribeCalls(oldAccount.calls).length, 0);
  const out = fakeWin({ answer: { enabled: true } });
  await via.start(out.win);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(out.status.textContent, '');
});

test('C1 airport slot: no chosen airport renders the existing fallback, never blank or "undefined"', async () => {
  for (const bad of [undefined, null, '', '   ', 'undefined', 'null', 'NYC1', 'J', '<b>', 'JFK; drop']) {
    assert.equal(via.noteText(bad), 'Free account. At most one fare email a day, with fares from your home airport. Unsubscribe any time.', String(bad));
  }
  assert.equal(via.noteText('lax'), 'Free account. At most one fare email a day, with fares from LAX. Unsubscribe any time.');
  for (const [label, expected] of [['', 'your home airport'], ['undefined', 'your home airport'], ['SEA', 'SEA']]) {
    const { win, calls } = fakeWin({ answer: { enabled: true }, label });
    await via.start(win);
    assert.ok(calls.note.textContent.includes('fares from ' + expected + '.'), 'rendered: ' + calls.note.textContent);
    assert.ok(!/undefined|null/.test(calls.note.textContent.replace('your home airport', '')));
  }
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

// ---- Guard conditions (Nov 12): C3 consent record, verification, wording version ----
import { ALERT_VIA_SIGNUP_WORDING_VERSION } from '../src/index.js';

// Every wording that has ever been used keeps its entry. Changing the line means adding a NEW version here, in /alert-via-signup.js and in src/index.js.
const PINNED_WORDINGS = {
  v2_account_signup: 'Free account. At most one fare email a day, with fares from {airport}. Unsubscribe any time.',
};

test('C3 the line beside the button is pinned to its wording_version: change the string without a new version and this fails', () => {
  assert.equal(via.WORDING_VERSION, ALERT_VIA_SIGNUP_WORDING_VERSION, 'the browser and the Worker name the same version');
  assert.ok(PINNED_WORDINGS[via.WORDING_VERSION], 'the current version has a pinned wording');
  assert.equal(via.NOTE_PREFIX + '{airport}' + via.NOTE_SUFFIX, PINNED_WORDINGS[via.WORDING_VERSION]);
  const doc = read('docs/consent_wording_alert_via_signup.md');
  assert.ok(doc.includes('## ' + via.WORDING_VERSION));
  assert.ok(doc.includes(PINNED_WORDINGS[via.WORDING_VERSION]), 'the full wording is on file in docs/consent_wording_alert_via_signup.md');
  assert.ok(doc.includes(via.NOTICE_TEXT));
});

test('C3 a Clerk-unverified address is not subscribed and gets no consent row (403, nothing written)', async () => {
  const d1 = makeDb();
  d1.raw.prepare("INSERT INTO users (id, email, is_subscribed) VALUES ('user_a', 'a@example.com', 0)").run();
  const res = await withClerk({ verified: false }, () => call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'LAX', wording_version: WV }, sub: 'user_a' }));
  assert.equal(res.status, 403);
  assert.deepEqual({ ...one(d1, 'SELECT is_subscribed s, origin_iata o, verified_email v FROM users') }, { s: 0, o: null, v: 0 });
  assert.equal(one(d1, "SELECT count(*) c FROM sqlite_master WHERE name = 'consent_log'").c, 0);
});

test('C3 a missing, old or unknown wording_version is refused (409) and writes nothing, so a cached old script cannot record the wrong wording', async () => {
  for (const wording_version of [undefined, '', 'v1_email_form', 'v3_future']) {
    const d1 = makeDb();
    d1.raw.prepare("INSERT INTO users (id, email, is_subscribed) VALUES ('user_a', 'a@example.com', 0)").run();
    const res = await withClerk({}, () => call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'LAX', wording_version }, sub: 'user_a' }));
    assert.equal(res.status, 409, String(wording_version));
    assert.equal(one(d1, 'SELECT is_subscribed s FROM users').s, 0);
    assert.equal(one(d1, "SELECT count(*) c FROM sqlite_master WHERE name = 'consent_log'").c, 0);
  }
});

test('C3 exactly one consent row per press, with source and the version that maps to the pinned string', async () => {
  const d1 = makeDb();
  d1.raw.prepare("INSERT INTO users (id, email) VALUES ('user_a', 'a@example.com')").run();
  await withClerk({}, () => call(env(d1), '/api/alert-subscribe', { method: 'POST', body: { origin_iata: 'LAX', wording_version: WV }, sub: 'user_a' }));
  const rows = d1.raw.prepare('SELECT source, wording_version FROM consent_log').all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ source: 'alert_via_signup', wording_version: 'v2_account_signup' }]);
});

test('M1: a brand-new account keeps its first-touch channel and launch tag; an existing subscriber\'s attribution is never rewritten', async () => {
  const d1 = makeDb();
  d1.raw.exec('ALTER TABLE users ADD COLUMN signup_channel TEXT; ALTER TABLE users ADD COLUMN signup_campaign TEXT; ALTER TABLE users ADD COLUMN signup_referrer_class TEXT;');
  d1.raw.prepare("INSERT INTO users (id, email, signup_channel) VALUES ('user_old', 'old@example.com', 'search')").run();
  const e = env(d1, { ENABLE_LANDING_COUNTER: 'true' });
  const pending = [];
  const callWait = (sub, email, body) => withClerk({ email }, () => handleRequest(new Request('https://sparkfare.com/api/alert-subscribe', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + jwtFor(sub) }, body: JSON.stringify({ origin_iata: 'LAX', wording_version: WV, ...body }),
  }), e, { waitUntil: (p) => pending.push(p) }).then(async (r) => { await Promise.all(pending); return r; }));
  const tags = { channel: 'hackernews', campaign: 'launch', referrer_class: 'social', medium: 'post', utm: 'launch_nov7' };
  assert.equal((await callWait('user_new', 'new@example.com', tags)).status, 200);
  assert.equal((await callWait('user_old', 'old@example.com', tags)).status, 200);
  assert.deepEqual({ ...one(d1, "SELECT signup_channel c, signup_campaign k, signup_referrer_class r FROM users WHERE id = 'user_new'") }, { c: 'hackernews', k: 'launch', r: 'social' });
  assert.equal(one(d1, "SELECT signup_channel c FROM users WHERE id = 'user_old'").c, 'search');
  const ev = d1.raw.prepare("SELECT source, meta FROM events WHERE event_type = 'signup' AND user_id = 'user_new'").get();
  assert.equal(ev.source, 'home_account');
  assert.deepEqual(JSON.parse(ev.meta), { utm: 'launch_nov7', utm_medium: 'post' });
});

test('email-only surfaces are unchanged and never subscribe through this flow: /check, /leave, /widget, the planner and every /data/ route page post to /api/signup, not /api/alert-subscribe', () => {
  for (const f of ['check.html', 'leave.html', 'widget.html', 'index.html']) assert.ok(!read(f).includes('/api/alert-subscribe'), f);
  assert.ok(!read('src/ptoPages.js').includes('alert-via-signup') && !read('src/ptoPages.js').includes('/api/alert-subscribe'));
  assert.ok(read('alert-via-signup.js').indexOf("'/api/signup'") === -1 && !read('alert-via-signup.js').includes('"/api/signup"'));
  assert.ok(read('Phase 17 pSEO Generator (Step 106).py').includes("fetch('/api/signup'"));
});
