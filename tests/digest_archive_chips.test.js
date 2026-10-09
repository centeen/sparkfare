// The public digest archive used to show every deal as NEW: editions were stored before any classification and
// the template defaults a missing status to 'new'. Editions are now classified against the previous daily edition
// for the same origin, and older rows stored without statuses are classified when they are rendered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { archiveEditions, archiveWeeklyEditions, handleDigestRequest } from '../src/digestArchive.js';

const MIGRATIONS = ['migrations/0002_partners.sql', 'migrations/0013_events.sql', 'migrations/0014_digest_editions.sql'];
const APP = 'https://sparkfare.com';
const at = (day) => new Date(`2026-10-${String(day).padStart(2, '0')}T08:00:00Z`);
const config = async () => ({ appUrl: APP, destinations: {}, tips: [], awayMode: null });

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
async function store(env, day, deals) {
  return archiveEditions(env, { now: at(day), loadDeals: async (o) => (o === 'LAX' ? deals : []), buildConfig: config });
}
const row = (db, day) => db.raw.prepare("SELECT * FROM digest_editions WHERE origin = 'LAX' AND kind = 'daily' AND edition_date = ?").get(`2026-10-${String(day).padStart(2, '0')}`);
const statuses = (r) => Object.fromEntries(JSON.parse(r.deals_json).map((d) => [d.display_name, d.email_status]));
const count = (html, label) => (html.match(new RegExp(`>${label}</span>`, 'g')) || []).length;
const page = async (env, day, now) => (await handleDigestRequest(new URL(`${APP}/digest/LAX/2026-10-${String(day).padStart(2, '0')}`), { ...env, ENABLE_DIGEST_ARCHIVE: 'true' }, { appUrl: APP, now, buildConfig: config })).text();

test('the first edition for an origin is all NEW; the next is classified against it', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db };
  await store(env, 8, [deal(at(8), 'Lisbon, Portugal', 400), deal(at(8), 'Tokyo, Japan', 700)]);
  assert.deepEqual(statuses(row(db, 8)), { 'Lisbon, Portugal': 'new', 'Tokyo, Japan': 'new' });

  await store(env, 9, [deal(at(9), 'Lisbon, Portugal', 380), deal(at(9), 'Tokyo, Japan', 700), deal(at(9), 'Prague, Czechia', 450)]);
  assert.deepEqual(statuses(row(db, 9)), { 'Lisbon, Portugal': 'price_drop', 'Tokyo, Japan': 'still_available', 'Prague, Czechia': 'new' });
});

test('the stored page and the re-rendered later page both show the real chips', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db };
  await store(env, 8, [deal(at(8), 'Lisbon, Portugal', 400), deal(at(8), 'Tokyo, Japan', 700)]);
  await store(env, 9, [deal(at(9), 'Lisbon, Portugal', 380), deal(at(9), 'Tokyo, Japan', 700), deal(at(9), 'Prague, Czechia', 450)]);
  const later = await page(env, 9, at(12)); // not "today", so it is re-rendered from the stored deals
  assert.equal(count(later, 'PRICE DROP'), 1);
  assert.equal(count(later, 'STILL AVAILABLE'), 1);
  assert.equal(count(later, 'NEW'), 1);
  const today = await page(env, 9, at(9)); // "today" is served as written
  assert.equal(count(today, 'PRICE DROP'), 1);
  assert.equal(count(today, 'NEW'), 1);
});

test('editions stored before this change (no statuses) are classified when rendered', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db };
  await store(env, 8, [deal(at(8), 'Lisbon, Portugal', 400)]);
  await store(env, 9, [deal(at(9), 'Lisbon, Portugal', 380), deal(at(9), 'Prague, Czechia', 450)]);
  // Simulate legacy rows: strip the statuses from both stored editions.
  for (const day of [8, 9]) {
    const r = row(db, day);
    const bare = JSON.parse(r.deals_json).map(({ email_status, ...rest }) => rest);
    db.raw.prepare('UPDATE digest_editions SET deals_json = ? WHERE id = ?').run(JSON.stringify(bare), r.id);
  }
  const later = await page(env, 9, at(12));
  assert.equal(count(later, 'PRICE DROP'), 1);
  assert.equal(count(later, 'NEW'), 1);
  // The first edition has nothing before it, so it stays all NEW.
  assert.equal(count(await page(env, 8, at(12)), 'NEW'), 1);
});

test('a failed classification lookup still stores the edition, with the default chips', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db };
  await store(env, 8, [deal(at(8), 'Lisbon, Portugal', 400)]);
  const real = db.prepare;
  db.prepare = (sql) => { if (/edition_date < \?/.test(sql)) throw new Error('simulated D1 failure'); return real(sql); };
  const originalError = console.error;
  console.error = () => {};
  try {
    const r = await store(env, 9, [deal(at(9), 'Lisbon, Portugal', 380)]);
    assert.equal(r.archived, 1);
  } finally { console.error = originalError; db.prepare = real; }
  assert.ok(row(db, 9), 'the edition was written');
});

test('weekly editions carry no chips', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE_WRITE: 'true' };
  for (const day of [8, 9, 10, 11]) await store(env, day, [deal(at(day), 'Lisbon, Portugal', 400 - day), deal(at(day), 'Tokyo, Japan', 700)]);
  await archiveWeeklyEditions(env, { now: at(11), buildConfig: config });
  const html = await (await handleDigestRequest(new URL(`${APP}/digest/LAX/2026-10-11/weekly`), { ...env, ENABLE_DIGEST_ARCHIVE: 'true' }, { appUrl: APP, now: at(12), buildConfig: config })).text();
  assert.equal(count(html, 'NEW') + count(html, 'PRICE DROP') + count(html, 'STILL AVAILABLE'), 0);
});
