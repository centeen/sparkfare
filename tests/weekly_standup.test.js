// ROADMAP step 65: the weekly standup brief. Counts only, no personal data, silent about nothing it does not
// know (a missing table shows as n/a), sent once per week, killable with ENABLE_WEEKLY_STANDUP=false.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { computeWeeklyStandup, renderWeeklyStandup, sendWeeklyStandup } from '../src/weeklyStandup.js';
import { sendWeeklyStandupEmail } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const NOW = new Date('2026-10-12T09:00:00Z'); // a Monday
const ago = (days, hour = 12) => { const d = new Date(NOW.getTime() - days * 86400000); d.setUTCHours(hour, 0, 0, 0); return d.toISOString().slice(0, 19).replace('T', ' '); };
const ctx = { waitUntil: (p) => p };

function seededDb() {
  const DB = makeSqliteD1(MIGRATIONS);
  DB.raw.exec(`CREATE TABLE IF NOT EXISTS trips (trip_id TEXT PRIMARY KEY, user_id TEXT, destination TEXT, origin_iata TEXT, departure_at TEXT, return_at TEXT, price_at_click INTEGER, clicked_at TEXT DEFAULT (datetime('now')), status TEXT DEFAULT 'clicked', price_eur REAL)`);
  const ev = DB.raw.prepare('INSERT INTO events (id, event_type, partner, route, source, meta, ts) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let n = 0;
  const add = (type, daysAgo, { partner = null, route = null, source = null, meta = null } = {}) => ev.run(`e${++n}`, type, partner, route, source, meta, ago(daysAgo));
  // this week (0 to 7 days before NOW)
  for (const [d, src] of [[1, 'check'], [2, null], [3, 'digest_archive']]) add('signup', d, { source: src });
  add('referral_signup', 2);
  for (const d of [1, 1, 2, 4]) add('check_run', d, { route: 'Bali, Indonesia' });
  add('check_run', 5, { route: 'Tokyo, Japan' });
  add('check_share', 3); add('check_signup', 3);
  for (let i = 0; i < 10; i++) add('alert_email_sent', 1 + (i % 5));
  for (let i = 0; i < 4; i++) add('email_open', 2);
  add('email_bounce', 3);
  add('outbound_click', 1, { partner: 'wise', meta: JSON.stringify({ ua_class: 'human' }) });
  add('outbound_click', 2, { partner: 'wise', meta: null }); // a click from before the class existed still counts
  add('outbound_click', 2, { partner: 'yesim', meta: JSON.stringify({ ua_class: 'none' }) });
  add('outbound_click', 3, { partner: 'wise', meta: JSON.stringify({ ua_class: 'bot' }) });
  add('outbound_click', 3, { partner: 'yesim', meta: JSON.stringify({ ua_class: 'bot', slot: '2' }) });
  // the week before (7 to 14 days before NOW)
  add('signup', 9, {}); add('check_run', 10, { route: 'Bali, Indonesia' }); add('check_run', 11, { route: 'Bali, Indonesia' });
  for (let i = 0; i < 6; i++) add('alert_email_sent', 9);
  // outside both windows
  add('signup', 30); add('check_run', 20);

  DB.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, trip_length, created_at) VALUES ('u_secret1', 'secret1@example.com', 1, 'JFK', '7-10', ?)").run(ago(2));
  DB.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, trip_length, created_at) VALUES ('u_secret2', 'secret2@example.com', 0, 'LAX', '7-10', ?)").run(ago(3));
  DB.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, trip_length, created_at, unsubscribed_at) VALUES ('u_secret3', 'secret3@example.com', 1, 'ORD', '7-10', ?, ?)").run(ago(40), ago(1));
  DB.raw.prepare("INSERT INTO email_suppressions (email, reason, created_at) VALUES ('secret3@example.com', 'unsubscribed', ?)").run(ago(1));
  DB.raw.prepare("INSERT INTO trips (trip_id, user_id, destination, origin_iata, departure_at, price_at_click, clicked_at, status, price_eur) VALUES ('t1', 'u_secret1', 'Lisbon, Portugal', 'JFK', '2026-12-01', 400, ?, 'booked', 380.5)").run(ago(2));
  DB.raw.prepare("INSERT INTO trips (trip_id, user_id, destination, origin_iata, departure_at, price_at_click, clicked_at) VALUES ('t2', 'u_secret1', 'Tokyo, Japan', 'JFK', '2026-12-05', 900, ?)").run(ago(12));
  return DB;
}

test('computeWeeklyStandup: this week against the week before, bots left out of clicks, old rows still counted', async () => {
  const m = await computeWeeklyStandup({ DB: seededDb() }, { now: NOW });
  assert.deepEqual([m.signups.week, m.signups.prev], [3, 1]);
  assert.equal(m.referralSignups.week, 1);
  assert.deepEqual(m.signupSources.map((r) => [r.label, r.n]).sort(), [['check', 1], ['digest_archive', 1], ['direct', 1]]);
  assert.deepEqual([m.checkRuns.week, m.checkRuns.prev], [5, 2]);
  assert.equal(m.checkShares.week, 1);
  assert.equal(m.checkSignups.week, 1);
  assert.deepEqual(m.topChecked.map((r) => [r.label, r.n]), [['Bali, Indonesia', 4], ['Tokyo, Japan', 1]]);
  assert.deepEqual([m.emailsSent.week, m.emailsSent.prev], [10, 6]);
  assert.equal(m.emailOpens.week, 4);
  assert.equal(m.bounces.week, 1);
  assert.equal(m.complaints.week, 0);
  assert.equal(m.unsubscribes.week, 1);
  assert.equal(m.clicks.week, 3, 'human + legacy (no class) + none');
  assert.equal(m.botClicks.week, 2);
  assert.deepEqual(m.topPartners.map((r) => [r.label, r.n]), [['wise', 2], ['yesim', 1]], 'bot clicks excluded from the partner ranking');
  assert.deepEqual([m.tripsTracked.week, m.tripsTracked.prev], [1, 1]);
  assert.deepEqual({ users: m.totals.users, verified: m.totals.verified, unsub: m.totals.unsubscribed, booked: m.totals.bookingsReported, eur: m.totals.revenueEur }, { users: 3, verified: 2, unsub: 1, booked: 1, eur: 380.5 });
  assert.equal(m.verifiedNew.week, 1);
});

test('the rendered brief contains counts and no email address or user id', async () => {
  const m = await computeWeeklyStandup({ DB: seededDb() }, { now: NOW });
  const { subject, html, text } = renderWeeklyStandup(m);
  for (const out of [subject, html, text]) {
    assert.doesNotMatch(out, /secret\d@example\.com|u_secret|@example\.com/);
  }
  assert.match(subject, /Sparkfare weekly, Oct 5 to Oct 12: 3 signups, 5 price checks/);
  assert.match(text, /New signups: 3 \(\+2 vs last week\)/);
  assert.match(text, /Checks run: 5 \(\+3 vs last week\)/);
  assert.match(text, /Digests sent: 10 \(\+4 vs last week\); opens: 4; open rate: 40%/);
  assert.match(text, /Partner and fare clicks \(bots excluded\): 3.*flagged as bots: 2/);
  assert.match(text, /Most checked routes: Bali, Indonesia \(4\), Tokyo, Japan \(1\)/);
  assert.match(html, /<h2[^>]*>People<\/h2>/);
});

test('flags: pipeline problems, a tripped guard, complaints and bounces, a silent digest, the partner revenue nudge', async () => {
  const DB = seededDb();
  DB.raw.exec("INSERT INTO events (id, event_type, ts) VALUES ('c1', 'email_complaint', datetime('now'))");
  const healthy = await computeWeeklyStandup({ DB }, { now: NOW, pipeline: { problems: [], details: [{ file: 'sparkfare_ranked_deals.json', ageHours: 5, maxAgeHours: 36 }], guard: { tripped: false } } });
  assert.ok(healthy.flags.some((f) => /1 email bounce this week/.test(f)));
  assert.ok(!healthy.flags.some((f) => /sending guard/.test(f)));
  assert.ok(healthy.flags.some((f) => /partner revenue/.test(f)), 'the 12th, with no partner_conversions row this month');

  const bad = await computeWeeklyStandup({ DB }, {
    now: NOW,
    pipeline: { problems: ['JFK daily deals is 40 hours old'], details: [], guard: { tripped: true, reason: '12 bounces with only 50 sends logged' } },
  });
  assert.ok(bad.flags.includes('JFK daily deals is 40 hours old'));
  assert.ok(bad.flags.some((f) => /sending guard is tripped \(12 bounces/.test(f)));

  const quiet = seededDb();
  quiet.raw.exec("DELETE FROM events WHERE event_type = 'alert_email_sent'");
  assert.ok((await computeWeeklyStandup({ DB: quiet }, { now: NOW })).flags.some((f) => /No digest emails were sent.*2 verified subscribers/.test(f)));
});

test('a healthy week with a partner row entered has nothing flagged', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  DB.raw.exec("INSERT INTO partner_conversions (slug, month, reported_conversions, reported_revenue) VALUES ('wise', '2026-10', 1, 5)");
  const m = await computeWeeklyStandup({ DB }, { now: NOW, pipeline: { problems: [], details: [], guard: { tripped: false } } });
  assert.deepEqual(m.flags, []);
  assert.match(renderWeeklyStandup(m).text, /Nothing flagged\./);
});

test('flag text is HTML-escaped in the email body', () => {
  const m = { window: { start: NOW.toISOString(), end: NOW.toISOString(), key: '2026-10-05' }, flags: ['<script>alert(1)</script>'], pipeline: [],
    signups: {}, verifiedNew: {}, referralSignups: {}, signupSources: [], checkRuns: {}, checkShares: {}, checkSignups: {}, topChecked: [], emailsSent: {}, emailOpens: {}, bounces: {}, complaints: {},
    unsubscribes: {}, clicks: {}, botClicks: {}, topPartners: [], tripsTracked: {}, watchlistsCreated: {}, watchlistsNotified: {}, digestEditions: {}, totals: {} };
  const { html } = renderWeeklyStandup(m);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('missing tables show as n/a and never stop the brief', async () => {
  const DB = makeSqliteD1([]); // an empty database: no table of any kind
  const m = await computeWeeklyStandup({ DB }, { now: NOW });
  assert.equal(m.signups.week, null);
  const { text } = renderWeeklyStandup(m);
  assert.match(text, /New signups: n\/a/);
  assert.match(text, /Digests sent: n\/a.*open rate: n\/a/);
});

function stubResend() {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ id: 'standup-id' }), { status: 200 }); }
    return new Response('{}', { status: 200 });
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}
const send = sendWeeklyStandupEmail;

test('sending: goes to the ops address, is recorded, is skipped the second time that week, and force overrides', async () => {
  const net = stubResend();
  try {
    const DB = seededDb();
    const env = { DB, RESEND_API_KEY: 'k' };
    const first = await sendWeeklyStandup(env, { now: NOW, send });
    assert.equal(first.sent, true);
    assert.equal(net.sent.length, 1);
    assert.equal(net.sent[0].to, 'hello@sparkfare.com');
    assert.match(net.sent[0].subject, /^Sparkfare weekly/);
    assert.ok(net.sent[0].html && net.sent[0].text);
    assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'weekly_standup_sent' AND sub_id = '2026-10-05'").get().n, 1);

    const second = await sendWeeklyStandup(env, { now: NOW, send });
    assert.equal(second.sent, false);
    assert.match(second.reason, /already sent for the week starting 2026-10-05/);
    assert.equal(net.sent.length, 1);

    const forced = await sendWeeklyStandup(env, { now: NOW, send, force: true });
    assert.equal(forced.sent, true);
    assert.equal(net.sent.length, 2);

    const nextWeek = await sendWeeklyStandup(env, { now: new Date(NOW.getTime() + 7 * 86400000), send });
    assert.equal(nextWeek.sent, true, 'a new week sends again');
  } finally { net.restore(); }
});

test('a mocked send (no Resend key) is not recorded as sent', async () => {
  const DB = seededDb();
  const r = await sendWeeklyStandup({ DB }, { now: NOW, send });
  assert.equal(r.mocked, true);
  assert.equal(r.sent, false);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'weekly_standup_sent'").get().n, 0);
});

test('ENABLE_WEEKLY_STANDUP=false stops it; any other value, or unset, leaves it on', async () => {
  const net = stubResend();
  try {
    const off = await sendWeeklyStandup({ DB: seededDb(), RESEND_API_KEY: 'k', ENABLE_WEEKLY_STANDUP: 'false' }, { now: NOW, send });
    assert.equal(off.sent, false);
    assert.match(off.reason, /disabled/);
    assert.equal(net.sent.length, 0);
    for (const v of [undefined, 'true', 'FALSE', '0', '']) {
      const env = { DB: seededDb(), RESEND_API_KEY: 'k', ...(v === undefined ? {} : { ENABLE_WEEKLY_STANDUP: v }) };
      assert.equal((await sendWeeklyStandup(env, { now: NOW, send })).sent, true, JSON.stringify(v));
    }
  } finally { net.restore(); }
});

test('a dry run returns the metrics and the text and sends and records nothing', async () => {
  const net = stubResend();
  try {
    const DB = seededDb();
    const r = await sendWeeklyStandup({ DB, RESEND_API_KEY: 'k' }, { now: NOW, send, dryRun: true });
    assert.equal(r.dryRun, true);
    assert.equal(r.metrics.signups.week, 3);
    assert.match(r.text, /Sparkfare weekly/);
    assert.equal(net.sent.length, 0);
    assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'weekly_standup_sent'").get().n, 0);
  } finally { net.restore(); }
});

test('no database: nothing happens and nothing throws', async () => {
  assert.deepEqual(await sendWeeklyStandup({}, { now: NOW, send }), { ok: true, sent: false, reason: 'DB not configured' });
  assert.equal(await computeWeeklyStandup({}, { now: NOW }), null);
});

test('POST /api/send-weekly-standup: 401 without the admin secret; ?dry=1 with it previews and sends nothing', async () => {
  const net = stubResend();
  try {
    const env = { DB: seededDb(), ADMIN_SECRET: 's3cret', RESEND_API_KEY: 'k' };
    const denied = await worker.fetch(new Request('https://sparkfare.com/api/send-weekly-standup?dry=1', { method: 'POST' }), env, ctx);
    assert.equal(denied.status, 401);
    const ok = await worker.fetch(new Request('https://sparkfare.com/api/send-weekly-standup?dry=1', { method: 'POST', headers: { Authorization: 'Bearer s3cret' } }), env, ctx);
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.dryRun, true);
    assert.ok(body.subject.startsWith('Sparkfare weekly'));
    assert.equal(net.sent.length, 0);
  } finally { net.restore(); }
});

test('the Monday 09:00 UTC cron sends the standup after the link check, and the flag ships on', async () => {
  const net = stubResend();
  const originalError = console.error;
  console.error = () => {};
  try {
    const DB = seededDb();
    await worker.scheduled({ cron: '0 9 * * 1' }, { DB, RESEND_API_KEY: 'k' });
    assert.ok(net.sent.some((m) => /^Sparkfare weekly/.test(m.subject)), 'the Monday run sends the brief');
    // the other crons do not
    net.sent.length = 0;
    await worker.scheduled({ cron: '0 8 * * *' }, { DB: seededDb(), RESEND_API_KEY: 'k' });
    assert.ok(!net.sent.some((m) => /^Sparkfare weekly/.test(m.subject)));
  } finally { console.error = originalError; net.restore(); }
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_WEEKLY_STANDUP":\s*"true"/);
  assert.match(cfg, /"crons":\s*\["30 3 \* \* \*", "0 7 \* \* \*", "0 8 \* \* \*", "0 9 \* \* 1"\]/, 'the standup rides the Monday trigger and adds none of its own');
});
