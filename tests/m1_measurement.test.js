// Addendum M, M1 (ROADMAP step 140): measurement. Every signup path stores a first-touch source, confirmation is recorded when
// the address is verified, a referral confirms on verification (Guard condition 7), and /admin/growth reports counts only.
// Runs on a real in-memory SQLite D1 built from the migrations (including 0031_signup_source).
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { computeSignupSource, computeGrowth, growthToMarkdown, SIGNUP_SOURCES } from '../src/growth.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: (p) => p };
const ADMIN = 'test-admin-secret';
const envFor = (DB) => ({ DB, ENABLE_T3_REFERRALS: 'true', ADMIN_SECRET: ADMIN });

function signup(DB, body) {
  return worker.fetch(new Request('https://sparkfare.com/api/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), envFor(DB), ctx);
}
const base = (email, extra = {}) => ({ id: `local_${email}`, email, origin_iata: 'JFK', trip_length: '7-10', ...extra });
const row = (DB, email) => DB.raw.prepare('SELECT * FROM users WHERE email = ?').get(email);
const sourceOf = (DB, email) => row(DB, email)?.signup_source;
const verify = (DB, email) => worker.fetch(new Request(`https://sparkfare.com/api/verify?token=${row(DB, email).verification_token}`), envFor(DB), ctx);
const get = (DB, path, headers = {}) => worker.fetch(new Request(`https://sparkfare.com${path}`, { headers }), envFor(DB), ctx);

test('computeSignupSource: referral beats the form source, which beats partner_id, which beats direct', () => {
  assert.equal(computeSignupSource({ source: 'check', referredBy: 'u1' }), 'referral');
  assert.equal(computeSignupSource({ source: 'check' }), 'check');
  assert.equal(computeSignupSource({ source: 'HOME' }), 'home');
  assert.equal(computeSignupSource({ partnerId: 'pseo' }), 'route');
  assert.equal(computeSignupSource({ partnerId: 'digest_archive' }), 'digest');
  assert.equal(computeSignupSource({}), 'direct');
  assert.equal(computeSignupSource({ source: 'something-made-up' }), 'direct');
  assert.equal(computeSignupSource({ source: '<script>', partnerId: 'denver_guide' }), 'direct');
  for (const s of SIGNUP_SOURCES) assert.equal(computeSignupSource({ source: s }), s);
});

test('a signup through each path stores that path as its source; none stores direct', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const cases = [
    ['home@example.com', { source: 'home' }, 'home'],
    ['check@example.com', { source: 'check' }, 'check'],
    ['leave@example.com', { source: 'leave' }, 'leave'],
    ['pto@example.com', { source: 'pto' }, 'pto'],
    ['widget@example.com', { source: 'widget', partner_id: 'denver_guide' }, 'widget'],
    ['pseo@example.com', { partner_id: 'pseo' }, 'route'],
    ['archive@example.com', { partner_id: 'digest_archive' }, 'digest'],
    ['none@example.com', {}, 'direct'],
  ];
  for (const [email, extra, want] of cases) {
    assert.equal((await signup(DB, base(email, extra))).status, 200, email);
    assert.equal(sourceOf(DB, email), want, email);
  }
});

test('a campaign tag with the signup does not change the stored source, and is kept in the event', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await signup(DB, base('tagged@example.com', { source: 'home', utm: 'producthunt_launch' }));
  assert.equal(sourceOf(DB, 'tagged@example.com'), 'home');
  const ev = DB.raw.prepare("SELECT source, meta FROM events WHERE event_type = 'signup'").get();
  assert.equal(ev.source, 'home');
  assert.equal(JSON.parse(ev.meta).utm, 'producthunt_launch');
});

test('first touch wins: a later resubmit never overwrites the stored source', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await signup(DB, base('first@example.com', { source: 'pto' }));
  await signup(DB, base('first@example.com', { source: 'check', origin_iata: 'LAX' }));
  assert.equal(sourceOf(DB, 'first@example.com'), 'pto');
  assert.equal(row(DB, 'first@example.com').origin_iata, 'LAX', 'the rest of the resubmit still applies');
});

test('a signup that arrives through a referral link is stored as referral', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const inviter = await (await signup(DB, base('inviter@example.com', { source: 'home' }))).json();
  const code = inviter.user?.ref_code || inviter.ref_code;
  assert.ok(code, 'the inviter gets a code without an account');
  await signup(DB, base('friend@example.com', { source: 'home', ref: code }));
  assert.equal(sourceOf(DB, 'friend@example.com'), 'referral');
  assert.equal(DB.raw.prepare("SELECT status FROM referrals").get().status, 'pending');
});

test('verifying the address records email_verified with the source, and confirms a pending referral', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const inviter = await (await signup(DB, base('inviter@example.com', { source: 'home' }))).json();
  const code = inviter.user?.ref_code || inviter.ref_code;
  await signup(DB, base('friend@example.com', { source: 'home', ref: code }));
  assert.equal(DB.raw.prepare('SELECT status FROM referrals').get().status, 'pending', 'not confirmed by signing up');
  const res = await verify(DB, 'friend@example.com');
  assert.ok([302, 200].includes(res.status), String(res.status));
  assert.equal(row(DB, 'friend@example.com').verified_email, 1);
  assert.equal(DB.raw.prepare('SELECT status FROM referrals').get().status, 'confirmed');
  const ev = DB.raw.prepare("SELECT source FROM events WHERE event_type = 'email_verified'").get();
  assert.equal(ev.source, 'referral');
});

test('verifying with a bad token records nothing and confirms nothing', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await signup(DB, base('a@example.com', { source: 'home' }));
  const res = await get(DB, '/api/verify?token=not-a-real-token');
  assert.equal(res.status, 404);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS c FROM events WHERE event_type = 'email_verified'").get().c, 0);
});

test('/admin/growth: the page is a static shell; the data needs the admin secret in a header and never in the URL', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const page = await get(DB, '/admin/growth');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  const html = await page.text();
  assert.ok(!html.includes(ADMIN));
  assert.equal((await get(DB, '/admin/growth/data')).status, 401);
  assert.equal((await get(DB, '/admin/growth/data', { Authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await get(DB, `/admin/growth/data?secret=${ADMIN}`)).status, 401, 'a secret in the URL is refused');
  assert.equal((await get(DB, '/admin/growth/data', { Authorization: `Bearer ${ADMIN}` })).status, 200);
});

test('the growth numbers: signups and confirmations by source, a rate, referrals, and no personal data', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  for (const [email, source] of [['a@example.com', 'home'], ['b@example.com', 'home'], ['c@example.com', 'check'], ['d@example.com', 'pto']]) {
    await signup(DB, base(email, { source, utm: source === 'home' ? 'reddit_nov12' : undefined }));
  }
  await verify(DB, 'a@example.com');
  await verify(DB, 'c@example.com');
  const res = await get(DB, '/admin/growth/data', { Authorization: `Bearer ${ADMIN}` });
  const { growth: g } = await res.json();
  assert.equal(g.totals.last28.signups, 4);
  assert.equal(g.totals.last28.confirmed, 2);
  assert.equal(g.totals.last28.rate, 50);
  const home = g.by_source.last28.find((r) => r.source === 'home');
  assert.deepEqual([home.signups, home.confirmed, home.rate], [2, 1, 50]);
  const pto = g.by_source.last28.find((r) => r.source === 'pto');
  assert.deepEqual([pto.signups, pto.confirmed, pto.rate], [1, 0, 0]);
  assert.deepEqual(g.by_utm_last28.map((r) => [r.utm, r.signups, r.confirmed]), [['reddit_nov12', 2, 1]]);
  assert.equal(g.by_day.confirmations.reduce((n, r) => n + r.confirmations, 0), 2);
  assert.equal(g.referrals.last28.sent, 0);
  const md = growthToMarkdown(g, { visits: 1234 });
  assert.ok(md.includes('Visits: 1234'));
  assert.ok(!/@/.test(JSON.stringify(g)) && !/@/.test(md), 'counts only: no email address anywhere');
});

test('users made before tagging shipped show as unknown, not as a made-up source', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  DB.raw.prepare("INSERT INTO users (id, email, verified_email) VALUES ('old1', 'old@example.com', 1)").run();
  const g = await computeGrowth({ DB }, new Date());
  assert.equal(g.by_source.last28.find((r) => r.source === 'unknown').signups, 1);
});

test('the report window excludes older signups', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  DB.raw.prepare("INSERT INTO users (id, email, signup_source, created_at) VALUES ('o', 'o@example.com', 'home', datetime('now', '-40 days'))").run();
  DB.raw.prepare("INSERT INTO users (id, email, signup_source, created_at) VALUES ('n', 'n@example.com', 'home', datetime('now', '-3 days'))").run();
  const g = await computeGrowth({ DB }, new Date());
  assert.equal(g.totals.last28.signups, 1);
  assert.equal(g.totals.last7.signups, 1);
});

test('every signup form sends its own source, and the pages that can carry a campaign tag load utm.js', () => {
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.match(read('index.html'), /source: 'home'/);
  assert.match(read('widget.html'), /source: 'widget'/);
  assert.match(read('check.html'), /source: 'check'/);
  assert.match(read('leave.html'), /source: 'leave'/);
  assert.match(read('src/ptoPages.js'), /source: 'pto'/);
  for (const f of ['index.html', 'check.html', 'leave.html', 'src/ptoPages.js']) {
    assert.ok(read(f).includes('/utm.js'), `${f} loads utm.js`);
  }
  // The anonymous landing pages identify themselves by partner_id; the server maps those (nothing is regenerated).
  assert.match(read('Phase 17 pSEO Generator (Step 106).py'), /partner_id: 'pseo'/);
});

test('the baseline script builds the markdown from /admin/growth/data, sends the secret only as a header, and refuses a bad secret', async () => {
  const { buildBaseline } = await import('../scripts/growth-baseline.mjs');
  const DB = makeSqliteD1(MIGRATIONS);
  await signup(DB, base('z@example.com', { source: 'check' }));
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, auth: init?.headers?.Authorization });
    return worker.fetch(new Request(url, { headers: init?.headers }), envFor(DB), ctx);
  };
  const out = await buildBaseline({ fetchImpl, secret: ADMIN, visits: 321, date: '2026-10-27' });
  assert.equal(out.date, '2026-10-27');
  assert.match(out.markdown, /# Growth baseline 2026-10-27/);
  assert.match(out.markdown, /Visits: 321/);
  assert.match(out.markdown, /\| check \| 1 \| 0 \| 0% \|/);
  assert.ok(!seen[0].url.includes(ADMIN), 'the secret is never in the URL');
  assert.equal(seen[0].auth, `Bearer ${ADMIN}`);
  await assert.rejects(() => buildBaseline({ fetchImpl, secret: 'wrong' }), /refused/);
  await assert.rejects(() => buildBaseline({ fetchImpl }), /ADMIN_SECRET/);
});

test('"Browse All N Routes" on the homepage states the real route count (hubs minus TLV times destinations)', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="origin-select">([\s\S]*?)<\/select>/);
  const hubs = [...select[1].matchAll(/<option value="([A-Z]{3})"/g)].map((m) => m[1]).filter((o) => o !== 'TLV').length;
  const destinations = Object.keys(JSON.parse(fs.readFileSync(new URL('../sparkfare_destinations.json', import.meta.url), 'utf8'))).length;
  const m = html.match(/Browse All (\d+) Routes/);
  assert.ok(m, 'expected the directory call to action');
  assert.equal(Number(m[1]), hubs * destinations);
});
