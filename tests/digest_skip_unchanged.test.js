// E3 skip-if-unchanged (ROADMAP step 21). The daily digest compares each origin's deals with what was last
// emailed and skips a subscriber only when nothing is new or cheaper. Runs the real sendDailyAlerts against a
// real SQLite D1 (the repo's migrations), with no Resend key so sends are mocked and counted by the result.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { sendDailyAlerts } from '../src/index.js';
import { classifyDeals, shouldSkipUser, daysBetween, loadPreviousSnapshot, recordSnapshot, DIGEST_CHANGE } from '../src/digestChange.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const TODAY = day(0);

const now = Date.now();
const obs = (base) => Array.from({ length: 15 }, (_, i) => ({ price: base + (14 - i) * 2, date: new Date(now - (14 - i) * 86400000).toISOString() }));
const foundAt = new Date(now - 3600000).toISOString();
const fare = (name, price) => ({ display_name: name, route_key: `JFK:${name}`, origin: 'JFK', price, found_at: foundAt, observations: obs(price) });
const assets = (deals) => ({
  async fetch(request) {
    const file = new URL(request.url).pathname.replace(/^\//, '');
    if (file !== 'sparkfare_ranked_deals.json') return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify({ generated_at: new Date().toISOString(), deals, featured: [] }), { status: 200 });
  },
});

function setup({ deals, flag = 'true', users = ['a@example.com'], extraEnv = {} } = {}) {
  const db = makeSqliteD1(MIGRATIONS);
  // Production has this (the 07:00 early run creates it); the 08:00 general run only reads it.
  db.raw.exec('CREATE TABLE IF NOT EXISTS early_bird_snapshots (route_key TEXT NOT NULL, snapshot_date TEXT NOT NULL, price INTEGER, PRIMARY KEY (route_key, snapshot_date))');
  for (const email of users) {
    db.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed, created_at) VALUES (?, ?, 1, 'JFK', 1, ?)")
      .run(`u_${email}`, email, new Date().toISOString());
  }
  const env = { DB: db, ASSETS: assets(deals), ...extraEnv, ...(flag === null ? {} : { ENABLE_DIGEST_SKIP_UNCHANGED: flag }) };
  return { db, env };
}
async function baseline(db, deals, sentOn = day(-1)) {
  await recordSnapshot({ DB: db }, 'JFK', sentOn, deals);
}
function sentBefore(db, email, delivered_on) {
  db.raw.exec("CREATE TABLE IF NOT EXISTS daily_alert_deliveries (delivery_key TEXT PRIMARY KEY, email TEXT NOT NULL, delivered_on TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT DEFAULT (datetime('now')))");
  db.raw.prepare("INSERT INTO daily_alert_deliveries (delivery_key, email, delivered_on, status) VALUES (?, ?, ?, 'sent')").run(`${email}:${delivered_on}`, email, delivered_on);
}
const status = (db, email) => db.raw.prepare('SELECT status FROM daily_alert_deliveries WHERE delivery_key = ?').get(`${email}:${TODAY}`)?.status;
const events = (db, type) => db.raw.prepare('SELECT * FROM events WHERE event_type = ?').all(type);

const DEALS = [fare('Lisbon, Portugal', 400), fare('Tokyo, Japan', 700)];

// ---- classification ------------------------------------------------------------------------------------

test('classifyDeals: new, price drop, still available, and the drop threshold', () => {
  const previous = [{ display_name: 'Lisbon, Portugal', price: 400 }, { display_name: 'Tokyo, Japan', price: 700 }, { display_name: 'Oslo, Norway', price: 300 }];
  const r = classifyDeals([fare('Lisbon, Portugal', 400), fare('Tokyo, Japan', 650), fare('Prague, Czechia', 450)], previous);
  const by = Object.fromEntries(r.deals.map((d) => [d.display_name, d.email_status]));
  assert.deepEqual(by, { 'Lisbon, Portugal': 'still_available', 'Tokyo, Japan': 'price_drop', 'Prague, Czechia': 'new' });
  assert.equal(r.changed, true);
  assert.deepEqual(r.counts, { new: 1, price_drop: 1, still_available: 1 });

  // $5 off a $400 fare is below max($10, 2%) = $10: noise, not a drop. $10 off is a drop.
  const small = classifyDeals([fare('Lisbon, Portugal', 395)], [{ display_name: 'Lisbon, Portugal', price: 400 }]);
  assert.equal(small.deals[0].email_status, 'still_available');
  assert.equal(small.changed, false);
  assert.equal(classifyDeals([fare('Lisbon, Portugal', 390)], [{ display_name: 'Lisbon, Portugal', price: 400 }]).deals[0].email_status, 'price_drop');
  // 2% of $1000 is $20, which beats the $10 floor.
  assert.equal(classifyDeals([fare('Bali, Indonesia', 985)], [{ display_name: 'Bali, Indonesia', price: 1000 }]).deals[0].email_status, 'still_available');
  assert.equal(classifyDeals([fare('Bali, Indonesia', 980)], [{ display_name: 'Bali, Indonesia', price: 1000 }]).deals[0].email_status, 'price_drop');
  // A higher price, or a route that disappeared, is not a reason to email.
  assert.equal(classifyDeals([fare('Lisbon, Portugal', 450)], [{ display_name: 'Lisbon, Portugal', price: 400 }]).changed, false);
  assert.equal(classifyDeals([fare('Lisbon, Portugal', 400)], [{ display_name: 'Lisbon, Portugal', price: 400 }, { display_name: 'Gone, Nowhere', price: 100 }]).changed, false);
});

test('classifyDeals: no previous digest means everything is new and the digest goes out; inputs are not mutated', () => {
  const input = [fare('Lisbon, Portugal', 400)];
  for (const previous of [null, []]) {
    const r = classifyDeals(input, previous);
    assert.equal(r.changed, true);
    assert.equal(r.deals[0].email_status, 'new');
  }
  assert.equal(input[0].email_status, undefined, 'the cached deal objects are shared across users and must not be mutated');
});

test('shouldSkipUser: only when unchanged, previously sent, and recent', () => {
  const today = '2026-10-12';
  assert.equal(shouldSkipUser({ changed: true, lastSentOn: '2026-10-11', today }), false);
  assert.equal(shouldSkipUser({ changed: false, lastSentOn: null, today }), false, 'a subscriber who never got one always gets one');
  assert.equal(shouldSkipUser({ changed: false, lastSentOn: '2026-10-11', today }), true);
  assert.equal(shouldSkipUser({ changed: false, lastSentOn: '2026-10-09', today }), true, `${DIGEST_CHANGE.MAX_QUIET_DAYS - 1} days quiet is still skipped`);
  assert.equal(shouldSkipUser({ changed: false, lastSentOn: '2026-10-08', today }), false, 'not silent for MAX_QUIET_DAYS or more');
  assert.equal(daysBetween('2026-10-08', '2026-10-12'), 4);
});

test('the baseline is the latest snapshot from an earlier day, so the 07:00 and 08:00 runs share one', async () => {
  const { db } = setup();
  await recordSnapshot({ DB: db }, 'JFK', day(-3), [fare('Old, Place', 100)]);
  await recordSnapshot({ DB: db }, 'JFK', day(-1), DEALS);
  await recordSnapshot({ DB: db }, 'JFK', TODAY, [fare('Today, Place', 1)]);
  const previous = await loadPreviousSnapshot({ DB: db }, 'JFK', TODAY);
  assert.deepEqual(previous.map((d) => d.display_name), ['Lisbon, Portugal', 'Tokyo, Japan']);
  await recordSnapshot({ DB: db }, 'JFK', TODAY, [fare('Second, Write', 2)]);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM digest_sent_snapshots WHERE sent_on = ?').get(TODAY).n, 1, 'first send of the day wins');
  assert.equal(await loadPreviousSnapshot({ DB: db }, 'LAX', TODAY), null);
});

// ---- the send path -------------------------------------------------------------------------------------

test('flag on, nothing new or cheaper, sent yesterday: skipped, recorded, and logged', async () => {
  const { db, env } = setup({ deals: DEALS });
  await baseline(db, DEALS);
  sentBefore(db, 'a@example.com', day(-1));
  const r = await sendDailyAlerts(env);
  assert.equal(r.sent, 0);
  assert.equal(r.unchanged, 1);
  assert.equal(status(db, 'a@example.com'), 'unchanged');
  assert.equal(events(db, 'digest_skipped_unchanged').length, 1);
  assert.equal(events(db, 'alert_email_sent').length, 0);
});

test('flag on: a new route, or a real price drop, sends', async () => {
  for (const deals of [[...DEALS, fare('Prague, Czechia', 450)], [fare('Lisbon, Portugal', 380), fare('Tokyo, Japan', 700)]]) {
    const { db, env } = setup({ deals });
    await baseline(db, DEALS);
    sentBefore(db, 'a@example.com', day(-1));
    const r = await sendDailyAlerts(env);
    assert.equal(r.sent, 1);
    assert.equal(r.unchanged, 0);
    assert.equal(status(db, 'a@example.com'), 'sent');
  }
});

test('flag on, unchanged: a subscriber who never got a digest, or who has been quiet 4+ days, still gets one', async () => {
  for (const lastSent of [null, day(-4), day(-10)]) {
    const { db, env } = setup({ deals: DEALS });
    await baseline(db, DEALS);
    if (lastSent) sentBefore(db, 'a@example.com', lastSent);
    const r = await sendDailyAlerts(env);
    assert.equal(r.sent, 1, `last sent ${lastSent}`);
  }
});

test('flag off or any other value: unchanged days still send, exactly as before', async () => {
  for (const flag of ['false', null, 'TRUE', '1', '']) {
    const { db, env } = setup({ deals: DEALS, flag });
    await baseline(db, DEALS);
    sentBefore(db, 'a@example.com', day(-1));
    const r = await sendDailyAlerts(env);
    assert.equal(r.sent, 1, `flag ${JSON.stringify(flag)}`);
    assert.equal(r.unchanged, 0);
  }
});

test('a successful send records the origin snapshot once, with the flag off too', async () => {
  const { db, env } = setup({ deals: DEALS, flag: 'false', users: ['a@example.com', 'b@example.com'] });
  const r = await sendDailyAlerts(env);
  assert.equal(r.sent, 2);
  const rows = db.raw.prepare('SELECT * FROM digest_sent_snapshots').all();
  assert.equal(rows.length, 1);
  assert.deepEqual(JSON.parse(rows[0].deals_json), [{ display_name: 'Lisbon, Portugal', price: 400 }, { display_name: 'Tokyo, Japan', price: 700 }]);
});

test('fails open: a broken snapshot table never stops a digest', async () => {
  const { db, env } = setup({ deals: DEALS });
  sentBefore(db, 'a@example.com', day(-1));
  const real = db.prepare;
  db.prepare = (sql) => { if (/digest_sent_snapshots/.test(sql)) throw new Error('simulated D1 failure'); return real(sql); };
  const originalError = console.error;
  console.error = () => {};
  try {
    const r = await sendDailyAlerts(env);
    assert.equal(r.sent, 1);
    assert.equal(r.unchanged, 0);
  } finally { console.error = originalError; }
});

test('chips: with the v2 email on, the email carries NEW / PRICE DROP / STILL AVAILABLE from the comparison', async () => {
  const { db, env } = setup({
    deals: [fare('Lisbon, Portugal', 380), fare('Tokyo, Japan', 700), fare('Prague, Czechia', 450)],
    extraEnv: { RESEND_API_KEY: 're_test', EMAIL_FROM: 'hello@sparkfare.com', ENABLE_EMAIL_V2: 'true', APP_URL: 'https://sparkfare.com' },
  });
  await baseline(db, DEALS);
  sentBefore(db, 'a@example.com', day(-1));
  const bodies = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    bodies.push(String(init?.body || ''));
    return new Response(JSON.stringify({ id: 'x' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const r = await sendDailyAlerts(env);
    assert.equal(r.sent, 1);
  } finally { globalThis.fetch = original; }
  const html = bodies.find((b) => b.includes('Lisbon')) || '';
  assert.match(html, /PRICE DROP/);
  assert.match(html, /STILL AVAILABLE/);
  assert.match(html, /NEW/);
});

// ---- wiring --------------------------------------------------------------------------------------------

test('wrangler.jsonc ships the flag off, read in exactly one place, and a migration keeps a fresh DB in step', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_DIGEST_SKIP_UNCHANGED":\s*"false"/);
  const sources = ['src/index.js', 'src/email.js', 'src/digestArchive.js', 'src/digestChange.js'].map((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
  const reads = sources.join('\n').split('\n').filter((l) => l.includes('ENABLE_DIGEST_SKIP_UNCHANGED') && !l.trim().startsWith('//'));
  assert.equal(reads.length, 1, 'one read, in skipUnchangedEnabled()');
  assert.ok(MIGRATIONS.includes('migrations/0018_digest_sent_snapshots.sql'));
});
