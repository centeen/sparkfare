// N8 (Addendum N): the same-day data alert. Every check has a forced breach; nothing wrong means no email; at most one email a day;
// two breaches arrive in one email; every alert points at a runbook section that exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker, { checkRevenueHealth } from '../src/index.js';
import {
  evaluateDataAlerts, runDataAlerts, checkServedFiles, checkPipelineRuns, checkBackups, checkD1Size, checkDigestDelivery, checkEmailGuard,
  alertSubject, DATA_ALERT_CRON, SERVED_FILES, RUN_AGE_LIMITS, D1_SIZE,
} from '../src/dataAlerts.js';
import { sendDataAlertEmail, _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const NOW = new Date('2026-10-25T09:30:00Z');
const ago = (hours) => new Date(NOW.getTime() - hours * 36e5).toISOString();

const record = (over = {}) => ({ display_name: 'Lisbon, Portugal', route_key: 'JFK:Lisbon, Portugal', origin: 'JFK', price: 500, ...over });
const feed = (hoursOld, over = {}) => ({ generated_at: ago(hoursOld), deals: [record()], featured: [], priced_no_deal: [], insufficient_history: [], no_data: [], ...over });
function assets(hours = {}, over = {}) {
  const files = {
    'sparkfare_ranked_deals.json': feed(hours.jfk ?? 20, over.jfk),
    'sparkfare_ranked_deals_other_origins.json': feed(hours.other ?? 20, over.other),
    'sparkfare_hourly_ranked_deals.json': feed(hours.hourly ?? 3, over.hourly),
  };
  return { async fetch(req) { const f = new URL(req.url).pathname.slice(1); return files[f] ? new Response(JSON.stringify(files[f])) : new Response('nf', { status: 404 }); } };
}
const raw = (files = {}) => ({ async get(key) { return key in files ? { text: async () => JSON.stringify(files[key]) } : null; } });
const result = (over = {}) => ({ pipeline: 'x', run_id: 'run=20261025T080000Z', status: 'ok', failed_checks: [], published_at: ago(5), ...over });
const healthyRaw = () => raw({
  'state/daily_jfk/latest.json': result({ published_at: ago(20) }),
  'state/multi_origin/latest.json': result({ published_at: ago(3) }),
  'state/d1_backup/latest.json': { date: '2026-10-25', key: 'd1/daily/2026-10-25.sql.gz', tables: 34, taken_at: ago(7) },
  'state/d1_backup/drill.json': { status: 'pass', checked_at: ago(24 * 20), backup_date: '2026-10-05' },
});
const healthyEnv = (extra = {}) => ({ ASSETS: assets(), RAW: healthyRaw(), ENABLE_DATA_ALERTS: 'true', ...extra });
const ids = (b) => b.map((x) => x.id).sort();

// ---- every check, forced ---------------------------------------------------------------------------------------------------

test('nothing wrong: no breaches', async () => {
  _resetSendingGuardForTests();
  assert.deepEqual(await evaluateDataAlerts(healthyEnv(), NOW), []);
});

test('served files: warn and critical by age, with the multi-origin feed at 10 h and 14 h', async () => {
  const lv = async (hours) => (await checkServedFiles({ ASSETS: assets(hours) }, NOW)).map((b) => b.level);
  assert.deepEqual(await lv({ jfk: 29 }), []);
  assert.deepEqual(await lv({ jfk: 31 }), ['warn']);
  assert.deepEqual(await lv({ jfk: 49 }), ['critical']);
  assert.deepEqual(await lv({ hourly: 9.5 }), []);
  assert.deepEqual(await lv({ hourly: 11 }), ['warn']);
  assert.deepEqual(await lv({ hourly: 15 }), ['critical']);
  assert.deepEqual(SERVED_FILES.find((f) => f.file.includes('hourly')), { file: 'sparkfare_hourly_ranked_deals.json', label: 'hourly multi-origin deals', warnHours: 10, criticalHours: 14 });
});

test('served files: unreadable, no timestamp, no priced routes, doubled prefix are critical', async () => {
  const gone = { async fetch() { return new Response('nf', { status: 404 }); } };
  assert.equal((await checkServedFiles({ ASSETS: gone }, NOW)).length, 3);
  assert.equal((await checkServedFiles({ ASSETS: assets({}, { jfk: { generated_at: undefined } }) }, NOW))[0].title, 'JFK daily deals has no generated_at');
  const none = await checkServedFiles({ ASSETS: assets({}, { jfk: { deals: [] } }) }, NOW);
  assert.match(none[0].title, /no priced routes/);
  const doubled = await checkServedFiles({ ASSETS: assets({}, { jfk: { deals: [record({ route_key: 'JFK:JFK:Lisbon, Portugal' })] } }) }, NOW);
  assert.match(doubled[0].title, /doubled origin prefixes/);
  assert.ok([...none, ...doubled].every((b) => b.level === 'critical' && b.runbook === 'Served data is stale or missing'));
});

test('pipeline runs: a blocked run is critical, a quiet pipeline warns then goes critical, no result yet is silent', async () => {
  const run = async (files) => checkPipelineRuns({ RAW: raw(files) }, NOW);
  const blocked = await run({ 'state/daily_jfk/latest.json': result({ status: 'blocked', failed_checks: ['failed_calls'], published_at: ago(2) }) });
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].level, 'critical');
  assert.match(blocked[0].value, /failed_calls/);
  assert.deepEqual((await run({ 'state/multi_origin/latest.json': result({ published_at: ago(9) }) })).map((b) => b.level), []);
  assert.deepEqual((await run({ 'state/multi_origin/latest.json': result({ published_at: ago(11) }) })).map((b) => b.level), ['warn']);
  assert.deepEqual((await run({ 'state/multi_origin/latest.json': result({ published_at: ago(15) }) })).map((b) => b.level), ['critical']);
  assert.deepEqual((await run({ 'state/daily_jfk/latest.json': result({ published_at: ago(40) }) })).map((b) => b.level), ['warn']);
  assert.deepEqual(await run({}), []);
  assert.deepEqual(RUN_AGE_LIMITS.multi_origin, { warnHours: 10, criticalHours: 14 });
});

test('backups: an old backup and a failed drill are critical; a stale drill is a warning', async () => {
  const withFiles = (latest, drill) => ({ RAW: raw({ 'state/d1_backup/latest.json': latest, ...(drill ? { 'state/d1_backup/drill.json': drill } : {}) }) });
  const latest = { date: '2026-10-25', tables: 34, taken_at: ago(7) };
  assert.deepEqual(await checkBackups(withFiles(latest, { status: 'pass', checked_at: ago(100), backup_date: 'x' }), NOW), []);
  const old = await checkBackups(withFiles({ ...latest, taken_at: ago(54) }), NOW);
  assert.equal(old[0].level, 'critical');
  const failed = await checkBackups(withFiles(latest, { status: 'fail', checked_at: ago(10), backup_date: '2026-10-25', missing_tables: ['events'] }), NOW);
  assert.equal(failed[0].level, 'critical');
  assert.match(failed[0].title, /FAILED/);
  const stale = await checkBackups(withFiles(latest, { status: 'pass', checked_at: ago(24 * 50), backup_date: 'x' }), NOW);
  assert.equal(stale[0].level, 'warn');
});

test('database size: warns at 70% and is critical at 90% of the limit', async () => {
  const db = (bytes) => ({ prepare: () => ({ run: async () => ({ success: true, meta: { size_after: bytes } }) }) });
  const limit = 1000;
  const lv = async (bytes) => (await checkD1Size({ DB: db(bytes), D1_SIZE_LIMIT_BYTES: String(limit) })).map((b) => b.level);
  assert.deepEqual(await lv(600), []);
  assert.deepEqual(await lv(750), ['warn']);
  assert.deepEqual(await lv(950), ['critical']);
  assert.deepEqual(await checkD1Size({ DB: { prepare: () => ({ run: async () => ({ success: true }) }) } }), [], 'no size reported means no alert');
  assert.equal(D1_SIZE.warnShare, 0.7);
});

function digestDb() {
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed) VALUES ('u1', 'a@example.com', 1, 'JFK', 1)").run();
  return db;
}
const delivery = (db, status, email = 'a@example.com') => db.raw.prepare('INSERT INTO daily_alert_deliveries (delivery_key, email, delivered_on, status) VALUES (?, ?, ?, ?)').run(`${email}:2026-10-25`, email, '2026-10-25', status);

test("digest delivery: failed rows, or subscribers but no run, are critical; 'sent' and 'pending' are not", async () => {
  let db = digestDb();
  delivery(db, 'sent');
  assert.deepEqual(await checkDigestDelivery({ DB: db }, NOW), []);
  db = digestDb(); delivery(db, 'pending');
  assert.deepEqual(await checkDigestDelivery({ DB: db }, NOW), [], 'pending means no eligible deals for that origin, not a failure');
  db = digestDb(); delivery(db, 'failed');
  const failed = await checkDigestDelivery({ DB: db }, NOW);
  assert.equal(failed[0].level, 'critical');
  assert.match(failed[0].value, /1 failed/);
  const none = await checkDigestDelivery({ DB: digestDb() }, NOW);
  assert.match(none[0].title, /did not run/);
  assert.deepEqual(await checkDigestDelivery({ DB: digestDb(), ENABLE_DAILY_DIGEST: 'false' }, NOW), [], 'a deliberate stop is not an alert');
  const noSubs = makeSqliteD1(MIGRATIONS);
  assert.deepEqual(await checkDigestDelivery({ DB: noSubs }, NOW), []);
});

test('digest delivery: no rows before 08:30 UTC is not a breach (not due yet); failed rows still are', async () => {
  const early = new Date('2026-10-25T04:00:00Z');
  assert.deepEqual(await checkDigestDelivery({ DB: digestDb() }, early), []);
  assert.equal((await checkDigestDelivery({ DB: digestDb() }, new Date('2026-10-25T08:30:00Z')))[0].level, 'critical');
  const db = digestDb(); delivery(db, 'failed');
  assert.equal((await checkDigestDelivery({ DB: db }, early))[0].level, 'critical');
});

test('email guard: a tripped breaker is critical', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  for (let i = 0; i < 220; i++) db.raw.prepare("INSERT INTO events (id, event_type) VALUES (?, 'alert_email_sent')").run(`s${i}`);
  for (let i = 0; i < 20; i++) db.raw.prepare("INSERT INTO events (id, event_type) VALUES (?, 'email_bounce')").run(`b${i}`);
  const out = await checkEmailGuard({ DB: db });
  _resetSendingGuardForTests();
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'critical');
  assert.deepEqual(await checkEmailGuard({ DB: makeSqliteD1(MIGRATIONS) }), []);
});

test('a check that throws does not stop the others', async () => {
  const env = healthyEnv({ ASSETS: { async fetch() { throw new Error('assets down'); } } });
  assert.doesNotMatch(JSON.stringify(await evaluateDataAlerts(env, NOW)), /undefined/);
});

// ---- the email --------------------------------------------------------------------------------------------------------------

function resendStub() {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).includes('resend.com')) return real(url, init);
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `e${sent.length}` }), { status: 200 });
  };
  return { sent, restore: () => { globalThis.fetch = real; } };
}
const sendWith = (env) => (e, b) => sendDataAlertEmail({ ...env, ...e }, b);

test('two forced breaches arrive in ONE email with value, limit and runbook section for each', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  const env = healthyEnv({ DB: db, RESEND_API_KEY: 're_test', OPS_ALERT_EMAIL: 'owner@example.com', ASSETS: assets({ jfk: 60, hourly: 12 }) });
  const stub = resendStub();
  let out;
  try { out = await runDataAlerts(env, { now: NOW, send: sendWith(env) }); } finally { stub.restore(); }
  assert.equal(out.sent, true);
  assert.equal(out.breaches.length, 2);
  assert.equal(stub.sent.length, 1, 'exactly one email');
  const mail = stub.sent[0];
  assert.equal(mail.to, 'owner@example.com');
  assert.match(mail.subject, /^Sparkfare data alert: JFK daily deals is stale \(\+1 more\)$/);
  for (const part of [mail.html, mail.text]) {
    assert.match(part, /JFK daily deals is stale/);
    assert.match(part, /hourly multi-origin deals is stale/);
    assert.match(part, /60 h old/);
    assert.match(part, /30 h \(critical 48 h\)/);
    assert.match(part, /Served data is stale or missing/);
  }
  assert.match(mail.html, /CRITICAL/);
  assert.match(mail.html, /Warning/);
  assert.equal(alertSubject(out.breaches), mail.subject);
});

test('at most one email a day, the next day it can send again, and a quiet day sends nothing', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  const bad = healthyEnv({ DB: db, RESEND_API_KEY: 're_test', ASSETS: assets({ jfk: 60 }) });
  const stub = resendStub();
  try {
    assert.equal((await runDataAlerts(bad, { now: NOW, send: sendWith(bad) })).sent, true);
    const again = await runDataAlerts(bad, { now: new Date(NOW.getTime() + 3600e3), send: sendWith(bad) });
    assert.equal(again.sent, false);
    assert.equal(again.reason, 'already emailed today');
    assert.equal(stub.sent.length, 1);
    const tomorrow = new Date(NOW.getTime() + 24 * 3600e3);
    const stale = healthyEnv({ DB: db, RESEND_API_KEY: 're_test', ASSETS: { async fetch(req) { const f = new URL(req.url).pathname.slice(1); const hrs = f.includes('hourly') ? 3 : 84; return new Response(JSON.stringify({ ...feed(0), generated_at: new Date(tomorrow.getTime() - hrs * 36e5).toISOString() })); } } });
    assert.equal((await runDataAlerts(stale, { now: tomorrow, send: sendWith(stale) })).sent, true, 'still broken tomorrow: a reminder');
    assert.equal(stub.sent.length, 2);
    const quietEnv = healthyEnv({ DB: makeSqliteD1(MIGRATIONS), RESEND_API_KEY: 're_test' });
    const quiet = await runDataAlerts(quietEnv, { now: NOW, send: sendWith(quietEnv) });
    assert.deepEqual([quiet.sent, quiet.breaches.length], [false, 0]);
    assert.equal(stub.sent.length, 2, 'no breach, no email');
  } finally { stub.restore(); }
});

test('a failed send is not recorded as sent, so the next run tries again', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  const env = healthyEnv({ DB: db, RESEND_API_KEY: 're_test', ASSETS: assets({ jfk: 60 }) });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).includes('resend.com') ? new Response(JSON.stringify({ name: 'internal_server_error', message: 'down', statusCode: 500 }), { status: 500 }) : real(url, init));
  let first;
  try { first = await runDataAlerts(env, { now: NOW, send: sendWith(env) }); } finally { globalThis.fetch = real; }
  assert.equal(first.sent, false);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM data_alert_log').get().n, 0);
});

test('a dry run lists the breaches and sends and records nothing; the flag off does nothing at all', async () => {
  _resetSendingGuardForTests();
  const db = makeSqliteD1(MIGRATIONS);
  const env = healthyEnv({ DB: db, RESEND_API_KEY: 're_test', ASSETS: assets({ jfk: 60 }) });
  const stub = resendStub();
  try {
    const dry = await runDataAlerts(env, { now: NOW, send: sendWith(env), dryRun: true });
    assert.equal(dry.breaches.length, 1);
    assert.equal(stub.sent.length, 0);
    const off = await runDataAlerts({ ...env, ENABLE_DATA_ALERTS: 'false' }, { now: NOW, send: sendWith(env) });
    assert.deepEqual([off.enabled, off.breaches.length, off.sent], [false, 0, false]);
    assert.equal(stub.sent.length, 0);
  } finally { stub.restore(); }
});

test('with no Resend key the alert is mocked and not recorded as sent', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = healthyEnv({ DB: db, ASSETS: assets({ jfk: 60 }) });
  const out = await runDataAlerts(env, { now: NOW, send: sendWith(env) });
  assert.equal(out.result.mocked, true);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM data_alert_log').get().n, 0);
});

// ---- wiring ---------------------------------------------------------------------------------------------------------------------

test('the 09:30 cron is registered, the flag ships on, and the scheduled handler runs the alert for exactly that cron', async () => {
  const w = fs.readFileSync('wrangler.jsonc', 'utf8');
  assert.equal(DATA_ALERT_CRON, '30 9 * * *');
  assert.match(w, /"crons": \["30 3 \* \* \*", "0 8 \* \* \*", "30 9 \* \* \*", "0 9 \* \* 2", "30 \* \* \* \*"\]/);
  assert.match(w, /"ENABLE_DATA_ALERTS": "true"/);
  _resetSendingGuardForTests();
  const env = healthyEnv({ DB: makeSqliteD1(MIGRATIONS), RESEND_API_KEY: 're_test', ASSETS: assets({ jfk: 60 }) });
  const stub = resendStub();
  try { await worker.scheduled({ cron: DATA_ALERT_CRON }, env); } finally { stub.restore(); }
  assert.equal(stub.sent.length, 1);
  assert.match(stub.sent[0].subject, /^Sparkfare data alert:/);
});

test('with the data alert on, the 08:00 health email stops repeating data problems (and keeps revenue ones)', async () => {
  _resetSendingGuardForTests();
  const base = { ASSETS: assets({ jfk: 60 }), TRAVELPAYOUTS_TOKEN: 'tok', DB: makeSqliteD1(MIGRATIONS) };
  const off = await checkRevenueHealth({ ...base }, { ok: true });
  assert.ok(off.problems.some((p) => /hours old/.test(p)), 'before: the 08:00 email carried data problems');
  const on = await checkRevenueHealth({ ...base, ENABLE_DATA_ALERTS: 'true' }, { ok: true });
  assert.ok(!on.problems.some((p) => /hours old/.test(p)));
  const revenue = await checkRevenueHealth({ ...base, ENABLE_DATA_ALERTS: 'true', TRAVELPAYOUTS_TOKEN: undefined }, null);
  assert.ok(revenue.problems.some((p) => /TRAVELPAYOUTS_TOKEN/.test(p)), 'revenue problems still reported');
});

test('every runbook section an alert points at exists in docs/data/RUNBOOK.md', async () => {
  const runbook = fs.readFileSync('docs/data/RUNBOOK.md', 'utf8');
  const sections = new Set([...runbook.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()));
  const src = fs.readFileSync('src/dataAlerts.js', 'utf8');
  const named = new Set([...src.matchAll(/breach\('[a-z_0-9]+', [^,]+, [^;]*?, '([^']+)'\)/g)].map((m) => m[1]));
  const bareLiterals = [...src.matchAll(/'(Served data is stale or missing|A fetch run was blocked or has stopped|The D1 backup is old or the restore drill failed|D1 or Workers usage|This morning's digest did not go out|The email sending guard is tripped)'/g)].map((m) => m[1]);
  const expected = new Set([...named, ...bareLiterals, 'Served data is stale or missing', 'A fetch run was blocked or has stopped', 'The D1 backup is old or the restore drill failed', 'D1 or Workers usage', "This morning's digest did not go out", 'The email sending guard is tripped']);
  for (const name of expected) assert.ok(sections.has(name), `RUNBOOK.md has no section "${name}"`);
  assert.ok(sections.has('The daily data alert (what the email means)'));
});
