import test from 'node:test';
import assert from 'node:assert';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import sparkfareWorker from '../src/index.js';
import { archiveEditions, handleDigestRequest, renderDigestSitemap } from '../src/digestArchive.js';
import { buildArchiveConfig, sendDailyDealEmail, _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = ['migrations/0002_partners.sql', 'migrations/0013_events.sql', 'migrations/0014_digest_editions.sql'];
const DAY1 = new Date('2026-09-24T08:00:00Z');
const DAY2 = new Date('2026-09-25T08:00:00Z');
const DAY5 = new Date('2026-09-28T08:00:00Z');

function obs(price, days = 20, end = DAY1) {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(end.getTime() - (days - i) * 86400000).toISOString().slice(0, 10),
    price,
  }));
}

function deal(now, overrides = {}) {
  return {
    display_name: 'San Jose, Costa Rica', origin: 'LAX', price: 278, status: 'deal', airline: 'B6',
    booking_link: 'https://www.aviasales.com/search/LAX2310SJO02111?marker=314524',
    departure_at: '2026-10-23T22:35:00-07:00', return_at: '2026-10-25T16:15:00-06:00',
    found_at: new Date(now.getTime() - 3600000).toISOString(), observations: obs(588, 20, now), ...overrides,
  };
}

const APP = 'https://sparkfare.com';
const config = async () => ({ appUrl: APP, destinations: { 'San Jose, Costa Rica': 'The gateway to Costa Rica.' }, tips: [{ id: 't', title: 'Tip', body: 'Body.' }], awayMode: null });
const loaderFor = (now) => async (origin) => (origin === 'LAX' ? [deal(now)] : origin === 'SEA' ? [deal(now, { origin: 'SEA', display_name: 'Tbilisi, Georgia', booking_link: 'https://www.aviasales.com/search/SEA2310TBS02111?marker=314524' })] : []);

const request = (path, env, now) => handleDigestRequest(new URL(`${APP}${path}`), env, { appUrl: APP, now, buildConfig: config });

async function seeded() {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'true' };
  await archiveEditions(env, { now: DAY1, loadDeals: loaderFor(DAY1), buildConfig: config });
  return env;
}

test('archiveEditions stores one edition per origin that has deals, and skips the rest', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const result = await archiveEditions({ DB: db }, { now: DAY1, loadDeals: loaderFor(DAY1), buildConfig: config });
  assert.equal(result.archived, 2);
  const rows = db.raw.prepare('SELECT origin, edition_date, kind, edition_number FROM digest_editions ORDER BY origin').all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { origin: 'LAX', edition_date: '2026-09-24', kind: 'daily', edition_number: 1 },
    { origin: 'SEA', edition_date: '2026-09-24', kind: 'daily', edition_number: 1 },
  ]);
});

test('archiveEditions is idempotent within a day and numbers editions sequentially across days', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db };
  await archiveEditions(env, { now: DAY1, loadDeals: loaderFor(DAY1), buildConfig: config });
  const again = await archiveEditions(env, { now: new Date('2026-09-24T09:00:00Z'), loadDeals: loaderFor(DAY1), buildConfig: config });
  assert.equal(again.archived, 0);
  await archiveEditions(env, { now: DAY2, loadDeals: loaderFor(DAY2), buildConfig: config });
  const lax = db.raw.prepare("SELECT edition_date, edition_number FROM digest_editions WHERE origin = 'LAX' ORDER BY edition_date").all();
  assert.deepEqual(lax.map((r) => r.edition_number), [1, 2]);
});

test('an archived edition contains no email address, token or unsubscribe link, even with subscribers in the database', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec("CREATE TABLE users (id TEXT, email TEXT); INSERT INTO users VALUES ('u1', 'subscriber@example.com')");
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'true' };
  await archiveEditions(env, { now: DAY1, loadDeals: loaderFor(DAY1), buildConfig: config });

  const stored = db.raw.prepare('SELECT html_public, deals_json, subject FROM digest_editions').all();
  const pages = [
    ...stored.map((r) => r.html_public + r.deals_json + r.subject),
    await (await request('/digest', env, DAY1)).text(),
    await (await request('/digest/LAX', env, DAY1)).text(),
    await (await request('/digest/LAX/2026-09-24', env, DAY1)).text(),
    await (await request('/digest/LAX/2026-09-24', env, DAY5)).text(),
  ];
  for (const page of pages) {
    assert.doesNotMatch(page, /subscriber@example\.com/);
    assert.doesNotMatch(page, /api\/unsubscribe/);
    assert.doesNotMatch(page, /[?&]email=/);
    assert.doesNotMatch(page, /token/i);
    assert.doesNotMatch(page, /\/r\/ref_/);
  }
});

test('routes 404 when the archive flag is off', async () => {
  const env = await seeded();
  const off = { ...env, ENABLE_DIGEST_ARCHIVE: 'false' };
  for (const path of ['/digest', '/digest/LAX', '/digest/LAX/2026-09-24']) {
    assert.equal((await request(path, off, DAY1)).status, 404, path);
  }
});

test('unknown origins, bad dates and missing editions 404; TLV is not archived', async () => {
  const env = await seeded();
  for (const path of ['/digest/XXX', '/digest/TLV', '/digest/LAX/not-a-date', '/digest/LAX/2020-01-01', '/digest/LAX/2026-09-24/nope', '/digest/LAX/2026-09-24/weekly']) {
    assert.equal((await request(path, env, DAY1)).status, 404, path);
  }
});

test("today's edition: noindex, no stale banner, live fare links, signup form", async () => {
  const env = await seeded();
  const res = await request('/digest/LAX/2026-09-24', env, DAY1);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(html, /Fares have likely changed/);
  assert.match(html, /Get this in your inbox every morning/);
  assert.match(html, /partner_id: 'digest_archive'/);
  assert.match(html, /aviasales\.com\/search\/LAX2310SJO/);
  assert.match(html, /San Jose/);
  assert.match(html, /Edition 1/);
  assert.doesNotMatch(html, /SF_HEAD|SF_BODY_TOP/);
});

test('an old edition shows the stale banner and links fares to the live route page instead of the old deep link', async () => {
  const env = await seeded();
  const html = await (await request('/digest/LAX/2026-09-24', env, DAY5)).text();
  assert.match(html, /Prices from 2026-09-24\. Fares have likely changed\./);
  assert.match(html, /See today's deals/);
  assert.match(html, /href="https:\/\/sparkfare\.com\/flight\/LAX\/SJO/);
  assert.doesNotMatch(html, /aviasales\.com/);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(html, /28% BELOW USUAL|below usual/i);
});

test('/digest is indexable and lists editions; origin pages list that origin only and are noindex', async () => {
  const env = await seeded();
  const index = await (await request('/digest', env, DAY1)).text();
  assert.match(index, /<meta name="robots" content="index, follow">/);
  assert.match(index, /href="\/digest\/LAX\/2026-09-24"/);
  assert.match(index, /href="\/digest\/SEA\/2026-09-24"/);
  const lax = await (await request('/digest/LAX', env, DAY1)).text();
  assert.match(lax, /noindex, follow/);
  assert.match(lax, /\/digest\/LAX\/2026-09-24/);
  assert.doesNotMatch(lax, /\/digest\/SEA\/2026-09-24/);
});

test('weekly editions are indexable with a canonical link, highlighted on /digest, and in the sitemap; dailies stay out', async () => {
  const env = await seeded();
  env.DB.raw.prepare(`INSERT INTO digest_editions (id, origin, edition_date, kind, edition_number, subject, html_public, deals_json, created_at)
    VALUES ('w1', 'LAX', '2026-09-27', 'weekly', 1, 'The Week in Fares from Los Angeles', '<html><head><title>x</title><!--SF_HEAD--></head><body><!--SF_BODY_TOP-->weekly</body></html>', '[]', '2026-09-27T08:00:00.000Z')`).run();
  const page = await (await request('/digest/LAX/2026-09-27/weekly', env, new Date('2026-09-27T09:00:00Z'))).text();
  assert.match(page, /<meta name="robots" content="index, follow">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/sparkfare\.com\/digest\/LAX\/2026-09-27\/weekly">/);

  const index = await (await request('/digest', env, DAY5)).text();
  assert.match(index, /Weekly editions/);

  const xml = await (await renderDigestSitemap(env, { appUrl: APP })).text();
  assert.match(xml, /<loc>https:\/\/sparkfare\.com\/digest<\/loc>/);
  assert.match(xml, /<loc>https:\/\/sparkfare\.com\/digest\/LAX\/2026-09-27\/weekly<\/loc>/);
  assert.doesNotMatch(xml, /2026-09-24/);
});

test('the sitemap is empty when the flag is off', async () => {
  const env = await seeded();
  const xml = await (await renderDigestSitemap({ ...env, ENABLE_DIGEST_ARCHIVE: 'false' }, { appUrl: APP })).text();
  assert.doesNotMatch(xml, /<loc>/);
});

test('worker routes are wired: /digest and /sitemap-digest.xml respond through the Worker fetch handler', async () => {
  const handle = (req, env) => sparkfareWorker.fetch(req, env, { waitUntil() {} });
  const env = await seeded();
  const digest = await handle(new Request(`${APP}/digest`), env);
  assert.equal(digest.status, 200);
  const sitemap = await handle(new Request(`${APP}/sitemap-digest.xml`), env);
  assert.match(await sitemap.text(), /sparkfare\.com\/digest/);
  const off = await handle(new Request(`${APP}/digest`), { ...env, ENABLE_DIGEST_ARCHIVE: 'false' });
  assert.equal(off.status, 404);
});

test('the scheduled run archives editions from the ranked-deal files before sending', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const now = new Date();
  const feed = (origin, price) => ({
    generated_at: now.toISOString(),
    deals: [deal(now, { origin, price, booking_link: `https://www.aviasales.com/search/${origin}2310SJO02111?marker=1` })],
    featured: [], priced_no_deal: [], insufficient_history: [], no_data: [],
  });
  const files = { 'sparkfare_ranked_deals.json': feed('JFK', 300), 'sparkfare_ranked_deals_other_origins.json': feed('LAX', 278) };
  const env = {
    DB: db, ENABLE_DIGEST_ARCHIVE: 'true',
    ASSETS: { async fetch(req) { const f = new URL(req.url).pathname.slice(1); return f in files ? new Response(JSON.stringify(files[f])) : new Response('nf', { status: 404 }); } },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await sparkfareWorker.scheduled({ cron: '0 8 * * *' }, env);
  } finally {
    console.error = originalError;
  }
  const rows = db.raw.prepare('SELECT origin FROM digest_editions ORDER BY origin').all().map((r) => r.origin);
  assert.deepEqual(rows, ['JFK', 'LAX']);
});

test('the scheduled run stores nothing when the archive flag is off', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const originalError = console.error;
  console.error = () => {};
  try {
    await sparkfareWorker.scheduled({ cron: '0 8 * * *' }, { DB: db, ENABLE_DIGEST_ARCHIVE: 'false' });
  } finally {
    console.error = originalError;
  }
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM digest_editions').get().n, 0);
});

test('the emailed digest links to its archived edition and carries the same edition number', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec('CREATE TABLE email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT)');
  const now = new Date();
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'true', ENABLE_EMAIL_V2: 'true', RESEND_API_KEY: 'k', APP_URL: APP, EMAIL_FROM: 'Sparkfare <hello@sparkfare.com>' };
  await archiveEditions(env, { now, loadDeals: async (o) => (o === 'LAX' ? [deal(now)] : []), buildConfig: () => buildArchiveConfig(env, { appUrl: APP, now }) });

  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ data: { id: 'x' }, error: null }), { status: 200 });
    }
    return original(url, options);
  };
  try {
    await sendDailyDealEmail({ email: 'reader@example.com', origin: 'LAX', deals: [deal(now)], userId: 'u1' }, env);
  } finally {
    globalThis.fetch = original;
    _resetSendingGuardForTests();
  }
  const date = now.toISOString().slice(0, 10);
  assert.match(sent[0].html, new RegExp(`href="https://sparkfare\\.com/digest/LAX/${date}\\?utm_source=email`));
  assert.match(sent[0].html, /View in browser/);
  assert.match(sent[0].html, /Edition 1/);
});

test('the emailed digest has no "View in browser" link when the origin has no archived edition', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.exec('CREATE TABLE email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT)');
  const now = new Date();
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'true', ENABLE_EMAIL_V2: 'true', RESEND_API_KEY: 'k', APP_URL: APP };
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ data: { id: 'x' }, error: null }), { status: 200 });
    }
    return original(url, options);
  };
  try {
    await sendDailyDealEmail({ email: 'reader@example.com', origin: 'LAX', deals: [deal(now)], userId: 'u1' }, env);
  } finally {
    globalThis.fetch = original;
    _resetSendingGuardForTests();
  }
  assert.doesNotMatch(sent[0].html, /View in browser/);
});
