// N13 (Addendum N, ROADMAP step 160): retention and deletion jobs, dark. Real SQLite built from the migrations; counts are hand-computed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { runRetention, runRetentionAndRecord, retentionEnabled, retentionIsDryRun, RETENTION } from '../src/retention.js';
import { computeWeeklyStandup, renderWeeklyStandup } from '../src/weeklyStandup.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const NOW = new Date('2026-12-01T09:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
const monthsAgo = (m, d = 0) => new Date(Date.UTC(2026, 11 - m, 1 - d, 9)).toISOString().slice(0, 19).replace('T', ' ');
const n = (db, sql, ...p) => Number(db.prepare(sql).get(...p).n);

function fixture() {
  const d1 = makeSqliteD1(MIGRATIONS); const db = d1.raw;
  // events: 3 older than 13 months (two click, one signup) and 2 recent
  const ev = db.prepare('INSERT INTO events (id, event_type, ts, ua_class) VALUES (?, ?, ?, ?)');
  ev.run('o1', 'outbound_click', monthsAgo(14), 'bot'); ev.run('o2', 'outbound_click', monthsAgo(14, 1), 'human'); ev.run('o3', 'signup', monthsAgo(15), null);
  ev.run('r1', 'outbound_click', ago(10), 'human'); ev.run('r2', 'signup', monthsAgo(12), null);
  // delivery logs: one row just over 90 days old and one just under, in several tables
  const dl = db.prepare('INSERT INTO daily_alert_deliveries (delivery_key, email, delivered_on, status) VALUES (?, ?, ?, ?)');
  dl.run('k1', 'old@example.com', ago(91).slice(0, 10), 'sent'); dl.run('k2', 'new@example.com', ago(89).slice(0, 10), 'sent');
  db.prepare("INSERT INTO away_mode_email_log (email, partner_id, email_type, sent_at) VALUES ('x@example.com', 'p', 't', ?), ('y@example.com', 'p', 't', ?)").run(ago(95), ago(5));
  // people
  const u = db.prepare("INSERT INTO users (id, email, origin_iata, trip_length, passenger_count, is_subscribed, unsubscribed_at, subscription_tier, referred_by, verified_email) VALUES (?, ?, 'JFK', '7-10', 2, ?, ?, ?, 'someone', 1)");
  u.run('u_old', 'gone@example.com', 0, ago(31), 'free');    // unsubscribed 31 days ago: due
  u.run('u_new', 'recent@example.com', 0, ago(29), 'free');  // 29 days: not yet
  u.run('u_paid', 'paid@example.com', 0, ago(60), 'paid');   // never touched
  u.run('u_live', 'live@example.com', 1, null, 'free');      // still subscribed
  for (const id of ['u_old', 'u_new']) {
    db.prepare("INSERT INTO watchlists (id, user_id, origin_iata, destination, target_price) VALUES (?, ?, 'JFK', 'Lisbon, Portugal', 400)").run(`w_${id}`, id);
    db.prepare("INSERT INTO trips (trip_id, user_id, destination, origin_iata, departure_at, price_at_click) VALUES (?, ?, 'Lisbon, Portugal', 'JFK', '2027-02-01', 400)").run(`t_${id}`, id);
  }
  db.prepare("INSERT INTO daily_alert_deliveries (delivery_key, email, delivered_on, status) VALUES ('kg', 'gone@example.com', ?, 'sent')").run(ago(2).slice(0, 10));
  db.prepare("INSERT INTO email_suppressions (email, reason) VALUES ('gone@example.com', 'unsubscribed')").run();
  db.prepare("INSERT INTO consent_log (id, user_id, email, source, wording_version, ip_hash) VALUES ('c1', 'u_old', 'gone@example.com', 'alert_signup', 'v1', 'h')").run();
  return d1;
}
const ON = { ENABLE_RETENTION_JOBS: 'true', RETENTION_DRY_RUN: 'false' };

test('flags: off by default, dry run unless both are set, so real deletion needs ENABLE_RETENTION_JOBS true AND RETENTION_DRY_RUN false', () => {
  assert.equal(retentionEnabled({}), false); assert.equal(retentionEnabled({ ENABLE_RETENTION_JOBS: 'true' }), true);
  assert.equal(retentionIsDryRun({}), true); assert.equal(retentionIsDryRun({ RETENTION_DRY_RUN: 'true' }), true); assert.equal(retentionIsDryRun({ RETENTION_DRY_RUN: 'false' }), false);
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_RETENTION_JOBS":\s*"false"/); assert.match(cfg, /"RETENTION_DRY_RUN":\s*"true"/);
});

test('a dry run deletes and changes nothing, and its counts match the hand computation', async () => {
  const d1 = fixture(); const db = d1.raw;
  const before = JSON.stringify(['events', 'users', 'daily_alert_deliveries', 'away_mode_email_log', 'watchlists'].map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()));
  const r = await runRetention({ DB: d1 }, { now: NOW, dryRun: true });
  assert.equal(r.dryRun, true); assert.deepEqual(r.errors, {});
  assert.equal(r.counts.events_rolled_up, 3);
  assert.equal(r.counts['delivery_log:daily_alert_deliveries'], 1);
  assert.equal(r.counts['delivery_log:away_mode_email_log'], 1);
  assert.equal(r.counts.users_anonymized, 1);
  assert.equal(r.counts['person_data:watchlists'], 1);
  const after = JSON.stringify(['events', 'users', 'daily_alert_deliveries', 'away_mode_email_log', 'watchlists'].map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()));
  assert.equal(after, before, 'nothing changed');
});

test('real run: old events become monthly totals and go; recent events stay; a second run adds nothing', async () => {
  const d1 = fixture(); const db = d1.raw;
  await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  assert.deepEqual(db.prepare('SELECT id FROM events ORDER BY id').all().map((r) => r.id), ['r1', 'r2']);
  const agg = db.prepare('SELECT month, event_type, ua_class, n FROM events_monthly_agg ORDER BY month, event_type, ua_class').all().map((r) => ({ ...r }));
  assert.equal(agg.reduce((s, r) => s + r.n, 0), 3);
  assert.deepEqual(agg.filter((r) => r.event_type === 'outbound_click').map((r) => [r.ua_class, r.n]).sort(), [['bot', 1], ['human', 1]]);
  const again = await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  assert.equal(again.counts.events_rolled_up, 0);
  assert.equal(n(db, 'SELECT SUM(n) AS n FROM events_monthly_agg'), 3, 'not counted twice');
});

test('real run: delivery logs older than 90 days go, newer ones stay', async () => {
  const d1 = fixture(); const db = d1.raw;
  await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  assert.deepEqual(db.prepare("SELECT delivery_key FROM daily_alert_deliveries WHERE delivery_key IN ('k1','k2')").all().map((r) => r.delivery_key), ['k2']);
  assert.deepEqual(db.prepare('SELECT email FROM away_mode_email_log').all().map((r) => r.email), ['y@example.com']);
});

test('real run: a person 31 days after unsubscribing is made anonymous; their data goes; the suppression, the consent record, the trip and a 29-day, paid or live user stay', async () => {
  const d1 = fixture(); const db = d1.raw;
  await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  const old = { ...db.prepare("SELECT * FROM users WHERE id = 'u_old'").get() };
  assert.equal(old.email, 'deleted-u_old@deleted.invalid');
  assert.equal(old.origin_iata, null); assert.equal(old.trip_length, null); assert.equal(old.passenger_count, null); assert.equal(old.referred_by, null);
  assert.equal(old.is_subscribed, 0); assert.ok(old.anonymized_at);
  assert.equal(n(db, "SELECT COUNT(*) AS n FROM watchlists WHERE user_id = 'u_old'"), 0);
  assert.equal(n(db, "SELECT COUNT(*) AS n FROM daily_alert_deliveries WHERE email = 'gone@example.com'"), 0, 'email-keyed delivery rows go with the person');
  assert.equal(n(db, "SELECT COUNT(*) AS n FROM email_suppressions WHERE email = 'gone@example.com'"), 1, 'the opt-out is still honoured');
  assert.equal(n(db, "SELECT COUNT(*) AS n FROM consent_log WHERE email = 'gone@example.com'"), 1, 'the consent record is kept');
  assert.equal(n(db, "SELECT COUNT(*) AS n FROM trips WHERE user_id = 'u_old'"), 1, 'the trip row keeps its counts');
  for (const id of ['u_new', 'u_paid', 'u_live']) assert.equal(db.prepare('SELECT anonymized_at FROM users WHERE id = ?').get(id).anonymized_at, null, id);
  assert.equal(n(db, "SELECT COUNT(*) AS n FROM watchlists WHERE user_id = 'u_new'"), 1);
  const again = await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  assert.equal(again.counts.users_anonymized, 0, 'idempotent');
});

test('the sunset pause is stamped on first sight, anonymises 30 days later, and reactivation stops the clock', async () => {
  const d1 = makeSqliteD1(MIGRATIONS); const db = d1.raw;
  db.prepare("INSERT INTO users (id, email, is_subscribed, verified_email) VALUES ('s1', 's1@example.com', 0, 1), ('s2', 's2@example.com', 0, 1), ('s3', 's3@example.com', 1, 1)").run();
  await runRetention({ DB: d1 }, { now: new Date('2026-12-01T09:00:00Z'), dryRun: false });
  assert.ok(db.prepare("SELECT sunset_at FROM users WHERE id = 's1'").get().sunset_at, 'stamped');
  assert.equal(db.prepare("SELECT anonymized_at FROM users WHERE id = 's1'").get().anonymized_at, null, 'not before 30 days');
  db.prepare("UPDATE users SET is_subscribed = 1 WHERE id = 's2'").run(); // reactivated
  const later = await runRetention({ DB: d1 }, { now: new Date('2026-12-15T09:00:00Z'), dryRun: false });
  assert.equal(later.counts.users_anonymized, 0);
  assert.equal(db.prepare("SELECT sunset_at FROM users WHERE id = 's2'").get().sunset_at, null, 'clock stopped');
  const end = await runRetention({ DB: d1 }, { now: new Date('2027-01-05T09:00:00Z'), dryRun: false });
  assert.equal(end.counts.users_anonymized, 1);
  assert.ok(db.prepare("SELECT anonymized_at FROM users WHERE id = 's1'").get().anonymized_at);
  assert.equal(db.prepare("SELECT anonymized_at FROM users WHERE id = 's2'").get().anonymized_at, null);
});

test('a deletion request starts the same 30-day clock', async () => {
  const d1 = makeSqliteD1(MIGRATIONS); const db = d1.raw;
  db.prepare("INSERT INTO users (id, email, is_subscribed, verified_email, deletion_requested_at) VALUES ('d1', 'd1@example.com', 1, 1, ?)").run(ago(31));
  const r = await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  assert.equal(r.counts.users_anonymized, 1);
});

test('one failing rule is reported and the others still run', async () => {
  const d1 = fixture(); d1.raw.exec('DROP TABLE away_mode_email_log');
  const r = await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  assert.equal(r.counts.events_rolled_up, 3); assert.equal(r.counts.users_anonymized, 1);
  assert.equal(n(d1.raw, 'SELECT COUNT(*) AS n FROM events WHERE id LIKE \'o%\''), 0);
});

test('runRetentionAndRecord refuses real deletion unless both flags allow it, records a retention_run event, and the Monday brief shows it', async () => {
  const dry = fixture();
  const a = await runRetentionAndRecord({ DB: dry, ENABLE_RETENTION_JOBS: 'true' }, { now: NOW, dryRun: false });
  assert.equal(a.dryRun, true, 'RETENTION_DRY_RUN is not "false": still a dry run, whatever the caller asked');
  assert.equal(n(dry.raw, "SELECT COUNT(*) AS n FROM events WHERE id = 'o1'"), 1);
  const off = await runRetentionAndRecord({ DB: fixture(), RETENTION_DRY_RUN: 'false' }, { now: NOW, dryRun: false });
  assert.equal(off.dryRun, true, 'the job flag is off: still a dry run');
  const real = fixture();
  const b = await runRetentionAndRecord({ DB: real, ...ON }, { now: NOW, dryRun: false });
  assert.equal(b.dryRun, false); assert.equal(n(real.raw, "SELECT COUNT(*) AS n FROM events WHERE id = 'o1'"), 0);
  const ev = real.raw.prepare("SELECT meta FROM events WHERE event_type = 'retention_run'").get();
  assert.equal(JSON.parse(ev.meta).dry_run, false);
  const m = await computeWeeklyStandup({ DB: dry }, { now: new Date() });
  assert.equal(m.retention.dry_run, true);
  const text = renderWeeklyStandup(m).text;
  assert.match(text, /RETENTION \(DRY RUN, NOTHING DELETED\)/); assert.match(text, /3 events would be rolled into monthly totals/);
  assert.equal(RETENTION.eventMonths, 13); assert.equal(RETENTION.deliveryDays, 90); assert.equal(RETENTION.personalDays, 30);
});

test('POST /api/run-retention needs the admin secret; with the flag off it runs nothing', async () => {
  const call = (env, headers = {}) => worker.fetch(new Request('https://sparkfare.com/api/run-retention', { method: 'POST', headers }), env, { waitUntil() {} });
  assert.equal((await call({ ADMIN_SECRET: 's', DB: fixture() })).status, 401);
  const off = await call({ ADMIN_SECRET: 's', DB: fixture() }, { Authorization: 'Bearer s' });
  assert.equal(off.status, 200); assert.match((await off.json()).skipped, /not "true"/, 'flag off: nothing is run');
  const res = await call({ ADMIN_SECRET: 's', DB: fixture(), ENABLE_RETENTION_JOBS: 'true' }, { Authorization: 'Bearer s' });
  assert.equal(res.status, 200); assert.equal((await res.json()).dryRun, true);
});

test('rolling up into a month that already has a total adds to it instead of replacing it', async () => {
  const d1 = makeSqliteD1(MIGRATIONS); const db = d1.raw;
  const month = monthsAgo(14).slice(0, 7);
  db.prepare("INSERT INTO events_monthly_agg (month, event_type, ua_class, n) VALUES (?, 'outbound_click', 'bot', 5)").run(month);
  db.prepare("INSERT INTO events (id, event_type, ts, ua_class) VALUES ('late', 'outbound_click', ?, 'bot')").run(monthsAgo(14));
  await runRetention({ DB: d1 }, { now: NOW, dryRun: false });
  assert.equal(n(db, "SELECT n FROM events_monthly_agg WHERE month = ? AND event_type = 'outbound_click' AND ua_class = 'bot'", month), 6);
});
