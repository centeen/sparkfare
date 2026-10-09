// PTO calendar (ROADMAP step 72): the pure date math, bridges, optimizer, destination fit and iCalendar output.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  federalHolidays, holidaysInRange, bridgeOpportunities, optimize, buildPlan, summarizeByHoliday, describeBlock,
  tripLengthBucket, destinationsForWindow, DESTINATION_FIT, COMMON_HOLIDAY_SET, HOLIDAY_ORDER,
  encodeHolidaySet, decodeHolidaySet, DEFAULT_HOLIDAY_CODE, addDays, dayOfWeek, daysBetweenInclusive, parseDay, buildIcs,
} from '../src/ptoCalendar.js';

// OPM's published observed dates (opm.gov federal holidays, read 2026-10-09). Anything different is a bug here.
const OPM = {
  2026: ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25'],
  2027: ['2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-24'],
  2028: ['2027-12-31', '2028-01-17', '2028-02-21', '2028-05-29', '2028-06-19', '2028-07-04', '2028-09-04', '2028-10-09', '2028-11-10', '2028-11-23', '2028-12-25'],
};
const federalOnly = (year) => federalHolidays(year).filter((h) => h.key !== 'day_after_thanksgiving');

test('federal holidays and observed dates match OPM for 2026 to 2028', () => {
  for (const year of [2026, 2027, 2028]) {
    const observed = federalOnly(year).map((h) => h.observed).sort();
    assert.deepEqual(observed, [...OPM[year]].sort(), String(year));
  }
});

test('observed rule: Saturday goes to the Friday before, Sunday to the Monday after, New Year on a Saturday to Dec 31', () => {
  const by = (year, key) => federalHolidays(year).find((h) => h.key === key);
  assert.equal(by(2027, 'juneteenth').date, '2027-06-19');
  assert.equal(by(2027, 'juneteenth').observed, '2027-06-18'); // a Saturday
  assert.equal(by(2027, 'independence').date, '2027-07-04');
  assert.equal(by(2027, 'independence').observed, '2027-07-05'); // a Sunday
  assert.equal(by(2027, 'christmas').observed, '2027-12-24'); // a Saturday
  assert.equal(by(2028, 'new_year').date, '2028-01-01');
  assert.equal(by(2028, 'new_year').observed, '2027-12-31'); // a Saturday: observed in the previous year
  assert.equal(by(2026, 'thanksgiving').observed, '2026-11-26'); // never moved
});

test('the day after Thanksgiving is the Friday after it', () => {
  for (const year of [2026, 2027, 2028]) {
    const f = federalHolidays(year);
    const t = f.find((h) => h.key === 'thanksgiving').observed;
    assert.equal(f.find((h) => h.key === 'day_after_thanksgiving').observed, addDays(t, 1));
    assert.equal(dayOfWeek(addDays(t, 1)), 5);
  }
});

test('holiday set codes round-trip, and invalid codes are rejected', () => {
  assert.deepEqual(decodeHolidaySet(encodeHolidaySet(COMMON_HOLIDAY_SET)), HOLIDAY_ORDER.filter((k) => COMMON_HOLIDAY_SET.includes(k)));
  assert.equal(decodeHolidaySet(DEFAULT_HOLIDAY_CODE).length, COMMON_HOLIDAY_SET.length);
  assert.deepEqual(decodeHolidaySet('0'), []);
  for (const bad of ['', 'zzzzz', '-1', 'ABC', '1.5', null, undefined, 'zzzz']) assert.equal(decodeHolidaySet(bad), null, String(bad));
});

test('dates survive a daylight-saving change (UTC arithmetic only)', () => {
  assert.equal(addDays('2027-03-13', 1), '2027-03-14'); // US spring forward
  assert.equal(addDays('2027-11-06', 1), '2027-11-07'); // US fall back
  assert.equal(daysBetweenInclusive('2027-03-01', '2027-03-31'), 31);
  assert.equal(daysBetweenInclusive('2027-11-01', '2027-11-30'), 30);
  assert.throws(() => parseDay('2027-02-30'));
  assert.throws(() => parseDay('nope'));
});

// ---- bridges ------------------------------------------------------------------------------------------------

const blocksFor = (from, to, keys) => {
  const holidays = holidaysInRange({ from, to, keys });
  return { holidays, blocks: bridgeOpportunities({ from, to, holidays }) };
};
const find = (blocks, start, end) => blocks.find((b) => b.start === start && b.end === end);

test('a Thursday holiday: take Friday off and get four days', () => {
  const { blocks } = blocksFor('2026-11-01', '2026-12-01', ['thanksgiving']);
  const b = find(blocks, '2026-11-26', '2026-11-29');
  assert.ok(b, 'Thu to Sun block exists');
  assert.equal(b.ptoUsed, 1);
  assert.deepEqual(b.ptoDates, ['2026-11-27']);
  assert.equal(b.daysOff, 4);
});

test('a Tuesday holiday: take Monday off and get four days', () => {
  const { blocks } = blocksFor('2028-06-01', '2028-07-31', ['independence']); // Tue Jul 4 2028
  const b = find(blocks, '2028-07-01', '2028-07-04');
  assert.ok(b);
  assert.equal(b.ptoUsed, 1);
  assert.deepEqual(b.ptoDates, ['2028-07-03']);
  assert.equal(b.daysOff, 4);
});

test('a Wednesday holiday: two PTO days give five days off', () => {
  const { blocks } = blocksFor('2026-11-01', '2026-11-30', ['veterans']); // Wed Nov 11 2026
  const b = find(blocks, '2026-11-11', '2026-11-15');
  assert.ok(b);
  assert.equal(b.ptoUsed, 2);
  assert.equal(b.daysOff, 5);
});

test('a Monday holiday is a free three-day weekend', () => {
  const { blocks } = blocksFor('2027-05-01', '2027-06-15', ['memorial']); // Mon May 31 2027
  const b = find(blocks, '2027-05-29', '2027-05-31');
  assert.ok(b);
  assert.equal(b.ptoUsed, 0);
  assert.equal(b.daysOff, 3);
});

test('every block is a whole run of days off, within range, with 0 to 5 PTO days and honest counts', () => {
  const { holidays, blocks } = blocksFor('2026-10-09', '2027-12-31', COMMON_HOLIDAY_SET);
  const off = new Set(holidays.map((h) => h.observed));
  const isOff = (d) => dayOfWeek(d) === 0 || dayOfWeek(d) === 6 || off.has(d);
  assert.ok(blocks.length > 50);
  for (const b of blocks) {
    assert.ok(b.start >= '2026-10-09' && b.end <= '2027-12-31');
    assert.equal(b.daysOff, daysBetweenInclusive(b.start, b.end));
    assert.ok(b.ptoUsed >= 0 && b.ptoUsed <= 5);
    assert.equal(b.ptoDates.length, b.ptoUsed);
    assert.ok(!isOff(addDays(b.start, -1)) && !isOff(addDays(b.end, 1)), `${b.start}..${b.end} stops short of a free day`);
    for (let d = b.start; d <= b.end; d = addDays(d, 1)) assert.equal(b.ptoDates.includes(d), !isOff(d), d);
    assert.ok(b.holidayKeys.length >= 1);
  }
});

// ---- optimizer ----------------------------------------------------------------------------------------------

const FULL = blocksFor('2026-10-09', '2027-12-31', COMMON_HOLIDAY_SET).blocks;

test('optimizer never exceeds the budget and never overlaps, for every budget from 0 to 30', () => {
  for (let budget = 0; budget <= 30; budget += 1) {
    const { plan, totals } = optimize({ budget, blocks: FULL });
    assert.ok(totals.ptoUsed <= budget, `budget ${budget}`);
    for (let i = 1; i < plan.length; i += 1) assert.ok(plan[i - 1].end < plan[i].start, `overlap at budget ${budget}`);
    assert.equal(totals.daysOff, plan.reduce((s, b) => s + b.daysOff, 0));
    assert.equal(totals.ptoUsed, plan.reduce((s, b) => s + b.ptoUsed, 0));
  }
});

test('optimizer is deterministic, and more budget never gives fewer days off', () => {
  assert.deepEqual(optimize({ budget: 10, blocks: FULL }), optimize({ budget: 10, blocks: [...FULL].reverse() }));
  let last = 0;
  for (let budget = 0; budget <= 30; budget += 1) {
    const { totals } = optimize({ budget, blocks: FULL });
    assert.ok(totals.daysOff >= last, `budget ${budget}`);
    last = totals.daysOff;
  }
});

test('budget 0 returns only free long weekends', () => {
  const { plan, totals } = optimize({ budget: 0, blocks: FULL });
  assert.ok(plan.length > 0);
  for (const b of plan) { assert.equal(b.ptoUsed, 0); assert.ok(b.daysOff >= 3); }
  assert.equal(totals.ptoUsed, 0);
});

test('optimizer matches a brute-force search on a small range', () => {
  const small = blocksFor('2026-11-01', '2027-01-31', COMMON_HOLIDAY_SET).blocks;
  for (const budget of [0, 2, 4, 6]) {
    const items = small.filter((b) => (b.ptoUsed === 0 ? b.daysOff >= 3 : b.daysOff >= 4) && b.ptoUsed <= budget)
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    let best = 0;
    const walk = (i, lastEnd, pto, days) => {
      if (i === items.length) { if (days > best) best = days; return; }
      walk(i + 1, lastEnd, pto, days);
      const it = items[i];
      if (it.start > lastEnd && pto + it.ptoUsed <= budget) walk(i + 1, it.end, pto + it.ptoUsed, days + it.daysOff);
    };
    walk(0, '0000-00-00', 0, 0);
    assert.equal(optimize({ budget, blocks: small }).totals.daysOff, best, `budget ${budget}`);
  }
});

test('the ten-day default plan is the documented example shape: PTO used and days off, counting only block days', () => {
  const { totals, plan } = buildPlan({ from: '2026-10-09', to: '2027-12-31', budget: 10 });
  assert.ok(totals.ptoUsed <= 10);
  assert.ok(totals.daysOff > totals.ptoUsed * 3, 'a plan should multiply the PTO used');
  assert.equal(totals.daysOff, plan.reduce((s, b) => s + daysBetweenInclusive(b.start, b.end), 0));
});

test('summarizeByHoliday never repeats a block', () => {
  const { holidays, blocks } = blocksFor('2026-11-01', '2026-12-31', COMMON_HOLIDAY_SET);
  const seen = new Set();
  for (const { options } of summarizeByHoliday({ holidays, blocks })) {
    for (const b of options) { const id = `${b.start}:${b.end}`; assert.ok(!seen.has(id)); seen.add(id); }
  }
});

test('describeBlock names the days to request off, or says none are needed', () => {
  const thanksgivingOnly = blocksFor('2026-11-01', '2026-12-01', ['thanksgiving']).blocks;
  assert.equal(describeBlock(find(thanksgivingOnly, '2026-11-26', '2026-11-29')).headline, 'Take Fri Nov 27 off, get 4 days');
  // With the day after Thanksgiving also off (the default set) the same four days cost nothing.
  const defaults = blocksFor('2026-11-01', '2026-12-01', COMMON_HOLIDAY_SET).blocks;
  assert.equal(describeBlock(find(defaults, '2026-11-26', '2026-11-29')).headline, 'No time off needed: 4 days');
  assert.equal(describeBlock({ ptoUsed: 2, ptoDates: ['2026-11-23', '2026-11-24'], daysOff: 7, start: '2026-11-21', end: '2026-11-27' }).headline, 'Take Mon Nov 23 and Tue Nov 24 off, get 7 days');
});

// ---- destinations -------------------------------------------------------------------------------------------

test('a destination table entry exists for every destination, and no extras', () => {
  const real = Object.keys(JSON.parse(fs.readFileSync(new URL('../sparkfare_destinations.json', import.meta.url), 'utf8'))).sort();
  assert.deepEqual(Object.keys(DESTINATION_FIT).sort(), real);
  for (const [name, days] of Object.entries(DESTINATION_FIT)) assert.ok(Number.isInteger(days) && days >= 3 && days <= 14, name);
});

test('a short window never suggests a long-haul destination', () => {
  for (const days of [3, 4]) {
    const names = destinationsForWindow(days, 'DEN');
    assert.ok(names.length > 0);
    for (const n of names) assert.ok(DESTINATION_FIT[n] <= days, `${n} for ${days} days`);
    assert.ok(!names.includes('Bali, Indonesia') && !names.includes('Tokyo, Japan'));
  }
  assert.equal(destinationsForWindow(9).length, Object.keys(DESTINATION_FIT).length);
  assert.deepEqual(destinationsForWindow(2), []);
});

test('trip-length buckets match the signup form values', () => {
  const expected = { 3: 'weekend', 4: '4-6', 6: '4-6', 7: '7-10', 10: '7-10', 11: '11-14', 14: '11-14', 15: '2+ weeks', 30: '2+ weeks' };
  for (const [days, bucket] of Object.entries(expected)) assert.equal(tripLengthBucket(Number(days)), bucket, days);
});

// ---- iCalendar ----------------------------------------------------------------------------------------------

// A minimal RFC 5545 reader: unfold, split, check nesting and required properties.
function parseIcs(text) {
  assert.ok(text.endsWith('\r\n'), 'ends with CRLF');
  assert.ok(!/(^|[^\r])\n/.test(text), 'every line break is CRLF');
  const physical = text.split('\r\n').slice(0, -1);
  for (const line of physical) assert.ok(new TextEncoder().encode(line).length <= 75, `line over 75 octets: ${line.slice(0, 30)}`);
  const lines = [];
  for (const line of physical) { if (line.startsWith(' ')) lines[lines.length - 1] += line.slice(1); else lines.push(line); }
  const events = [];
  let cur = null;
  const stack = [];
  for (const line of lines) {
    if (line.startsWith('BEGIN:')) { stack.push(line.slice(6)); if (line === 'BEGIN:VEVENT') cur = {}; continue; }
    if (line.startsWith('END:')) { assert.equal(stack.pop(), line.slice(4)); if (line === 'END:VEVENT') { events.push(cur); cur = null; } continue; }
    if (cur) { const i = line.indexOf(':'); cur[line.slice(0, i)] = line.slice(i + 1); }
  }
  assert.deepEqual(stack, []);
  return { lines, events };
}

test('.ics output parses, uses exclusive all-day end dates and stable UIDs, and carries no fares', () => {
  const { plan } = buildPlan({ from: '2026-10-09', to: '2027-12-31', budget: 10 });
  const now = new Date('2026-10-12T08:00:00Z');
  const make = () => buildIcs({ origin: 'DEN', originCity: 'Denver', plan, pageUrl: 'https://sparkfare.com/time-off/den', now });
  const text = make();
  const { lines, events } = parseIcs(text);
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.equal(events.length, plan.length);
  events.forEach((e, i) => {
    const b = plan[i];
    assert.equal(e.UID, `${b.start}-${b.end}-DEN@sparkfare.com`);
    assert.equal(e['DTSTART;VALUE=DATE'], b.start.replace(/-/g, ''));
    assert.equal(e['DTEND;VALUE=DATE'], addDays(b.end, 1).replace(/-/g, ''));
    assert.equal(e.DTSTAMP, '20261012T080000Z');
    assert.match(e.SUMMARY, /^Long weekend \(/);
    assert.doesNotMatch(e.DESCRIPTION + e.SUMMARY, /\$\d/);
  });
  assert.equal(make(), text, 'same input, same file');
});

test('.ics folds long lines without splitting a multi-byte character', () => {
  const plan = [{ start: '2026-11-26', end: '2026-11-29', ptoDates: ['2026-11-27'], ptoUsed: 1, daysOff: 4, holidayKeys: ['thanksgiving'], efficiency: 4 }];
  const text = buildIcs({ origin: 'DEN', originCity: 'Dénver, “Mile High”; ✈ ' + 'x'.repeat(120), plan, pageUrl: 'https://sparkfare.com/time-off/den', now: new Date('2026-10-12T00:00:00Z') });
  const { lines } = parseIcs(text);
  const name = lines.find((l) => l.startsWith('X-WR-CALNAME:'));
  assert.ok(name.includes('✈') && name.includes('“Mile High”'), 'characters survive folding');
  assert.ok(name.includes('\\,') && name.includes('\\;'), 'commas and semicolons are escaped');
});

test('optimizer: blocks that share a day are never both chosen, but back-to-back blocks can be', () => {
  const mk = (start, end, ptoUsed, daysOff) => ({ start, end, ptoUsed, daysOff, ptoDates: [], holidayKeys: ['x'], efficiency: null });
  const a = mk('2026-11-02', '2026-11-06', 3, 5);
  const sharesADay = mk('2026-11-06', '2026-11-10', 3, 5);
  const startsNextDay = mk('2026-11-07', '2026-11-11', 3, 5);
  const both = optimize({ budget: 30, blocks: [a, sharesADay] });
  assert.equal(both.plan.length, 1, 'overlapping on 2026-11-06');
  const adjacent = optimize({ budget: 30, blocks: [a, startsNextDay] });
  assert.equal(adjacent.plan.length, 2);
  assert.equal(adjacent.totals.daysOff, 10);
});

test('optimizer: a block that needs more PTO than the budget is never chosen', () => {
  const big = { start: '2026-11-02', end: '2026-11-10', ptoUsed: 5, daysOff: 9, ptoDates: [], holidayKeys: ['x'], efficiency: 1.8 };
  assert.equal(optimize({ budget: 4, blocks: [big] }).plan.length, 0);
  assert.equal(optimize({ budget: 5, blocks: [big] }).plan.length, 1);
});
