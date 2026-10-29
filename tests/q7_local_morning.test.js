// Q7 (Addendum Q, ROADMAP step 175, D-049c, G117): the local-morning send, behind ENABLE_LOCAL_MORNING_SEND. Real SQLite D1; the clock is passed in.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { sendWindowReason, originsInLocalMorning, hourlyPlan, claimDailyRun, localHour, HOURLY_CRON } from '../src/localMorning.js';
import { claimSendSlot, claimBulkFareSlots } from '../src/sendBudget.js';
import { checkDigestDelivery } from '../src/dataAlerts.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ON = { ENABLE_LOCAL_MORNING_SEND: 'true' };
const at = (iso) => new Date(iso);

test('after Nov 1 JFK is in its morning at 11:30 UTC and LAX at 14:30 UTC; before Nov 1 JFK is at 10:30 UTC (daylight time comes from the zone table)', () => {
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'JFK', now: at('2026-11-02T11:30:00Z') }), null);
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'LAX', now: at('2026-11-02T14:30:00Z') }), null);
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'JFK', now: at('2026-10-30T10:30:00Z') }), null);
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'JFK', now: at('2026-11-02T10:30:00Z') }), 'quiet_hours', '05:30 EST is before the morning');
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'LAX', now: at('2026-11-02T11:30:00Z') }), 'quiet_hours');
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'JFK', now: at('2026-11-02T15:30:00Z') }), 'outside_morning_window');
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'TLV', now: at('2026-11-02T04:30:00Z') }), null, 'TLV (UTC+2 in winter) 06:30');
  assert.equal(sendWindowReason(ON, { kind: 'digest', origin: 'PHX', now: at('2026-07-01T13:30:00Z') }), null, 'Phoenix has no daylight time: 06:30 MST is 13:30 UTC');
});

test('flag off: nothing is ever refused by the window', () => {
  for (const hour of [0, 3, 6, 12, 22]) assert.equal(sendWindowReason({}, { kind: 'digest', origin: 'JFK', now: new Date(Date.UTC(2026, 10, 2, hour, 30)) }), null);
  assert.equal(sendWindowReason({ ENABLE_LOCAL_MORNING_SEND: 'false' }, { kind: 'digest', origin: 'JFK', now: at('2026-11-02T03:30:00Z') }), null);
});

test('quiet hours: no scheduled send from 21:00 to 06:00 local; the evening-before email keeps its 18:00 to 20:59 time', () => {
  const nine = at('2026-11-03T02:30:00Z'); // 21:30 EST on Nov 2
  assert.equal(sendWindowReason(ON, { kind: 'youre_set', origin: 'JFK', now: nine }), 'quiet_hours');
  assert.equal(sendWindowReason(ON, { kind: 'youre_set', origin: 'JFK', now: at('2026-11-02T23:30:00Z') }), null, '18:30 EST');
  assert.equal(sendWindowReason(ON, { kind: 'youre_set', origin: 'JFK', now: at('2026-11-02T11:30:00Z') }), null, 'a repeatable kind is not tied to the morning');
  assert.equal(sendWindowReason(ON, { kind: 'retrospective', origin: 'JFK', now: at('2026-11-02T23:30:00Z') }), 'outside_morning_window');
});

test('which origins are in their morning', () => {
  const eleven = originsInLocalMorning(at('2026-11-02T11:30:00Z'));
  assert.ok(eleven.includes('JFK') && eleven.includes('ATL') && !eleven.includes('LAX') && !eleven.includes('ORD'));
  assert.ok(originsInLocalMorning(at('2026-11-02T14:30:00Z')).includes('LAX'));
  assert.deepEqual(originsInLocalMorning(at('2026-11-02T20:30:00Z')), []);
  assert.equal(hourlyPlan(at('2026-11-02T07:30:00Z')).daily, false);
  assert.equal(hourlyPlan(at('2026-11-02T08:30:00Z')).daily, true);
  assert.equal(localHour('LAX', at('2026-11-02T14:30:00Z')), 6);
});

test('the send budget defers a digest outside the window and allows it inside; one digest per reader per local date, also across the daylight-time change', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db, ...ON };
  const claim = (email, origin, iso) => claimSendSlot(env, { email, stream: 'digest', kind: 'digest', origin, now: at(iso) });
  assert.equal((await claim('l@example.com', 'LAX', '2026-11-02T11:30:00Z')).reason, 'quiet_hours');
  assert.equal((await claim('l@example.com', 'LAX', '2026-11-02T14:30:00Z')).allow, true);
  assert.equal((await claim('l@example.com', 'LAX', '2026-11-02T14:35:00Z')).reason, 'already_sent_today');
  // Sat Oct 31 (EDT, 10:30 UTC) and Sun Nov 1 (EST, 11:30 UTC, the 25-hour day) are two different local dates: one digest each.
  assert.equal((await claim('j@example.com', 'JFK', '2026-10-31T10:30:00Z')).allow, true);
  assert.equal((await claim('j@example.com', 'JFK', '2026-11-01T11:30:00Z')).allow, true);
  assert.equal((await claim('j@example.com', 'JFK', '2026-11-01T11:55:00Z')).reason, 'already_sent_today');
  assert.equal((await claim('j@example.com', 'JFK', '2026-11-01T10:30:00Z')).reason, 'quiet_hours', 'on Nov 1 the old 10:30 UTC slot is 05:30 local');
});

test('the bulk claim (digest and weekly) applies the same window per recipient', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db, ...ON };
  const out = await claimBulkFareSlots(env, [{ email: 'j@example.com', origin: 'JFK' }, { email: 'l@example.com', origin: 'LAX' }], { now: at('2026-11-02T11:30:00Z') });
  assert.deepEqual([...out.allowed], ['j@example.com']);
  assert.equal(out.denied.get('l@example.com'), 'quiet_hours');
  const off = await claimBulkFareSlots({ DB: makeSqliteD1(MIGRATIONS) }, [{ email: 'l@example.com', origin: 'LAX' }], { now: at('2026-11-02T11:30:00Z') });
  assert.equal(off.allowed.size, 1, 'flag off: no window');
});

test('the once-a-day jobs are claimed once per UTC day', async () => {
  const env = { DB: makeSqliteD1(MIGRATIONS) };
  assert.equal(await claimDailyRun(env, 'general_daily', at('2026-11-02T08:30:00Z')), true);
  assert.equal(await claimDailyRun(env, 'general_daily', at('2026-11-02T09:30:00Z')), false);
  assert.equal(await claimDailyRun(env, 'general_daily', at('2026-11-03T08:30:00Z')), true);
});

// A DB that counts every statement, to see whether a scheduled run did any work at all.
function countingEnv(flags) {
  const real = makeSqliteD1(MIGRATIONS);
  const calls = [];
  return { calls, env: { DB: { ...real, prepare: (sql) => { calls.push(sql); return real.prepare(sql); } }, ...flags } };
}

test('flag off: the hourly trigger does nothing; the 08:00 run is the daily run as before', async () => {
  const hourly = countingEnv({});
  await worker.scheduled({ cron: HOURLY_CRON }, hourly.env);
  assert.equal(hourly.calls.length, 0);
  const legacy = countingEnv({});
  await worker.scheduled({ cron: '0 8 * * *' }, legacy.env);
  assert.ok(legacy.calls.length > 0, 'the 08:00 run still does its work');
});

test('flag on: the 08:00 run is a no-op (the hourly trigger replaces it)', async () => {
  const legacy = countingEnv(ON);
  await worker.scheduled({ cron: '0 8 * * *' }, legacy.env);
  assert.equal(legacy.calls.length, 0);
});

test('N8: with the flag on, a digest check at 09:30 UTC judges yesterday, not "nobody has been emailed yet"', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  db.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed) VALUES ('u1', 'a@example.com', 1, 'JFK', 1)").run();
  const now = at('2026-11-03T09:30:00Z');
  const flagged = await checkDigestDelivery({ DB: db, ...ON }, now);
  assert.equal(flagged.length, 1, 'yesterday had no rows');
  db.raw.prepare("INSERT INTO daily_alert_deliveries (delivery_key, email, delivered_on, status) VALUES ('k', 'a@example.com', '2026-11-02', 'sent')").run();
  assert.deepEqual(await checkDigestDelivery({ DB: db, ...ON }, now), []);
  // Flag off keeps the old rule: no rows today at 09:30 UTC is a breach (yesterday's row does not count).
  assert.equal((await checkDigestDelivery({ DB: db }, now)).length, 1);
});
