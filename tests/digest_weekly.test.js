// E3: the Sunday weekly digest edition. Built from the week's stored daily editions, written by the same
// scheduled archive step, private until ENABLE_DIGEST_ARCHIVE is on.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { archiveEditions, archiveWeeklyEditions, weekEndingSunday, handleDigestRequest, renderDigestSitemap } from '../src/digestArchive.js';

const MIGRATIONS = ['migrations/0002_partners.sql', 'migrations/0013_events.sql', 'migrations/0014_digest_editions.sql'];
const APP = 'https://sparkfare.com';
// 2026-10-11 is a Sunday. Dailies Thu 8, Fri 9, Sat 10, Sun 11.
const at = (day) => new Date(`2026-10-${String(day).padStart(2, '0')}T08:00:00Z`);
const config = async () => ({ appUrl: APP, destinations: { 'Lisbon, Portugal': 'Why go.' }, tips: [], awayMode: null });

function obs(price, end) {
  return Array.from({ length: 20 }, (_, i) => ({ date: new Date(end.getTime() - (20 - i) * 86400000).toISOString().slice(0, 10), price }));
}
function deal(now, name, price, origin = 'LAX') {
  return {
    display_name: name, origin, price, status: 'deal', airline: 'TP',
    booking_link: `https://www.aviasales.com/search/${origin}2310LIS02111?marker=314524`,
    departure_at: '2026-11-20T10:00:00Z', return_at: '2026-11-27T10:00:00Z',
    found_at: new Date(now.getTime() - 3600000).toISOString(), observations: obs(600, now),
  };
}
async function seedDay(env, day, deals) {
  await archiveEditions(env, { now: at(day), loadDeals: async (o) => (o === 'LAX' ? deals : []), buildConfig: config });
}
async function seededWeek(extra = {}) {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db, ...extra };
  await seedDay(env, 8, [deal(at(8), 'Lisbon, Portugal', 410), deal(at(8), 'Tokyo, Japan', 700)]);
  await seedDay(env, 9, [deal(at(9), 'Lisbon, Portugal', 380), deal(at(9), 'Tokyo, Japan', 720)]);
  await seedDay(env, 10, [deal(at(10), 'Lisbon, Portugal', 395), deal(at(10), 'Prague, Czechia', 450)]);
  await seedDay(env, 11, [deal(at(11), 'Lisbon, Portugal', 430)]);
  return { db, env };
}
const weeklyRows = (db) => db.raw.prepare("SELECT * FROM digest_editions WHERE kind = 'weekly' ORDER BY origin").all();

test('weekEndingSunday: a Sunday maps to itself, any other day to the Sunday before', () => {
  assert.equal(weekEndingSunday(new Date('2026-10-11T23:00:00Z')), '2026-10-11');
  assert.equal(weekEndingSunday(new Date('2026-10-12T01:00:00Z')), '2026-10-11');
  assert.equal(weekEndingSunday(new Date('2026-10-17T12:00:00Z')), '2026-10-11');
  assert.equal(weekEndingSunday(new Date('2026-10-18T00:00:00Z')), '2026-10-18');
});

test('the weekly edition keeps the lowest fare per destination across the week and is dated by the Sunday', async () => {
  const { db, env } = await seededWeek();
  const result = await archiveWeeklyEditions(env, { now: at(11), buildConfig: config });
  assert.equal(result.archived, 1);
  const [row] = weeklyRows(db);
  assert.equal(row.origin, 'LAX');
  assert.equal(row.edition_date, '2026-10-11');
  assert.equal(row.edition_number, 1);
  const byName = Object.fromEntries(JSON.parse(row.deals_json).map((d) => [d.display_name, d.price]));
  assert.deepEqual(byName, { 'Lisbon, Portugal': 380, 'Tokyo, Japan': 700, 'Prague, Czechia': 450 });
  assert.match(row.subject, /^This week from/);
  assert.match(row.subject, /Lisbon \$380/);
  assert.ok(row.subject.length <= 58);
  assert.match(row.html_public, /Week ending Sun, Oct 11/);
  assert.match(row.html_public, /Weekly edition 1/);
  assert.doesNotMatch(row.html_public, />NEW<|PRICE DROP|STILL AVAILABLE/, 'no daily-state chips on a weekly');
});

test('it is idempotent, and a missed Sunday run is made up by a later run that week', async () => {
  const { db, env } = await seededWeek();
  assert.equal((await archiveWeeklyEditions(env, { now: at(11), buildConfig: config })).archived, 1);
  assert.equal((await archiveWeeklyEditions(env, { now: new Date('2026-10-11T09:00:00Z'), buildConfig: config })).archived, 0);
  assert.equal(weeklyRows(db).length, 1);

  const { db: db2, env: env2 } = await seededWeek();
  const made = await archiveWeeklyEditions(env2, { now: new Date('2026-10-14T08:00:00Z'), buildConfig: config });
  assert.equal(made.archived, 1);
  assert.equal(made.weekEnding, '2026-10-11');
  assert.equal(weeklyRows(db2)[0].edition_date, '2026-10-11');
});

test('a week with fewer than three days of dailies is skipped, not published thin', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db };
  await seedDay(env, 10, [deal(at(10), 'Lisbon, Portugal', 380)]);
  await seedDay(env, 11, [deal(at(11), 'Lisbon, Portugal', 390)]);
  const result = await archiveWeeklyEditions(env, { now: at(11), buildConfig: config });
  assert.equal(result.archived, 0);
  assert.equal(weeklyRows(db).length, 0);
});

test('weekly editions number sequentially per origin and only look at their own seven days', async () => {
  const { db, env } = await seededWeek();
  await archiveWeeklyEditions(env, { now: at(11), buildConfig: config });
  for (const day of [15, 16, 17]) {
    await archiveEditions(env, { now: at(day), loadDeals: async (o) => (o === 'LAX' ? [deal(at(day), 'Athens, Greece', 500 + day)] : []), buildConfig: config });
  }
  await archiveWeeklyEditions(env, { now: new Date('2026-10-18T08:00:00Z'), buildConfig: config });
  const rows = db.raw.prepare("SELECT edition_date, edition_number, deals_json FROM digest_editions WHERE kind = 'weekly' ORDER BY edition_date").all();
  assert.deepEqual(rows.map((r) => [r.edition_date, r.edition_number]), [['2026-10-11', 1], ['2026-10-18', 2]]);
  assert.deepEqual(JSON.parse(rows[1].deals_json).map((d) => d.display_name), ['Athens, Greece'], 'last week fares do not leak in');
});

test('weekly pages link to route pages, never to a stale affiliate deep link', async () => {
  const { db, env } = await seededWeek();
  await archiveWeeklyEditions(env, { now: at(11), buildConfig: config });
  const html = weeklyRows(db)[0].html_public;
  assert.doesNotMatch(html, /aviasales\.com/);
  assert.match(html, /\/flight\/LAX\//);
});

test('private by default: stored but not served; served and indexable once the archive is on', async () => {
  const { env } = await seededWeek({ ENABLE_DIGEST_ARCHIVE_WRITE: 'true' });
  await archiveWeeklyEditions(env, { now: at(11), buildConfig: config });
  const ask = (path, e, now) => handleDigestRequest(new URL(`${APP}${path}`), e, { appUrl: APP, now, buildConfig: config });
  assert.equal((await ask('/digest/LAX/2026-10-11/weekly', env, at(11))).status, 404);
  assert.doesNotMatch(await (await renderDigestSitemap(env, { appUrl: APP })).text(), /<loc>/);

  const live = { ...env, ENABLE_DIGEST_ARCHIVE: 'true' };
  const page = await ask('/digest/LAX/2026-10-11/weekly', live, at(11));
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /index, follow/);
  assert.match(html, /rel="canonical" href="https:\/\/sparkfare\.com\/digest\/LAX\/2026-10-11\/weekly"/);
  assert.match(await (await renderDigestSitemap(live, { appUrl: APP })).text(), /\/digest\/LAX\/2026-10-11\/weekly/);
  assert.match(await (await ask('/digest', live, at(11))).text(), /Weekly editions/);

  // days later the stored edition is re-rendered with the stale banner and still reads as a weekly
  const later = await (await ask('/digest/LAX/2026-10-11/weekly', live, new Date('2026-10-14T08:00:00Z'))).text();
  assert.match(later, /Fares have likely changed/);
  assert.match(later, /Week ending Sun, Oct 11/);
  assert.doesNotMatch(later, /aviasales\.com/);
});

test('a weekly edition contains no email address, token or unsubscribe link', async () => {
  const { db, env } = await seededWeek({ ENABLE_DIGEST_ARCHIVE: 'true' });
  db.raw.exec("CREATE TABLE users (id TEXT, email TEXT); INSERT INTO users VALUES ('u1', 'subscriber@example.com')");
  await archiveWeeklyEditions(env, { now: at(11), buildConfig: config });
  const row = weeklyRows(db)[0];
  for (const text of [row.html_public, row.deals_json, row.subject]) {
    assert.doesNotMatch(text, /subscriber@example\.com/);
    assert.doesNotMatch(text, /api\/unsubscribe|[?&]token=/);
  }
});

test('the scheduled run calls the weekly step only inside the archive write gate', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const hook = src.indexOf('archiveWeeklyEditions(env,');
  const gate = src.lastIndexOf('if (archiveWriteEnabled(env))', hook);
  assert.ok(hook > 0 && gate > 0 && hook - gate < 900, 'archiveWeeklyEditions is called inside the archiveWriteEnabled gate');
});
