import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTimeOffEmbed } from '../src/ptoPages.js';
import { COMMON_HOLIDAY_SET, HOLIDAY_NAMES } from '../src/ptoCalendar.js';

const html = renderTimeOffEmbed({ appUrl: 'https://sparkfare.com', now: new Date('2026-11-01T00:00:00Z') });
const unescape = (s) => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&');

test('S2: embed line says the table is built from seven default holidays', () => {
  assert.ok(html.includes('<p class="sub">2027 long weekends, built from seven default holidays (listed below). Choose your own on any airport page.</p>'));
  assert.equal(COMMON_HOLIDAY_SET.length, 7);
});

test('S2: embed does not claim national federal holidays', () => {
  assert.ok(!/National federal holidays/i.test(html));
});

test('S2: table rows are exactly the default set (day after Thanksgiving is folded under Thanksgiving)', () => {
  const labels = new Set([...html.matchAll(/<td><strong>(.*?)<\/strong>/g)].map((m) => unescape(m[1])));
  const expected = new Set(COMMON_HOLIDAY_SET.filter((k) => k !== 'day_after_thanksgiving').map((k) => HOLIDAY_NAMES[k]));
  assert.deepEqual([...labels].sort(), [...expected].sort());
  assert.ok(html.includes('Includes the day after Thanksgiving when your employer gives it.'));
});

test('S2: the line has no link, partner, fare or saving wording', () => {
  const line = html.match(/<p class="sub">(.*?)<\/p>/)[1];
  assert.ok(!/<a |\$|fare|sav(e|ing)|partner/i.test(line));
});
