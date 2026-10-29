import test from 'node:test';
import assert from 'node:assert/strict';
import { holidaysInRange, bridgeOpportunities, summarizeByHoliday, COMMON_HOLIDAY_SET } from '../src/ptoCalendar.js';
import { renderTimeOffIndex, renderTimeOffEmbed, renderTimeOffOrigin } from '../src/ptoPages.js';

const NOW = new Date('2026-10-29T12:00:00Z');
const table = (from, to, earliest) => {
  const holidays = holidaysInRange({ from, to });
  const blocks = bridgeOpportunities({ from, to, holidays, ...(earliest === undefined ? {} : { earliest }) });
  return summarizeByHoliday({ holidays, blocks });
};

test('observed dates, Nov 2026 to Dec 2027 (OPM rule)', () => {
  const got = holidaysInRange({ from: '2026-11-01', to: '2027-12-31' }).map((h) => `${h.key}:${h.observed}`);
  assert.deepEqual(got, [
    'thanksgiving:2026-11-26', 'day_after_thanksgiving:2026-11-27', 'christmas:2026-12-25', 'new_year:2027-01-01',
    'memorial:2027-05-31', 'independence:2027-07-05', 'labor:2027-09-06', 'thanksgiving:2027-11-25',
    'day_after_thanksgiving:2027-11-26', 'christmas:2027-12-24', 'new_year:2027-12-31',
  ]);
});

test('134: the day after Thanksgiving has no row of its own, and Thanksgiving carries the note', () => {
  const rows = table('2026-10-29', '2027-12-31');
  assert.equal(rows.filter((r) => r.holiday.key === 'day_after_thanksgiving').length, 0);
  for (const r of rows.filter((x) => x.holiday.key === 'thanksgiving')) assert.deepEqual(r.foldedKeys, ['day_after_thanksgiving']);
});

test('134: with the day after Thanksgiving off the set, nothing is folded', () => {
  const keys = COMMON_HOLIDAY_SET.filter((k) => k !== 'day_after_thanksgiving');
  const holidays = holidaysInRange({ from: '2026-10-29', to: '2027-12-31', keys });
  const rows = summarizeByHoliday({ holidays, blocks: bridgeOpportunities({ from: '2026-10-29', to: '2027-12-31', holidays }) });
  assert.ok(rows.every((r) => r.foldedKeys.length === 0));
});

test('135: New Year\'s Day observed Fri Dec 31, 2027 has its block', () => {
  const rows = table('2027-01-01', '2027-12-31', null);
  const ny = rows.find((r) => r.holiday.observed === '2027-12-31');
  assert.ok(ny, 'row exists');
  assert.ok(ny.options.some((b) => b.start === '2027-12-31' && b.end === '2028-01-02' && b.ptoUsed === 0));
});

test('136: Jan 1, 2027 offers the same options in the year table and the from-today table', () => {
  const a = table('2026-10-29', '2027-12-31').find((r) => r.holiday.observed === '2027-01-01');
  const b = table('2027-01-01', '2027-12-31', null).find((r) => r.holiday.observed === '2027-01-01');
  const f = (r) => r.options.map((x) => `${x.start}:${x.end}`);
  assert.deepEqual(f(a), f(b));
  assert.ok(f(a).includes('2026-12-31:2027-01-03') && f(a).includes('2027-01-01:2027-01-04'), 'both tied 4-day options shown');
});

test('the planner never starts before today', () => {
  const holidays = holidaysInRange({ from: '2026-11-27', to: '2027-12-31' });
  const blocks = bridgeOpportunities({ from: '2026-11-27', to: '2027-12-31', holidays });
  assert.ok(blocks.every((b) => b.start >= '2026-11-27'));
});

test('pages: no "standard federal" wording, one note, no empty day-after row, embed agrees with the index', () => {
  const index = renderTimeOffIndex({ appUrl: 'https://x.test', now: NOW });
  const embed = renderTimeOffEmbed({ appUrl: 'https://x.test', now: NOW });
  const origin = renderTimeOffOrigin({ origin: 'SEA', now: NOW, appUrl: 'https://x.test' });
  for (const html of [index, embed, origin]) {
    assert.ok(!/standard federal holiday schedule/.test(html));
    assert.ok(!/<strong>Day after Thanksgiving<\/strong>/.test(html));
    assert.ok(html.includes('Includes the day after Thanksgiving when your employer gives it.'));
  }
  assert.ok(index.includes('Dec 31 to Jan 2') || /Dec 31/.test(index));
  assert.ok(!/Fri, Dec 31, 2027<\/span><\/td><td><span class="muted">No long weekend/.test(index));
});
