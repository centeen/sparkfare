import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildLeaveByPlan, buildLeaveByIcs, daysBetweenIso, LATE_PLAN_DAYS, PASSPORT_URGENT_URL, FASTEST_ROUTE_LINE,
} from '../src/data/leaveByRules.js';

// Addendum G task G4 (ROADMAP step 90): late-plan mode. "Today" is always passed in, so none of these tests depend on the clock.

const TODAY = '2026-10-16';
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const ALL_YES = { pet_home: 'yes', keeper: 'yes', driving: 'yes', airport_parking: 'yes' };
const NOT_YET = { pet_home: 'yes', keeper: 'no', driving: 'yes', airport_parking: 'yes' };

function planAt(daysAhead, { destination = 'Phuket, Thailand', tripDays = 14, answers = NOT_YET, overrides = null } = {}) {
  const dep = addDays(TODAY, daysAhead);
  return buildLeaveByPlan({ destination, today: TODAY, departureDate: dep, returnDate: addDays(dep, tripDays), answers, overrides });
}
const ids = (list) => list.map((i) => i.id);

test('late mode starts at 7 days or fewer, and not before', () => {
  assert.equal(LATE_PLAN_DAYS, 7);
  assert.equal(planAt(8).late, false);
  assert.equal(planAt(7).late, true);
  assert.equal(planAt(7).daysUntil, 7);
  assert.equal(planAt(1).late, true);
  const today = planAt(0);
  assert.equal(today.late, true);
  assert.equal(today.daysUntil, 0);
  assert.equal(planAt(-1).daysUntil, -1, 'a date already gone is late too (the page asks for a later date)');
  assert.equal(daysBetweenIso('2026-10-31', '2026-11-01'), 1, 'month ends count correctly');
  assert.equal(daysBetweenIso('2026-10-31', '2026-11-02'), 2);
  assert.equal(daysBetweenIso('not a date', '2026-11-02'), null);
});

test('a plan more than 7 days out is unchanged: nothing is split off and nothing has a late note', () => {
  const p = planAt(30);
  assert.equal(p.late, false);
  assert.deepEqual(p.pastItems, []);
  assert.ok(p.items.some((i) => i.id === 'idp') && p.items.some((i) => i.id === 'step'));
  assert.ok(p.items.every((i) => !i.lateUrl && !i.pastNote));
  assert.ok(p.items.filter((i) => i.actByDate).every((i) => i.actByDate >= TODAY));
});

test('5 days out: items whose date has passed leave the list and appear under "Past its window"', () => {
  const p = planAt(5);
  assert.equal(p.late, true);
  assert.deepEqual(ids(p.pastItems).sort(), ['idp', 'step'].sort(), 'driving permit (21 days) and STEP (14 days) are past');
  for (const gone of ['idp', 'step']) assert.ok(!ids(p.items).includes(gone), `${gone} is no longer in the main list`);
  // still due: mail hold (3 days before), the Thailand card (3 days before), water and thermostat (1 day before)
  for (const kept of ['usps-hold-mail', 'thailand-arrival-card', 'home-water-shutoff']) {
    const i = p.items.find((x) => x.id === kept);
    assert.ok(i, `${kept} is still achievable`);
    assert.ok(i.actByDate >= TODAY, `${kept} still carries a date that has not passed`);
  }
});

test('each past item links its official page as the fastest route and shows no date', () => {
  const p = planAt(5);
  assert.ok(p.pastItems.length >= 2);
  for (const i of p.pastItems) {
    assert.equal(i.pastNote, FASTEST_ROUTE_LINE);
    assert.equal(FASTEST_ROUTE_LINE, "Here's the fastest official route now.");
    assert.match(i.fastestUrl, /^https:\/\//);
    assert.equal(i.fastestUrl, i.officialUrl);
    assert.equal(i.actByDate, null, 'a date that has passed is not shown');
    assert.equal(i.actByText, null);
    assert.equal(i.status, 'active');
  }
});

test('a passed home suggestion or partner-only item has no official page, so it stays in the list without its past date', () => {
  const p = planAt(5);
  for (const id of ['home-pets', 'home-airport-parking']) {
    const i = p.items.find((x) => x.id === id);
    assert.ok(i, `${id} is still in the list`);
    assert.equal(i.actByDate, null);
    assert.equal(i.actByText, null);
    assert.ok(!ids(p.pastItems).includes(id));
  }
  const phone = planAt(2).items.find((i) => i.id === 'destination-phone-data');
  assert.ok(phone, 'phone and data (3 days) is past its suggested date but can be done today');
  assert.equal(phone.actByDate, null);
  assert.equal(phone.partner.slug, 'yesim', 'its disclosed partner is kept');
});

test('the passport item points to the State Department page for urgent passport travel, only when the plan is late', () => {
  const late = planAt(5).items.find((i) => i.id === 'passport-check');
  assert.equal(late.lateUrl, PASSPORT_URGENT_URL);
  assert.equal(PASSPORT_URGENT_URL, 'https://travel.state.gov/en/passports/apply/get-fast.html');
  assert.equal(late.lateNote, "If it needs renewing, here's the fastest official route now.");
  assert.equal(late.officialUrl.endsWith('/thailand.html'), true, 'the country page link is still there');
  const early = planAt(30).items.find((i) => i.id === 'passport-check');
  assert.equal(early.lateUrl, undefined);
  assert.equal(planAt(5).items[0].id, 'passport-check', 'it stays first');
});

test('the plan makes no statement about appointments or availability', () => {
  const text = JSON.stringify(planAt(3, { answers: ALL_YES })) + fs.readFileSync(new URL('../plan.html', import.meta.url), 'utf8').replace(/<style[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(text, /appointment|availab|slots?\b|openings?\b|guarantee/i);
});

test('Short trips keep the cap of three in each list', () => {
  const p = planAt(4, { tripDays: 4, answers: ALL_YES });
  assert.equal(p.depth, 'short');
  const others = (list) => list.filter((i) => i.kind !== 'passport' && i.kind !== 'note');
  assert.ok(others(p.items).length <= 3, `${others(p.items).length} achievable items`);
  assert.ok(others(p.pastItems).length <= 3, `${others(p.pastItems).length} past items`);
  assert.equal(p.items[0].id, 'passport-check');
});

test('held rules are never moved to the past list: they keep their notice and link', () => {
  const p = planAt(5, { overrides: { idp: { status: 'held' } } });
  const idp = p.items.find((i) => i.id === 'idp');
  assert.equal(idp.status, 'held');
  assert.equal(idp.heldNotice, 'This changed recently. Check the official page:');
  assert.ok(!ids(p.pastItems).includes('idp'));
  const brazil = planAt(5, { destination: 'Rio de Janeiro, Brazil' });
  assert.equal(brazil.items.find((i) => i.id === 'brazil-evisa').heldNotice, 'Check the official page:');
});

test('the calendar file has no event for an item that is past its window', () => {
  const p = planAt(5);
  const ics = buildLeaveByIcs(p.items);
  assert.ok(!ics.includes('SUMMARY:Get an International Driving Permit'));
  assert.ok(!ics.includes('SUMMARY:Enroll your trip in STEP'));
  assert.ok(ics.includes('SUMMARY:Ask USPS to hold your mail'));
  assert.ok(!buildLeaveByIcs(p.pastItems).includes('BEGIN:VEVENT'), 'past items carry no date, so no event');
});

test('a bad "today" or "now" never throws: the plan falls back to the real date', () => {
  assert.doesNotThrow(() => buildLeaveByPlan({ destination: 'Tokyo, Japan', departureDate: '2030-01-10', returnDate: '2030-01-20', today: 'tomorrow' }));
  assert.doesNotThrow(() => buildLeaveByPlan({ destination: 'Tokyo, Japan', departureDate: '2030-01-10', returnDate: '2030-01-20', now: 'yesterday' }));
  assert.equal(buildLeaveByPlan({ destination: 'Tokyo, Japan', departureDate: '2030-01-10', returnDate: '2030-01-20', today: 'tomorrow' }).late, false);
  assert.equal(buildLeaveByPlan({ destination: 'Tokyo, Japan' }).late, false, 'no leaving date means no late mode');
});

test('the page: checks the leaving date against the visitor\'s own date, renders the past list, and still sends nothing about dates', () => {
  const page = fs.readFileSync(new URL('../plan.html', import.meta.url), 'utf8');
  assert.match(page, /id="past-card"[^>]*hidden/);
  assert.match(page, /<h2>Past its window<\/h2>/);
  assert.match(page, /today: todayLocal\(\)/);
  assert.match(page, /Pick a leaving date that is today or later\./);
  assert.match(page, /plan\.pastItems/);
  assert.match(page, /it\.lateUrl/);
  assert.deepEqual([...page.matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1]), ['/api/leave-by-plan/status']);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
  assert.equal(fs.readFileSync(new URL('../leave-by-rules.js', import.meta.url), 'utf8'), fs.readFileSync(new URL('../src/data/leaveByRules.js', import.meta.url), 'utf8'));
});
