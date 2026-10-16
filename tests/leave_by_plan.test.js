// Tests for Leave-By Plan (G23 / Addendum E - Steps E3 & E4).
// Validates all constraints specified in Section 10 of docs/leave_by_plan_design.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DESTINATION_COUNTRY_MAP,
  LEAVE_BY_RULES,
  getCountryForDestination,
  leaveByPlanEnabled,
  computeTripDays,
  buildLeaveByPlan,
  buildLeaveByIcs
} from '../src/data/leaveByRules.js';

const ROOT = path.resolve(process.cwd());

test('leaveByPlanEnabled: defaults to false unless explicitly true', () => {
  assert.equal(leaveByPlanEnabled({}), false);
  assert.equal(leaveByPlanEnabled({ ENABLE_LEAVE_BY_PLAN: 'false' }), false);
  assert.equal(leaveByPlanEnabled({ ENABLE_LEAVE_BY_PLAN: '' }), false);
  assert.equal(leaveByPlanEnabled({ ENABLE_LEAVE_BY_PLAN: 'true' }), true);
});

test('destination mapping: all 40 destinations from sparkfare_destinations.json map to ISO country codes', () => {
  const destJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'sparkfare_destinations.json'), 'utf8'));
  const destKeys = Object.keys(destJson);
  assert.equal(destKeys.length, 40);

  for (const dest of destKeys) {
    const code = getCountryForDestination(dest);
    assert.ok(code, `Missing country code for destination: ${dest}`);
    assert.match(code, /^[A-Z]{2}$/, `Invalid ISO code for ${dest}: ${code}`);
  }
});

test('rule audit: active external rules have officialUrl, sourceUrl, asOf, and quote', () => {
  for (const rule of LEAVE_BY_RULES) {
    if (rule.status === 'active' && !rule.isHomeItem) {
      assert.ok(rule.officialUrl, `Rule ${rule.id} missing officialUrl`);
      assert.ok(rule.sourceUrl, `Rule ${rule.id} missing sourceUrl`);
      assert.ok(rule.asOf, `Rule ${rule.id} missing asOf date`);
      assert.ok(rule.quote, `Rule ${rule.id} missing quote`);
      assert.ok(rule.quote.length > 3, `Rule ${rule.id} quote is too short`);
    }
  }
});

test('rule constraints: no item mentions insurance, hotels, cars (except IDP) or packages', () => {
  const prohibited = ['insurance', 'hotel', 'car rental', 'vacation package'];
  for (const rule of LEAVE_BY_RULES) {
    const text = `${rule.title} ${rule.why}`.toLowerCase();
    for (const word of prohibited) {
      assert.ok(!text.includes(word), `Rule ${rule.id} contains prohibited word "${word}": ${text}`);
    }
  }
});

test('status logic: not_yet_required and needs_verification rules NEVER carry an act-by date', () => {
  const plan = buildLeaveByPlan({
    destination: 'Lisbon, Portugal',
    departureDate: '2026-11-20',
    returnDate: '2026-11-28'
  });

  const etias = plan.items.find((i) => i.id === 'etias');
  assert.ok(etias, 'ETIAS should be included for Portugal');
  assert.equal(etias.status, 'not_yet_required');
  assert.equal(etias.actByDate, null, 'not_yet_required rule must not have actByDate');
  assert.equal(etias.actByText, null, 'not_yet_required rule must not have actByText');

  const passport = plan.items.find((i) => i.id === 'passport-renewal');
  assert.ok(passport, 'Passport check should be included');
  assert.equal(passport.status, 'needs_verification');
  assert.equal(passport.actByDate, null, 'needs_verification rule must not have actByDate');
  assert.equal(passport.actByText, null, 'needs_verification rule must not have actByText');
});

test('ETIAS rule: applies to Schengen countries and excludes Cyprus', () => {
  const ptPlan = buildLeaveByPlan({ destination: 'Lisbon, Portugal' });
  assert.ok(ptPlan.items.some((i) => i.id === 'etias'), 'Portugal is Schengen');

  const esPlan = buildLeaveByPlan({ destination: 'Madrid, Spain' });
  assert.ok(esPlan.items.some((i) => i.id === 'etias'), 'Spain is Schengen');

  const cyPlan = buildLeaveByPlan({ destination: 'Larnaca, Cyprus' });
  assert.ok(!cyPlan.items.some((i) => i.id === 'etias'), 'Cyprus is excluded per design doc Section 2.3');
});

test('trip length logic: short trip vs long trip mail handling', () => {
  // 10-day trip (Hold mail active, forwarding not active)
  const shortPlan = buildLeaveByPlan({
    destination: 'Tokyo, Japan',
    departureDate: '2026-11-01',
    returnDate: '2026-11-11'
  });
  assert.equal(shortPlan.tripDays, 10);
  assert.ok(shortPlan.items.some((i) => i.id === 'usps-hold-mail'), '10-day trip gets hold mail');
  assert.ok(!shortPlan.items.some((i) => i.id === 'usps-forwarding'), '10-day trip does not get forwarding');

  // 35-day trip (Forwarding active with US Global Mail partner, Hold mail not active)
  const longPlan = buildLeaveByPlan({
    destination: 'Tokyo, Japan',
    departureDate: '2026-11-01',
    returnDate: '2026-12-06'
  });
  assert.equal(longPlan.tripDays, 35);
  assert.ok(!longPlan.items.some((i) => i.id === 'usps-hold-mail'), '35-day trip does not get hold mail');
  const forwarding = longPlan.items.find((i) => i.id === 'usps-forwarding');
  assert.ok(forwarding, '35-day trip gets mail forwarding');
  assert.ok(forwarding.partner, 'Forwarding has partner');
  assert.equal(forwarding.partner.slug, 'us-global-mail');
  assert.ok(forwarding.partner.disclosure.includes('Sparkfare may earn a commission'));
});

test('answers filtering: IDP applies only when rentingCar/car is yes', () => {
  const noCarPlan = buildLeaveByPlan({
    destination: 'Amalfi Coast, Italy',
    answers: { car: 'no' }
  });
  assert.ok(!noCarPlan.items.some((i) => i.id === 'idp'), 'Car no does not trigger IDP');

  const carPlan = buildLeaveByPlan({
    destination: 'Amalfi Coast, Italy',
    departureDate: '2026-12-01',
    answers: { car: 'yes' }
  });
  const idp = carPlan.items.find((i) => i.id === 'idp');
  assert.ok(idp, 'Car yes triggers IDP');
  assert.equal(idp.actByDate, '2026-11-10', '21 days before Dec 1 is Nov 10');
});

test('country-specific rule: Bali levy applies only to Bali/Indonesia', () => {
  const baliPlan = buildLeaveByPlan({ destination: 'Bali, Indonesia' });
  assert.ok(baliPlan.items.some((i) => i.id === 'bali-levy'), 'Bali gets levy rule');

  const tokyoPlan = buildLeaveByPlan({ destination: 'Tokyo, Japan' });
  assert.ok(!tokyoPlan.items.some((i) => i.id === 'bali-levy'), 'Tokyo does not get Bali levy');
});

test('iCalendar generation: produces valid VCALENDAR with events for dated items only', () => {
  const plan = buildLeaveByPlan({
    destination: 'Paris, France',
    departureDate: '2026-11-20',
    returnDate: '2026-11-28',
    answers: { pets: 'yes' }
  });

  const ics = buildLeaveByIcs(plan.items);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('SUMMARY:Ask USPS to hold your mail'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261117')); // 3 days before Nov 20

  // ETIAS (undated) must NOT appear in the .ics
  assert.ok(!ics.includes('SUMMARY:European Travel Information and Authorisation System'));
});

// Worker route tests
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';

function makeEnv(extra = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')))");
  const stmt = (sql, p) => ({ run: async () => { db.prepare(sql).run(...p); return { success: true, meta: { changes: 1 } }; }, first: async () => db.prepare(sql).get(...p) ?? null, all: async () => ({ results: db.prepare(sql).all(...p) }) });
  const DB = { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
  return {
    DB, APP_URL: 'https://sparkfare.com',
    ENABLE_LEAVE_BY_PLAN: 'false',
    ...extra,
  };
}

async function call(path, env, init) {
  const pending = [];
  const res = await worker.fetch(new Request(`https://sparkfare.com${path}`, init), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}

test('Worker route: flag off returns 404 for /api/leave-by-plan and ics', async () => {
  const env = makeEnv({ ENABLE_LEAVE_BY_PLAN: 'false' });
  const res1 = await call('/api/leave-by-plan', env, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ destination: 'Tokyo, Japan' })
  });
  assert.equal(res1.status, 404);

  const res2 = await call('/api/leave-by-plan/ics', env, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ destination: 'Tokyo, Japan' })
  });
  assert.equal(res2.status, 404);
});

test('Worker route: flag on returns 200 with plan and logs plan_view event with no dates', async () => {
  const env = makeEnv({ ENABLE_LEAVE_BY_PLAN: 'true' });
  const res = await call('/api/leave-by-plan', env, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      destination: 'Tokyo, Japan',
      departureDate: '2026-11-20',
      returnDate: '2026-11-28',
      tripLengthBucket: '7-10'
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.plan.country, 'JP');
  assert.ok(data.plan.items.length > 0);

  // Check event logged
  const events = env.DB._db.prepare("SELECT * FROM events WHERE event_type = 'plan_view'").all();
  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'leave-by-plan');
  const meta = JSON.parse(events[0].meta);
  assert.equal(meta.country, 'JP');
  assert.equal(meta.trip_length_bucket, '7-10');
  // Privacy assertion: NO date string anywhere in event meta
  assert.ok(!events[0].meta.includes('2026-11-20'));
  assert.ok(!events[0].meta.includes('2026-11-28'));
});

test('Worker route: flag on generates .ics stream', async () => {
  const env = makeEnv({ ENABLE_LEAVE_BY_PLAN: 'true' });
  const res = await call('/api/leave-by-plan/ics', env, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      destination: 'Tokyo, Japan',
      departureDate: '2026-11-20',
      returnDate: '2026-11-28'
    })
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
  const text = await res.text();
  assert.ok(text.includes('BEGIN:VCALENDAR'));
  assert.ok(text.includes('END:VCALENDAR'));
});
