// S-copy B (D-067 item 5, ROADMAP step 195): one plain /check sentence in the Holiday Fare Report text. No fare, route or partner link; method links unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderHolidayReport } from '../src/holidayReport.js';

const SENTENCE = `Have a fare in mind? Check it against its route's own price history with Sparkfare's free <a href="/check">price checker</a>.`;
const body = (html) => html.split('<main')[1] || html;

test('the sentence appears once, with a plain /check link and no tracking parameters', () => {
  const html = renderHolidayReport({});
  assert.equal(html.split(SENTENCE).length - 1, 1);
  assert.ok(!/\/check\?/.test(html));
});

test('it sits right after the /how-it-works method paragraph, and both /how-it-works links are unchanged', () => {
  const html = renderHolidayReport({});
  assert.equal(html.split('<a href="/how-it-works">how Sparkfare works</a>').length - 1, 2);
  const m = html.indexOf('staleness rules, see <a href="/how-it-works">');
  assert.ok(m > 0 && html.indexOf(SENTENCE) > m && html.indexOf(SENTENCE) - m < 200);
});

test('R-Q1 re-scan: the report body still has no fare, route, Book or partner link', () => {
  const html = body(renderHolidayReport({}));
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((x) => x[1]);
  for (const h of hrefs) assert.ok(!/\/flight\/|\/out\/|\/go\/|aviasales|\/data\/|\/deal\//i.test(h) || /^\/data\/?$/.test(h), h);
  assert.ok(!/View fare|Book /.test(html));
});

test('the generator emits the same sentence the checked-in module has', () => {
  const gen = fs.readFileSync(new URL('../scripts/generate-holiday-report.mjs', import.meta.url), 'utf8');
  assert.equal(gen.split(SENTENCE).length - 1, 1);
});
