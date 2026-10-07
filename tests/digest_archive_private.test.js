// Private start for the digest archive: ENABLE_DIGEST_ARCHIVE_WRITE stores each day's editions while the
// public pages stay off (ENABLE_DIGEST_ARCHIVE unset or false), so edition history can build up before the
// archive is published. Also: paid links in the digest carry rel="sponsored nofollow noopener".
import test from 'node:test';
import assert from 'node:assert';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import sparkfareWorker from '../src/index.js';
import { archiveEditions, archiveEnabled, archiveWriteEnabled, handleDigestRequest, renderDigestSitemap } from '../src/digestArchive.js';
import { buildArchiveConfig, sendDailyDealEmail, _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = ['migrations/0002_partners.sql', 'migrations/0013_events.sql', 'migrations/0014_digest_editions.sql'];
const APP = 'https://sparkfare.com';

function obs(price, days, end) {
  return Array.from({ length: days }, (_, i) => ({ date: new Date(end.getTime() - (days - i) * 86400000).toISOString().slice(0, 10), price }));
}
function deal(now, origin, price) {
  return {
    display_name: 'San Jose, Costa Rica', origin, price, status: 'deal', airline: 'B6',
    booking_link: `https://www.aviasales.com/search/${origin}2310SJO02111?marker=314524`,
    departure_at: '2026-10-23T22:35:00-07:00', return_at: '2026-10-25T16:15:00-06:00',
    found_at: new Date(now.getTime() - 3600000).toISOString(), observations: obs(588, 20, now),
  };
}
function filesFor(now) {
  const feed = (origin, price) => ({ generated_at: now.toISOString(), deals: [deal(now, origin, price)], featured: [], priced_no_deal: [], insufficient_history: [], no_data: [] });
  return { 'sparkfare_ranked_deals.json': feed('JFK', 300), 'sparkfare_ranked_deals_other_origins.json': feed('LAX', 278) };
}
function assets(files) {
  return { async fetch(req) { const f = new URL(req.url).pathname.slice(1); return f in files ? new Response(JSON.stringify(files[f])) : new Response('nf', { status: 404 }); } };
}
async function runCron(env) {
  const original = console.error;
  console.error = () => {};
  try { await sparkfareWorker.scheduled({ cron: '0 8 * * *' }, env); } finally { console.error = original; }
}
const count = (db) => db.raw.prepare('SELECT COUNT(*) AS n FROM digest_editions').get().n;

test('the two flags: serving implies writing; writing alone does not serve; only the exact string true counts', () => {
  assert.equal(archiveEnabled({ ENABLE_DIGEST_ARCHIVE: 'true' }), true);
  assert.equal(archiveWriteEnabled({ ENABLE_DIGEST_ARCHIVE: 'true' }), true);
  assert.equal(archiveEnabled({ ENABLE_DIGEST_ARCHIVE_WRITE: 'true' }), false);
  assert.equal(archiveWriteEnabled({ ENABLE_DIGEST_ARCHIVE_WRITE: 'true' }), true);
  for (const v of [undefined, 'false', 'TRUE', '1', '']) {
    assert.equal(archiveWriteEnabled({ ENABLE_DIGEST_ARCHIVE: v, ENABLE_DIGEST_ARCHIVE_WRITE: v }), false, JSON.stringify(v));
  }
});

test('write-only: the scheduled run stores editions, but /digest and the sitemap stay empty and 404', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const now = new Date();
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'false', ENABLE_DIGEST_ARCHIVE_WRITE: 'true', ASSETS: assets(filesFor(now)) };
  await runCron(env);
  assert.deepEqual(db.raw.prepare('SELECT origin FROM digest_editions ORDER BY origin').all().map((r) => r.origin), ['JFK', 'LAX']);

  const today = now.toISOString().slice(0, 10);
  for (const path of ['/digest', '/digest/LAX', `/digest/LAX/${today}`]) {
    const res = await handleDigestRequest(new URL(`${APP}${path}`), env, { appUrl: APP, now, buildConfig: () => buildArchiveConfig(env, { appUrl: APP }) });
    assert.equal(res.status, 404, path);
  }
  const sitemap = await (await renderDigestSitemap(env, { appUrl: APP })).text();
  assert.doesNotMatch(sitemap, /<loc>/);

  // through the real fetch handler too
  const viaWorker = await sparkfareWorker.fetch(new Request(`${APP}/digest`), env, { waitUntil() {} });
  assert.equal(viaWorker.status, 404);
});

test('write-only: the emailed digest does not link to an archive page that would 404', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec('CREATE TABLE email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT)');
  const now = new Date();
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'false', ENABLE_DIGEST_ARCHIVE_WRITE: 'true', ENABLE_EMAIL_V2: 'true', ASSETS: assets(filesFor(now)), RESEND_API_KEY: 'k', APP_URL: APP };
  await runCron(env);
  assert.equal(count(db), 2);

  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ id: 'x' }), { status: 200 }); }
    return original(url, options);
  };
  try {
    await sendDailyDealEmail({ email: 'a@example.com', origin: 'LAX', deals: [deal(now, 'LAX', 278)], userId: 'u1' }, env);
  } finally { globalThis.fetch = original; }
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].html, /\/digest\//, 'no link to the unpublished archive');
});

test('flipping serving on later publishes what was stored privately', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const now = new Date();
  const writeOnly = { DB: db, ENABLE_DIGEST_ARCHIVE_WRITE: 'true', ASSETS: assets(filesFor(now)) };
  await runCron(writeOnly);
  assert.equal(count(db), 2);
  const live = { ...writeOnly, ENABLE_DIGEST_ARCHIVE: 'true' };
  const res = await handleDigestRequest(new URL(`${APP}/digest`), live, { appUrl: APP, now, buildConfig: () => buildArchiveConfig(live, { appUrl: APP }) });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /San Jose|Costa Rica|LAX|Los Angeles/);
});

test('with neither flag on, nothing is stored (the default before this change)', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const now = new Date();
  await runCron({ DB: db, ASSETS: assets(filesFor(now)) });
  await runCron({ DB: db, ENABLE_DIGEST_ARCHIVE: 'false', ENABLE_DIGEST_ARCHIVE_WRITE: 'false', ASSETS: assets(filesFor(now)) });
  assert.equal(count(db), 0);
});

test('wrangler.jsonc ships writing on and serving off', async () => {
  const fs = await import('node:fs');
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_DIGEST_ARCHIVE":\s*"false"/);
  assert.match(cfg, /"ENABLE_DIGEST_ARCHIVE_WRITE":\s*"true"/);
});

test('every Aviasales or /out/ or /go/ link in an archived edition is rel="sponsored nofollow noopener"', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const now = new Date();
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'true' };
  await archiveEditions(env, { now, loadDeals: async (o) => (o === 'LAX' ? [deal(now, 'LAX', 278), { ...deal(now, 'LAX', 301), display_name: 'Tbilisi, Georgia', booking_link: 'https://www.aviasales.com/search/LAX1111TBS11111?marker=314524' }] : []), buildConfig: () => buildArchiveConfig(env, { appUrl: APP }) });
  const res = await handleDigestRequest(new URL(`${APP}/digest/LAX/${now.toISOString().slice(0, 10)}`), env, { appUrl: APP, now, buildConfig: () => buildArchiveConfig(env, { appUrl: APP }) });
  const html = await res.text();
  const anchors = [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[0]).filter((a) => /aviasales\.com|\/out\/|\/go\//.test(a.match(/href="([^"]+)"/)[1]));
  assert.ok(anchors.length >= 2, `expected the booking links, found ${anchors.length}`);
  for (const a of anchors) {
    const rel = (a.match(/\brel="([^"]*)"/) || [])[1] || '';
    for (const token of ['sponsored', 'nofollow', 'noopener']) assert.ok(rel.split(/\s+/).includes(token), `${token} missing on ${a.slice(0, 120)}`);
  }
  // links to our own pages are not paid links and stay plain
  const own = [...html.matchAll(/<a\s[^>]*href="(\/[^"]*|https:\/\/sparkfare\.com[^"]*)"[^>]*>/g)].map((m) => m[0]).filter((a) => !/\/out\/|\/go\//.test(a));
  assert.ok(own.length >= 1);
  assert.ok(own.every((a) => !/rel="[^"]*sponsored/.test(a)));
});
