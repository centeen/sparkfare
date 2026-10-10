// ROADMAP step 22e: the /pricing Plus waitlist. Interest signal only: double opt-in, nothing sold, flag off by default.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { signWaitlistToken, verifyWaitlistToken, cleanWaitlistEmail } from '../src/plusWaitlist.js';
import { signUnsubscribeToken } from '../src/postClickEmail.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: (p) => { if (p && p.catch) p.catch(() => {}); return p; } };
const SECRET = 'test-secret';
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' };
const envOn = (DB, extra = {}) => ({ DB, ENABLE_PLUS_WAITLIST: 'true', UNSUBSCRIBE_SECRET: SECRET, ...extra });

const join = (env, email, headers = UA) => worker.fetch(new Request('https://sparkfare.com/api/plus-waitlist', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ email, source: 'pricing' }),
}), env, ctx);
const row = (DB, email) => DB.raw.prepare('SELECT * FROM plus_waitlist WHERE email = ?').get(email);
const count = (DB, type) => DB.raw.prepare('SELECT count(*) AS c FROM events WHERE event_type = ?').get(type)?.c ?? 0;

async function withResend(fn) {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
  };
  try { return await fn(sent); } finally { globalThis.fetch = realFetch; }
}

test('flag off: the page and every route 404, and nothing is stored', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = { DB, UNSUBSCRIBE_SECRET: SECRET };
  assert.equal((await worker.fetch(new Request('https://sparkfare.com/pricing'), env, ctx)).status, 404);
  assert.equal((await join(env, 'a@example.com')).status, 404);
  const token = await signWaitlistToken('a@example.com', SECRET);
  assert.equal((await worker.fetch(new Request(`https://sparkfare.com/api/plus-waitlist/verify?token=${token}`), env, ctx)).status, 404);
  assert.equal(DB.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'plus_waitlist'").get()?.name, 'plus_waitlist', 'only the migration creates the table');
  assert.equal(DB.raw.prepare('SELECT count(*) AS c FROM plus_waitlist').get().c, 0);
});

test('wrangler.jsonc: flag defaults to "false" and /pricing reaches the Worker', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_PLUS_WAITLIST":\s*"false"/);
  assert.match(cfg, /"\/pricing"/);
});

test('/pricing page: states nothing is charged and that data is the same for everyone', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const res = await worker.fetch(new Request('https://sparkfare.com/pricing', { headers: UA }), envOn(DB), ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /nothing is charged/i);
  assert.match(html, /same for everyone/i);
  assert.match(html, /does not sell, book or take payment for travel/);
  assert.match(html, /noindex/);
  await new Promise((r) => setTimeout(r, 20));
  assert.doesNotMatch(html, /faster|hourly|early access|earlier access/i, 'Plus must not be described as selling speed');
  assert.equal(count(DB, 'pricing_view'), 1);
});

test('crawlers are not counted as page views', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await worker.fetch(new Request('https://sparkfare.com/pricing', { headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } }), envOn(DB), ctx);
  assert.equal(count(DB, 'pricing_view'), 0);
});

test('signup stores the address unverified and sends one confirmation email', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await withResend(async (sent) => {
    const res = await join(envOn(DB, { RESEND_API_KEY: 're_test' }), 'Person@Example.com ');
    assert.equal(res.status, 200);
    await new Promise((r) => setTimeout(r, 20));
    const r = row(DB, 'person@example.com');
    assert.ok(r, 'stored lowercase and trimmed');
    assert.equal(r.verified_at, null, 'not on the list until confirmed');
    assert.equal(sent.length, 1);
    assert.equal([].concat(sent[0].to)[0], 'person@example.com');
    assert.match(sent[0].html, /api\/plus-waitlist\/verify\?token=/);
  });
  assert.equal(count(DB, 'plus_waitlist_join'), 1);
});

test('resubmitting inside the cooldown sends nothing more and answers the same', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await withResend(async (sent) => {
    const env = envOn(DB, { RESEND_API_KEY: 're_test' });
    const first = await join(env, 'again@example.com');
    const second = await join(env, 'again@example.com');
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(second.status, first.status);
    assert.deepEqual(await second.json(), await first.json());
    assert.equal(sent.length, 1);
    assert.equal(count(DB, 'plus_waitlist_join'), 1);
  });
});

test('an old unconfirmed address can be re-sent a link; a confirmed one never is', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await withResend(async (sent) => {
    const env = envOn(DB, { RESEND_API_KEY: 're_test' });
    await join(env, 'old@example.com');
    DB.raw.prepare("UPDATE plus_waitlist SET last_sent_at = datetime('now','-1 hour') WHERE email = 'old@example.com'").run();
    await join(env, 'old@example.com');
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(sent.length, 2);
    DB.raw.prepare("UPDATE plus_waitlist SET verified_at = datetime('now'), last_sent_at = datetime('now','-1 day') WHERE email = 'old@example.com'").run();
    await join(env, 'old@example.com');
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(sent.length, 2);
  });
});

test('invalid addresses are refused and nothing is stored', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  for (const bad of ['', 'nope', 'a@b', 'x'.repeat(300) + '@example.com', null]) {
    const res = await join(envOn(DB), bad);
    assert.equal(res.status, 400, String(bad).slice(0, 20));
  }
  assert.equal(DB.raw.prepare('SELECT count(*) AS c FROM plus_waitlist').get().c, 0);
});

test('verify: GET shows a confirm page and changes nothing; POST confirms', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = envOn(DB);
  await join(env, 'v@example.com');
  const token = await signWaitlistToken('v@example.com', SECRET);
  const url = `https://sparkfare.com/api/plus-waitlist/verify?token=${encodeURIComponent(token)}`;

  const got = await worker.fetch(new Request(url), env, ctx);
  assert.equal(got.status, 200);
  assert.match(await got.text(), /method="POST"/);
  assert.equal(row(DB, 'v@example.com').verified_at, null, 'a scanner opening the link must not verify');

  const posted = await worker.fetch(new Request(url, { method: 'POST' }), env, ctx);
  assert.equal(posted.status, 200);
  assert.ok(row(DB, 'v@example.com').verified_at);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(count(DB, 'plus_waitlist_verified'), 1);

  await worker.fetch(new Request(url, { method: 'POST' }), env, ctx);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(count(DB, 'plus_waitlist_verified'), 1, 'a second confirm is not counted twice');
});

test('verify: tampered, wrong-secret and other-purpose tokens are refused', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const env = envOn(DB);
  await join(env, 't@example.com');
  const good = await signWaitlistToken('t@example.com', SECRET);
  const unsub = await signUnsubscribeToken('t@example.com', SECRET);
  const candidates = [good.slice(0, -4) + 'abcd', await signWaitlistToken('t@example.com', 'other'), unsub, 'junk', ''];
  for (const t of candidates) {
    const res = await worker.fetch(new Request(`https://sparkfare.com/api/plus-waitlist/verify?token=${encodeURIComponent(t)}`, { method: 'POST' }), env, ctx);
    assert.equal(res.status, 400, t.slice(0, 12));
  }
  assert.equal(row(DB, 't@example.com').verified_at, null);
  assert.equal(await verifyWaitlistToken(unsub, SECRET), null);
  // and a waitlist token cannot unsubscribe anyone
  const res = await worker.fetch(new Request(`https://sparkfare.com/api/unsubscribe?token=${encodeURIComponent(good)}`, { method: 'POST' }), env, ctx);
  assert.notEqual(res.status, 200);
});

test('cleanWaitlistEmail', () => {
  assert.equal(cleanWaitlistEmail(' A@B.co '), 'a@b.co');
  assert.equal(cleanWaitlistEmail('a b@c.co'), null);
});
