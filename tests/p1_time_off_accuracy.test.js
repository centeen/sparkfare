import test from 'node:test';
import assert from 'node:assert/strict';
import { federalHolidays, holidayOptions, holidaysInRange, bridgeOpportunities, summarizeByHoliday, BLOCK_REACH, addDays, COMMON_HOLIDAY_SET } from '../src/ptoCalendar.js';
import { renderTimeOffIndex, renderTimeOffEmbed, renderTimeOffOrigin, holidayRowsHtml } from '../src/ptoPages.js';

const NOW = new Date('2026-10-26T12:00:00Z');
const obs = (year, key) => federalHolidays(year).find((h) => h.key === key).observed;

test('observed dates for the default set, Nov 2026 to Dec 2027, match the OPM rule', () => {
  assert.equal(obs(2026, 'thanksgiving'), '2026-11-26');
  assert.equal(obs(2026, 'day_after_thanksgiving'), '2026-11-27');
  assert.equal(obs(2026, 'christmas'), '2026-12-25');
  assert.equal(obs(2027, 'new_year'), '2027-01-01');
  assert.equal(obs(2027, 'independence'), '2027-07-05'); // Sunday Jul 4 -> Monday
  assert.equal(obs(2027, 'thanksgiving'), '2027-11-25');
  assert.equal(obs(2027, 'christmas'), '2027-12-24'); // Saturday Dec 25 -> Friday
  assert.equal(obs(2028, 'new_year'), '2027-12-31'); // Saturday Jan 1 -> Friday, across the year boundary
});

const rows = (from, to, earliest) => holidayOptions({ from, to, earliest });
const find = (summary, key) => summary.find((r) => r.holiday.key === key);

test('134: the day after Thanksgiving has no row of its own and is noted on Thanksgiving', () => {
  const s = rows('2026-10-26', '2027-12-31');
  assert.equal(find(s, 'day_after_thanksgiving'), undefined);
  const t = find(s, 'thanksgiving');
  assert.deepEqual(t.includes.map((h) => h.key), ['day_after_thanksgiving']);
  assert.ok(t.options.length > 0);
  const html = holidayRowsHtml(s);
  assert.doesNotMatch(html, /Day after Thanksgiving<\/strong>/);
  assert.match(html, /Includes the day after Thanksgiving when your employer gives it/);
  assert.doesNotMatch(html, /No long weekend/);
});

test('134: with the day left out of the set, nothing is folded and Thanksgiving is unchanged', () => {
  const keys = COMMON_HOLIDAY_SET.filter((k) => k !== 'day_after_thanksgiving');
  const s = holidayOptions({ from: '2026-10-26', to: '2027-12-31', keys });
  assert.equal(find(s, 'thanksgiving').includes.length, 0);
});

test('135: New Year\'s Day observed Fri Dec 31, 2027 has a zero-PTO weekend', () => {
  const s = rows('2026-10-26', '2027-12-31');
  const ny = s.find((r) => r.holiday.observed === '2027-12-31');
  assert.ok(ny, 'row exists');
  const free = ny.options.find((b) => b.ptoUsed === 0);
  assert.ok(free);
  assert.deepEqual([free.start, free.end, free.daysOff], ['2027-12-31', '2028-01-02', 3]);
});

test('135: every default holiday through 2027 shows at least one option', () => {
  for (const r of rows('2026-10-26', '2027-12-31')) assert.ok(r.options.length > 0, `${r.holiday.key} ${r.holiday.observed}`);
});

test('136: Jan 1, 2027 gets the same options in both tables, and shows both directions', () => {
  const all = rows('2026-10-26', '2027-12-31');
  const y27 = rows('2027-01-01', '2027-12-31', addDays('2027-01-01', -BLOCK_REACH));
  const pick = (s) => s.find((r) => r.holiday.observed === '2027-01-01').options.map((b) => `${b.start}:${b.end}`);
  assert.deepEqual(pick(y27), pick(all));
  const text = pick(all);
  assert.ok(text.includes('2026-12-31:2027-01-03'), 'Thu Dec 31 option');
  assert.ok(text.includes('2027-01-01:2027-01-04'), 'Mon Jan 4 option');
});

test('the planner and the tables use the same blocks for the same range', () => {
  const holidays = holidaysInRange({ from: '2026-10-26', to: '2027-12-31' });
  const blocks = bridgeOpportunities({ from: '2026-10-26', to: '2027-12-31', holidays });
  const ids = (s) => s.flatMap((r) => r.options.map((b) => `${b.start}:${b.end}`)).sort();
  assert.deepEqual(ids(summarizeByHoliday({ holidays, blocks })), ids(rows('2026-10-26', '2027-12-31')));
  // the planner still never suggests days that are already past
  assert.ok(blocks.every((b) => b.start >= '2026-10-26'));
});

test('137: the national table says what it actually uses', () => {
  const html = renderTimeOffIndex({ appUrl: 'https://sparkfare.com', now: NOW });
  assert.match(html, /Using the seven holidays most private employers give\. Choose your own set in the planner\./);
  assert.doesNotMatch(html, /standard federal holiday schedule/);
});

test('all four places render the same rows', () => {
  const embed = renderTimeOffEmbed({ appUrl: 'https://sparkfare.com', now: NOW });
  const index = renderTimeOffIndex({ appUrl: 'https://sparkfare.com', now: NOW });
  const origin = renderTimeOffOrigin({ origin: 'SEA', now: NOW, appUrl: 'https://sparkfare.com' });
  for (const html of [embed, index, origin]) {
    assert.doesNotMatch(html, /Day after Thanksgiving<\/strong>/);
    assert.match(html, /Includes the day after Thanksgiving/);
    assert.match(html, /Dec 31/);
  }
  const jan = (html) => (html.match(/New Year[^<]*<\/strong>[\s\S]*?<\/tr>/g) || []).filter((r) => /Jan 1/.test(r))[0].replace(/\s+/g, ' ');
  assert.equal(jan(embed), jan(index.split('id="2027-long-weekends"')[1]));
});
