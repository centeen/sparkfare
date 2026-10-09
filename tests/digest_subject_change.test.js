// Consecutive daily digests used to share a subject line (6 of 12 origins on Oct 8 and Oct 9) because the subject
// was always "<top deal> from <city> + N more". When a day-over-day comparison was really made, the subject now
// leads with what changed: the biggest price drop, else a new route. The archive's browse list also hides origins
// that have no edition yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { renderDailyDigest } from '../src/emailTemplates/dailyDigest.js';
import { classifyDeals } from '../src/digestChange.js';
import { archiveEditions, handleDigestRequest } from '../src/digestArchive.js';

const NOW = new Date('2026-10-12T08:00:00Z');
const CONFIG = { appUrl: 'https://sparkfare.com', destinations: {}, tips: [], awayMode: null };
const obs = (price) => Array.from({ length: 20 }, (_, i) => ({ date: new Date(NOW.getTime() - (20 - i) * 86400000).toISOString().slice(0, 10), price }));
const fare = (name, price, extra = {}) => ({
  display_name: name, origin: 'LAX', price, status: 'deal', airline: 'TP',
  booking_link: 'https://www.aviasales.com/search/LAX2310LIS02111?marker=314524',
  departure_at: '2026-11-20T10:00:00Z', return_at: '2026-11-27T10:00:00Z',
  found_at: new Date(NOW.getTime() - 3600000).toISOString(), observations: obs(800), ...extra,
});
const subjectOf = (deals, weekly = null) => renderDailyDigest({ origin: 'LAX', deals, user: { id: 'u' }, now: NOW, config: CONFIG, weekly }).subject;
const PLAIN = subjectOf([fare('Lisbon, Portugal', 400), fare('Tokyo, Japan', 700), fare('Prague, Czechia', 450)]);

test('with no comparison made, the subject is the plain one (nothing changes for unclassified digests)', () => {
  assert.match(PLAIN, /^Lisbon Portugal|^Lisbon/);
  assert.doesNotMatch(PLAIN, /down \$|^New from/);
});

test('a price drop leads, named with its dollar amount', () => {
  const s = subjectOf([
    fare('Lisbon, Portugal', 400, { email_status: 'still_available', previous_price: 400 }),
    fare('Madrid, Spain', 421, { email_status: 'price_drop', previous_price: 558 }),
    fare('Tokyo, Japan', 700, { email_status: 'still_available', previous_price: 700 }),
  ]);
  assert.equal(s, 'Madrid down $137 to $421 from Los Angeles + 2 more');
  assert.ok(s.length <= 58);
});

test('the biggest drop wins when several fares dropped', () => {
  const s = subjectOf([
    fare('Lisbon, Portugal', 380, { email_status: 'price_drop', previous_price: 400 }),
    fare('Madrid, Spain', 421, { email_status: 'price_drop', previous_price: 558 }),
  ]);
  assert.match(s, /^Madrid down \$137 to \$421/);
});

test('a new route leads only when some routes are new and some are not', () => {
  const s = subjectOf([
    fare('Lisbon, Portugal', 400, { email_status: 'still_available', previous_price: 400 }),
    fare('Prague, Czechia', 450, { email_status: 'new' }),
  ]);
  assert.equal(s, 'New from Los Angeles: Prague $450 + 1 more');
});

test('a first edition (everything NEW) or an all-unchanged one keeps the plain subject', () => {
  const allNew = subjectOf([fare('Lisbon, Portugal', 400, { email_status: 'new' }), fare('Tokyo, Japan', 700, { email_status: 'new' })]);
  assert.doesNotMatch(allNew, /^New from/);
  const unchanged = subjectOf([fare('Lisbon, Portugal', 400, { email_status: 'still_available', previous_price: 400 })]);
  assert.doesNotMatch(unchanged, /down \$|^New from/);
});

test('the subject never exceeds 58 characters, falling back to the airport code', () => {
  const s = subjectOf([fare('Ho Chi Minh City, Vietnam', 384, { email_status: 'price_drop', previous_price: 1384 }), fare('Tokyo, Japan', 700, { email_status: 'still_available', previous_price: 700 })]);
  assert.ok(s.length <= 58, s);
  assert.match(s, /^Ho Chi Minh City down \$1000/);
});

test('weekly editions are not affected', () => {
  const s = subjectOf([fare('Madrid, Spain', 421, { email_status: 'price_drop', previous_price: 558 })], { weekEnding: '2026-10-11' });
  assert.match(s, /^This week from/);
});

test('classifyDeals records the previous price only when there was one', () => {
  const r = classifyDeals([fare('Madrid, Spain', 421), fare('Prague, Czechia', 450)], [{ display_name: 'Madrid, Spain', price: 558 }]);
  const by = Object.fromEntries(r.deals.map((d) => [d.display_name, d]));
  assert.equal(by['Madrid, Spain'].previous_price, 558);
  assert.equal('previous_price' in by['Prague, Czechia'], false);
});

// ---- the archive ---------------------------------------------------------------------------------------

const MIGRATIONS = ['migrations/0002_partners.sql', 'migrations/0013_events.sql', 'migrations/0014_digest_editions.sql'];
const at = (day) => new Date(`2026-10-${String(day).padStart(2, '0')}T08:00:00Z`);
const store = (env, day, deals) => archiveEditions(env, { now: at(day), loadDeals: async (o) => (o === 'LAX' ? deals : []), buildConfig: async () => CONFIG });
const withAt = (day, price, name = 'Lisbon, Portugal') => fare(name, price, { found_at: new Date(at(day).getTime() - 3600000).toISOString(), observations: obs(800) });

test('stored editions get distinct subjects when something changed, and the drop is named', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db };
  await store(env, 8, [withAt(8, 400), withAt(8, 558, 'Madrid, Spain')]);
  await store(env, 9, [withAt(9, 400), withAt(9, 421, 'Madrid, Spain')]);
  const subjects = db.raw.prepare("SELECT edition_date, subject FROM digest_editions WHERE kind = 'daily' ORDER BY edition_date").all();
  assert.equal(subjects.length, 2);
  assert.notEqual(subjects[0].subject, subjects[1].subject);
  assert.match(subjects[1].subject, /^Madrid down \$137 to \$421 from Los Angeles/);
});

test('the browse list on /digest links only origins that have an edition', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'true' };
  await store(env, 8, [withAt(8, 400)]);
  const html = await (await handleDigestRequest(new URL('https://sparkfare.com/digest'), env, { appUrl: 'https://sparkfare.com', now: at(9), buildConfig: async () => CONFIG })).text();
  assert.match(html, /href="\/digest\/LAX"/);
  for (const empty of ['DEN', 'PHX', 'LAS', 'JFK']) assert.doesNotMatch(html, new RegExp(`href="/digest/${empty}"`), empty);
  // An empty origin's own page still answers (a direct link or an old bookmark), it is just not advertised.
  const den = await handleDigestRequest(new URL('https://sparkfare.com/digest/DEN'), env, { appUrl: 'https://sparkfare.com', now: at(9), buildConfig: async () => CONFIG });
  assert.equal(den.status, 200);
});
