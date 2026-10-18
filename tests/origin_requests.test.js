// ROADMAP step 50 (lite): the "Don't see your airport?" request. A demand signal only: events, no email, no promise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { normalizeAirportRequest, sanitizeRequestSource, rankRequests, MAX_REQUESTS_PER_IP_PER_DAY } from '../src/originRequests.js';
import { computeWeeklyStandup, renderWeeklyStandup } from '../src/weeklyStandup.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: (p) => { if (p && p.catch) p.catch(() => {}); return p; } };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const settle = () => new Promise((r) => setTimeout(r, 25));
const envOn = (DB, extra = {}) => ({ DB, ENABLE_ORIGIN_REQUESTS: 'true', ADMIN_SECRET: 'admin-secret', ...extra });

const post = (env, body, { ip = '203.0.113.7', ua = UA } = {}) => worker.fetch(new Request('https://sparkfare.com/api/origin-request', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': ua, 'CF-Connecting-IP': ip }, body: JSON.stringify(body),
}), env, ctx);
const events = (DB) => DB.raw.prepare("SELECT * FROM events WHERE event_type = 'origin_request' ORDER BY rowid").all();

test('normalizeAirportRequest: codes, city names and rejections', () => {
  assert.deepEqual(normalizeAirportRequest('pit'), { ok: true, code: 'PIT', label: 'PIT' });
  assert.deepEqual(normalizeAirportRequest('  Pittsburgh '), { ok: true, code: null, label: 'pittsburgh' });
  assert.deepEqual(normalizeAirportRequest("Fort   Lauderdale,  FL."), { ok: true, code: null, label: 'fort lauderdale fl' });
  assert.deepEqual(normalizeAirportRequest('São Paulo'), { ok: true, code: null, label: 'são paulo' });
  for (const bad of ['', ' ', 'a', '12345', 'PIT1', 'https://spam.example', 'visit www.spam.com', '<script>', 'a@b.co', 'x'.repeat(61), null, undefined, { a: 1 }]) {
    assert.equal(normalizeAirportRequest(bad).ok, false, JSON.stringify(bad));
  }
});

test('sanitizeRequestSource and rankRequests', () => {
  assert.equal(sanitizeRequestSource('Home<script>'), 'homescript');
  assert.equal(sanitizeRequestSource(''), null);
  assert.deepEqual(rankRequests([{ label: 'b', requests: 1, requesters: 1 }, { label: 'a', requests: 3, requesters: 2 }, { label: 'c', requests: 3, requesters: 3 }]).map((r) => r.label), ['c', 'a', 'b']);
});

test('flag off: GET says disabled (200, no console error), POST 404s and stores nothing', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = { DB };
  const get = await worker.fetch(new Request('https://sparkfare.com/api/origin-request'), env, ctx);
  assert.equal(get.status, 200);
  assert.deepEqual(await get.json(), { ok: true, enabled: false });
  assert.equal((await post(env, { airport: 'PIT' })).status, 404);
  await settle();
  assert.equal(events(DB).length, 0);
});

test('flag on: GET says enabled; a code request is stored as an event with a hashed ip and no email', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = envOn(DB);
  assert.deepEqual(await (await worker.fetch(new Request('https://sparkfare.com/api/origin-request'), env, ctx)).json(), { ok: true, enabled: true });
  const res = await post(env, { airport: 'pit', source: 'home' });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.ok, true);
  assert.match(j.message, /Nothing is promised/);
  await settle();
  const rows = events(DB);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].origin, 'PIT');
  assert.equal(rows[0].route, 'PIT');
  assert.equal(rows[0].source, 'home');
  assert.match(rows[0].anon_id, /^[0-9a-f]{64}$/);
  assert.equal(rows[0].user_id, null);
  assert.ok(!JSON.stringify(rows).includes('203.0.113.7'), 'the raw ip is never stored');
});

test('a city name is stored as text with no code', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await post(envOn(DB), { airport: 'Pittsburgh' });
  await settle();
  const [row] = events(DB);
  assert.equal(row.origin, null);
  assert.equal(row.route, 'pittsburgh');
});

test('an airport we already track is answered, not stored', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const res = await post(envOn(DB), { airport: 'jfk' });
  const j = await res.json();
  assert.equal(res.status, 200);
  assert.equal(j.already_supported, true);
  assert.match(j.message, /already track JFK/);
  await settle();
  assert.equal(events(DB).length, 0);
});

test('invalid input is a 400 and stores nothing; a bot gets a harmless 200 and stores nothing', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = envOn(DB);
  for (const bad of ['', 'a', 'http://x.example', '12345']) {
    const r = await post(env, { airport: bad });
    assert.equal(r.status, 400, bad);
  }
  const bot = await post(env, { airport: 'PIT' }, { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' });
  assert.equal(bot.status, 200);
  await settle();
  assert.equal(events(DB).length, 0);
});

test('the same request twice from one ip in a day counts once; the daily cap returns 429', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = envOn(DB);
  await post(env, { airport: 'PIT' });
  await settle();
  const again = await post(env, { airport: 'pit' });
  assert.equal(again.status, 200);
  await settle();
  assert.equal(events(DB).length, 1, 'not counted twice');

  const names = ['Boise', 'Tulsa', 'Omaha', 'Albany'];
  for (const n of names) { assert.equal((await post(env, { airport: n })).status, 200); await settle(); }
  assert.equal(events(DB).length, MAX_REQUESTS_PER_IP_PER_DAY);
  const over = await post(env, { airport: 'Reno' });
  assert.equal(over.status, 429);
  // a different ip is not affected
  assert.equal((await post(env, { airport: 'Reno' }, { ip: '198.51.100.9' })).status, 200);
});

test('admin summary: Bearer only, counts requests and distinct requesters, most requested first', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = envOn(DB);
  for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) { await post(env, { airport: 'PIT' }, { ip }); await settle(); }
  await post(env, { airport: 'Boise' }, { ip: '1.1.1.1' });
  await settle();

  const denied = await worker.fetch(new Request('https://sparkfare.com/api/admin/origin-requests'), env, ctx);
  assert.equal(denied.status, 401);
  const viaQuery = await worker.fetch(new Request('https://sparkfare.com/api/admin/origin-requests?secret=admin-secret'), env, ctx);
  assert.equal(viaQuery.status, 401, 'a secret in the URL is refused');

  const ok = await worker.fetch(new Request('https://sparkfare.com/api/admin/origin-requests?days=7', { headers: { Authorization: 'Bearer admin-secret' } }), env, ctx);
  assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.total, 4);
  assert.equal(j.requesters, 3);
  assert.equal(j.top[0].label, 'PIT');
  assert.equal(j.top[0].requests, 3);
  assert.equal(j.top[0].requesters, 3);
  assert.equal(j.top[0].code, 'PIT');
});

test('the weekly standup has an airport-requests block that never breaks the brief', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = envOn(DB);
  await post(env, { airport: 'PIT' }, { ip: '1.1.1.1' });
  await post(env, { airport: 'PIT' }, { ip: '2.2.2.2' });
  await post(env, { airport: 'Boise' }, { ip: '3.3.3.3' });
  await settle();
  const m = await computeWeeklyStandup(env, { now: new Date(Date.now() + 60000) });
  assert.equal(m.originRequests.week, 3);
  assert.equal(m.topAirportRequests[0].label, 'PIT');
  const out = renderWeeklyStandup(m);
  const text = typeof out === 'string' ? out : (out.text || out.html || JSON.stringify(out));
  assert.match(text, /airport requests/i);
  assert.match(text, /Most requested: PIT \(2\)/);

  const empty = await computeWeeklyStandup({ ...env, DB: makeSqliteD1(MIGRATIONS) }, { now: new Date() });
  assert.equal(empty.originRequests.week, 0);
});

test('the homepage link is hidden until the API says the feature is on, asks for no email, and posts to the API', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="origin-request" id="origin-request" hidden>/);
  assert.match(html, /<form id="origin-request-form" class="origin-request-form" hidden/);
  const at = html.indexOf('id="origin-request"');
  const block = html.slice(at, html.indexOf('</script>', at));
  assert.doesNotMatch(block, /type="email"|name="email"/);
  assert.match(block, /fetch\('\/api\/origin-request', \{ cache: 'no-store' \}\)/);
  assert.match(block, /method: 'POST'/);
  assert.match(block, /Nothing is promised/);
  assert.match(block, /aria-expanded/);
});

test('wrangler.jsonc ships the flag as an exact string and the privacy page describes what is stored', () => {
  assert.match(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), /"ENABLE_ORIGIN_REQUESTS":\s*"(true|false)"/);
  const privacy = fs.readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(privacy, /Airport requests/);
  assert.match(privacy, /one-way hash of your IP address/);
});
