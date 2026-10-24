// N5 (Addendum N): channel attribution and the daily landing counter. Real SQLite with every migration applied.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { computeGrowth } from '../src/growth.js';
import { normalizeAttribution, normalizeLanding, MAX_COMBOS_PER_DAY } from '../src/attribution.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: (p) => { if (p && p.catch) p.catch(() => {}); return p; } };
const settle = () => new Promise((r) => setTimeout(r, 30));
const SRC = fs.readFileSync(new URL('../attribution.js', import.meta.url), 'utf8');
const ON = SRC;
const OFF = SRC.replace('var ENABLED = true;', 'var ENABLED = false;');
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// ---- the browser script -----------------------------------------------------------------------------------------

function browser({ search = '', referrer = '', path = '/', store = {}, blocked = false, src = ON, hostname = 'sparkfare.com' } = {}) {
  const posts = [];
  const win = {};
  win.fetch = (url, init) => { posts.push({ url, init }); return Promise.resolve({ ok: true }); };
  const storage = blocked
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const sandbox = { window: win, document: { referrer }, location: { search, pathname: path, hostname }, sessionStorage: storage, URLSearchParams, URL, fetch: win.fetch };
  vm.runInNewContext(src, sandbox);
  return { win, posts, store, fetchedBody: () => (posts[0] ? JSON.parse(posts[0].init.body) : null) };
}

test('with ENABLED off the script is inert: nothing is stored, sent or wrapped', () => {
  assert.match(OFF, /var ENABLED = false;/);
  const b = browser({ src: OFF, search: '?utm_source=reddit' });
  assert.deepEqual(b.posts, []);
  assert.deepEqual(b.store, {});
  assert.equal(b.win.sparkfareAttribution, undefined);
});

test('channel: utm_source wins, then the referrer class, then direct', () => {
  assert.equal(browser({ search: '?utm_source=ProductHunt&utm_campaign=Launch2026' }).fetchedBody().channel, 'producthunt');
  assert.equal(browser({ search: '?utm_source=ProductHunt&utm_campaign=Launch2026' }).fetchedBody().campaign, 'launch2026');
  assert.equal(browser({ referrer: 'https://www.google.com/search?q=cheap+flights' }).fetchedBody().channel, 'search');
  assert.equal(browser({ referrer: 'https://news.ycombinator.com/item?id=1' }).fetchedBody().channel, 'social');
  assert.equal(browser({ referrer: 'https://t.co/abc' }).fetchedBody().channel, 'social');
  assert.equal(browser({ referrer: 'https://mail.google.com/mail/u/0/' }).fetchedBody().channel, 'email');
  assert.equal(browser({ referrer: 'https://some-travel-blog.example/post' }).fetchedBody().channel, 'other_site');
  assert.equal(browser({}).fetchedBody().channel, 'direct');
});

test('a self-referral is direct, and a tagged link keeps its referrer class separately', () => {
  assert.equal(browser({ referrer: 'https://sparkfare.com/blog/' }).fetchedBody().channel, 'direct');
  assert.equal(browser({ referrer: 'https://www.sparkfare.com/' }).fetchedBody().referrer_class, 'direct');
  const b = browser({ search: '?utm_source=newsletter', referrer: 'https://mail.google.com/' }).fetchedBody();
  assert.equal(b.channel, 'newsletter');
  assert.equal(b.referrer_class, 'email');
});

test('page class by path', () => {
  const cls = (path) => browser({ path }).fetchedBody().page_class;
  assert.equal(cls('/'), 'home');
  assert.equal(cls('/flight/JFK/Bali,%20Indonesia'), 'route');
  assert.equal(cls('/data/jfk-to-prague-czechia'), 'route');
  assert.equal(cls('/check'), 'check');
  assert.equal(cls('/time-off/jfk'), 'pto');
  assert.equal(cls('/reports/holiday-2026'), 'report');
  assert.equal(cls('/blog/how-we-rank-deals'), 'other');
});

test('one count per session; first touch is kept; the request carries nothing else', () => {
  const store = {};
  const first = browser({ search: '?utm_source=hackernews', store });
  assert.equal(first.posts.length, 1);
  assert.deepEqual(Object.keys(first.fetchedBody()).sort(), ['campaign', 'channel', 'page_class', 'referrer_class']);
  assert.equal(first.posts[0].url, '/api/landing');
  assert.equal(first.posts[0].init.credentials, 'omit');
  const second = browser({ search: '?utm_source=reddit', path: '/check', store });
  assert.equal(second.posts.length, 0, 'a second page in the same session is not another landing');
  assert.equal(second.win.sparkfareAttribution().channel, 'hackernews', 'first touch wins');
});

test('blocked sessionStorage: an outside arrival is counted, an internal page view is not', () => {
  assert.equal(browser({ blocked: true, referrer: 'https://www.google.com/' }).posts.length, 1);
  assert.equal(browser({ blocked: true, referrer: 'https://sparkfare.com/check' }).posts.length, 0);
});

test('values are cleaned and capped before they leave the browser', () => {
  const b = browser({ search: `?utm_source=${'A'.repeat(60)}&utm_campaign=%3Cscript%3E${'b'.repeat(40)}` }).fetchedBody();
  assert.ok(b.channel.length <= 20 && b.campaign.length <= 16);
  assert.ok(!/[<>]/.test(b.campaign));
});

test('no cookie, no storage of the referrer address, no third party', () => {
  assert.doesNotMatch(SRC, /document\.cookie|localStorage|XMLHttpRequest|https?:\/\//);
  const b = browser({ referrer: 'https://www.google.com/search?q=secret+trip+to+paris' });
  assert.ok(!JSON.stringify(b.store).includes('secret') && !JSON.stringify(b.posts).includes('secret'));
});

test('a signup picks up the channel without editing the form; an existing channel is left alone; other requests pass through', async () => {
  const b = browser({ search: '?utm_source=producthunt&utm_campaign=launch2026' });
  const real = [];
  b.win.fetch = null; // replaced below to capture what the wrapper forwards
  const sandbox = { window: { fetch: (u, i) => { real.push({ u, i }); return Promise.resolve({}); } }, document: { referrer: '' }, location: { search: '?utm_source=producthunt&utm_campaign=launch2026', pathname: '/', hostname: 'sparkfare.com' }, sessionStorage: { getItem: () => null, setItem: () => {} }, URLSearchParams, URL };
  sandbox.fetch = sandbox.window.fetch;
  vm.runInNewContext(ON, sandbox);
  await sandbox.window.fetch('/api/landing', { method: 'POST', body: '{}' }); // the script's own count
  real.length = 0;
  await sandbox.window.fetch('/api/signup', { method: 'POST', body: JSON.stringify({ email: 'x@example.com' }) });
  const sent = JSON.parse(real[0].i.body);
  assert.equal(sent.email, 'x@example.com');
  assert.equal(sent.channel, 'producthunt');
  assert.equal(sent.campaign, 'launch2026');
  real.length = 0;
  await sandbox.window.fetch('/api/signup', { method: 'POST', body: JSON.stringify({ email: 'y@example.com', channel: 'widget' }) });
  assert.equal(JSON.parse(real[0].i.body).channel, 'widget');
  real.length = 0;
  await sandbox.window.fetch('/api/other', { method: 'POST', body: JSON.stringify({ a: 1 }) });
  assert.equal(real[0].i.body, JSON.stringify({ a: 1 }));
  real.length = 0;
  await sandbox.window.fetch('/api/signup', { method: 'POST', body: 'not json' });
  assert.equal(real[0].i.body, 'not json', 'a body that is not JSON is never touched');
});

// ---- the Worker ---------------------------------------------------------------------------------------------------

const land = (DB, body, { env = {}, ua = BROWSER } = {}) => worker.fetch(new Request('https://sparkfare.com/api/landing', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': ua }, body: typeof body === 'string' ? body : JSON.stringify(body),
}), { DB, ENABLE_LANDING_COUNTER: 'true', ...env }, ctx);
const rows = (DB) => DB.raw.prepare('SELECT date, channel, campaign, page_class, count FROM landings_daily ORDER BY channel, page_class').all();
const L = { channel: 'producthunt', campaign: 'launch2026', referrer_class: 'social', page_class: 'home' };

test('a landing adds 1 to a daily row; the same row again adds another; the answer is always 204', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  assert.equal((await land(DB, L)).status, 204);
  assert.equal((await land(DB, L)).status, 204);
  await land(DB, { ...L, page_class: 'check' });
  await settle();
  const r = rows(DB);
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.page_class === 'home').count, 2);
  assert.equal(r[0].date, new Date().toISOString().slice(0, 10));
});

test('while the flag is off nothing is counted, and the answer is the same', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  assert.equal((await land(DB, L, { env: { ENABLE_LANDING_COUNTER: 'false' } })).status, 204);
  assert.equal((await land(DB, L, { env: { ENABLE_LANDING_COUNTER: undefined } })).status, 204);
  await settle();
  assert.deepEqual(rows(DB), []);
});

test('bots and requests with no user agent are not counted', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.4.0', 'python-requests/2.31', 'Slackbot-LinkExpanding 1.0', '']) await land(DB, L, { ua });
  await settle();
  assert.deepEqual(rows(DB), []);
});

test('bad values are dropped, never stored', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  for (const body of [{ ...L, page_class: 'admin' }, { ...L, channel: '' }, {}, '{not json', JSON.stringify({ ...L, junk: 'x'.repeat(5000) }), '[]', 'null']) await land(DB, body);
  await settle();
  assert.deepEqual(rows(DB), []);
  assert.equal(normalizeLanding({ ...L, channel: 'Reddit<script>' }).channel, 'redditscript');
  assert.equal(normalizeAttribution({ channel: 'x', referrer_class: 'bogus' }).referrer_class, null);
});

test('a flood of made-up channels cannot grow the table past the daily cap', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  for (let i = 0; i < MAX_COMBOS_PER_DAY + 25; i++) await land(DB, { ...L, channel: `c${i}`, campaign: '' });
  await settle();
  assert.equal(rows(DB).length, MAX_COMBOS_PER_DAY);
  await land(DB, { ...L, channel: 'c0', campaign: '' }); // an existing combination still counts
  await settle();
  assert.equal(rows(DB).find((r) => r.channel === 'c0').count, 2);
});

test('the table holds no IP address, user agent or identifier', () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const cols = DB.raw.prepare("PRAGMA table_info('landings_daily')").all().map((c) => c.name);
  assert.deepEqual(cols, ['date', 'channel', 'campaign', 'page_class', 'count']);
});

// ---- signups ----------------------------------------------------------------------------------------------------

const signup = (DB, email, extra = {}, env = {}) => worker.fetch(new Request('https://sparkfare.com/api/signup', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: `local_${email}`, email, origin_iata: 'JFK', trip_length: '7-10', source: 'check', ...extra }),
}), { DB, ENABLE_LANDING_COUNTER: 'true', ...env }, ctx);
const user = (DB, email) => DB.raw.prepare('SELECT signup_source, signup_channel, signup_campaign, signup_referrer_class FROM users WHERE email = ?').get(email);

test('a new signup stores the channel next to its unchanged surface; a resubmit never overwrites it', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  assert.equal((await signup(DB, 'a@example.com', { channel: 'producthunt', campaign: 'launch2026', referrer_class: 'social' })).status, 200);
  await settle();
  assert.deepEqual({ ...user(DB, 'a@example.com') }, { signup_source: 'check', signup_channel: 'producthunt', signup_campaign: 'launch2026', signup_referrer_class: 'social' });
  await signup(DB, 'a@example.com', { channel: 'reddit', campaign: 'later', referrer_class: 'social', source: 'home' });
  await settle();
  assert.equal(user(DB, 'a@example.com').signup_channel, 'producthunt', 'first touch');
  assert.equal(user(DB, 'a@example.com').signup_campaign, 'launch2026');
});

test('a signup without a channel, or with the flag off, stores none and still succeeds', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  assert.equal((await signup(DB, 'b@example.com')).status, 200);
  assert.equal((await signup(DB, 'c@example.com', { channel: 'reddit' }, { ENABLE_LANDING_COUNTER: 'false' })).status, 200);
  await settle();
  assert.equal(user(DB, 'b@example.com').signup_channel, null);
  assert.equal(user(DB, 'c@example.com').signup_channel, null);
});

test('M1 still holds: the surface (signup_source) is unchanged by the channel', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await signup(DB, 'd@example.com', { channel: 'reddit', source: 'pto' });
  await settle();
  assert.equal(user(DB, 'd@example.com').signup_source, 'pto');
  assert.equal(user(DB, 'd@example.com').signup_channel, 'reddit');
});

test('a database without the new columns never fails a signup', async () => {
  const DB = makeSqliteD1(MIGRATIONS.filter((f) => !f.includes('0032')));
  assert.equal((await signup(DB, 'e@example.com', { channel: 'reddit' })).status, 200);
});

// ---- the admin report ---------------------------------------------------------------------------------------------

test('/admin growth shows landings, signups, confirmations and both rates per channel, and the caveat', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  for (let i = 0; i < 20; i++) await land(DB, L);
  await land(DB, { ...L, channel: 'search', referrer_class: 'search', campaign: '' });
  await signup(DB, 'p1@example.com', { channel: 'producthunt', campaign: 'launch2026', referrer_class: 'social' });
  await signup(DB, 'p2@example.com', { channel: 'producthunt', campaign: 'launch2026', referrer_class: 'social' });
  await signup(DB, 'old@example.com'); // from before the counter: no channel
  await settle();
  DB.raw.prepare("UPDATE users SET verified_email = 1 WHERE email = 'p1@example.com'").run();
  const g = await computeGrowth({ DB });
  const ph = g.by_channel.last7.find((r) => r.channel === 'producthunt');
  assert.deepEqual({ landings: ph.landings, signups: ph.signups, confirmed: ph.confirmed, l2s: ph.landing_to_signup, conf: ph.confirm_rate }, { landings: 20, signups: 2, confirmed: 1, l2s: 10, conf: 50 });
  assert.equal(g.by_channel.last7.find((r) => r.channel === 'unknown').signups, 1);
  assert.equal(g.by_channel.last7.find((r) => r.channel === 'search').landings, 1);
  assert.match(g.by_channel_note, /upper bound/);
  assert.ok(!JSON.stringify(g.by_channel).includes('example.com'), 'counts only');
});

test('the admin page itself still needs the secret and renders the channel table', async () => {
  const page = await worker.fetch(new Request('https://sparkfare.com/admin/growth'), {}, ctx);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /By channel, last 7 days/);
  const data = await worker.fetch(new Request('https://sparkfare.com/admin/growth/data'), { ADMIN_SECRET: 's3cret' }, ctx);
  assert.equal(data.status, 401);
});

// ---- wiring ---------------------------------------------------------------------------------------------------------

test('the two switches agree, and the counter is only on together with the approved privacy wording', () => {
  const flag = /"ENABLE_LANDING_COUNTER": "(true|false)"/.exec(fs.readFileSync('wrangler.jsonc', 'utf8'))[1] === 'true';
  const script = /var ENABLED = (true|false);/.exec(SRC)[1] === 'true';
  assert.equal(flag, script, 'ENABLE_LANDING_COUNTER and ENABLED in attribution.js must be switched together');
  const privacy = fs.readFileSync('privacy.html', 'utf8');
  if (flag) {
    for (const phrase of ['We also count visits as daily totals', 'your browser keeps a short note for that tab, deleted when you close it', 'stores no IP address, cookie or identifier and is never linked to you', 'once, next to your email address']) {
      assert.ok(privacy.includes(phrase), 'the counter is on but privacy.html lacks: ' + phrase);
    }
  }
  const h = fs.readFileSync('brand/header.js', 'utf8');
  assert.match(h, /s\.src = '\/attribution\.js'/);
  assert.match(fs.readFileSync('src/siteHeader.js', 'utf8'), /\/brand\/header\.js/);
});

test('the migration only adds: three columns on users and one new table', () => {
  const sql = fs.readFileSync('migrations/0032_channel_attribution.sql', 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /DROP|DELETE|UPDATE/i);
  assert.equal((sql.match(/ALTER TABLE users ADD COLUMN/g) || []).length, 3);
  assert.equal((sql.match(/CREATE TABLE IF NOT EXISTS landings_daily/g) || []).length, 1);
});

test('storing a channel twice for the same user keeps the first (the UPDATE itself refuses a second write)', async () => {
  const { storeSignupAttribution } = await import('../src/attribution.js');
  const DB = makeSqliteD1(MIGRATIONS);
  DB.raw.prepare("INSERT INTO users (id, email) VALUES ('u1', 'u1@example.com')").run();
  const env = { DB, ENABLE_LANDING_COUNTER: 'true' };
  await storeSignupAttribution(env, 'u1', { channel: 'producthunt', campaign: 'launch2026', referrer_class: 'social' });
  await storeSignupAttribution(env, 'u1', { channel: 'reddit', campaign: 'x', referrer_class: 'social' });
  assert.equal(DB.raw.prepare("SELECT signup_channel FROM users WHERE id = 'u1'").get().signup_channel, 'producthunt');
});
