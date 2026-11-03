// S-copy C (D-067 item 7, ROADMAP step 196): the CC BY 4.0 licence on the Holiday Fare Report is one switch, ENABLE_REPORT_CC_BY, default off.
// Off: nothing licence-shaped in the page or its JSON-LD, a plain credit line instead. On: today's text exactly. The CSVs never change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';
import { renderHolidayReport, HOLIDAY_REPORT_CSV, HOLIDAY_DEPARTURES_CSV } from '../src/holidayReport.js';

const ON = { ENABLE_REPORT_CC_BY: 'true' };
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const jsonLd = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test('off (default): no creativecommons, CC BY or license anywhere in the page or its JSON-LD', () => {
  for (const env of [undefined, {}, { ENABLE_REPORT_CC_BY: 'false' }, { ENABLE_REPORT_CC_BY: 'TRUE' }, { ENABLE_REPORT_CC_BY: '1' }]) {
    const html = renderHolidayReport(env);
    assert.ok(!/creativecommons/i.test(html), 'no licence URL');
    assert.ok(!/CC BY/i.test(html), 'no licence name');
    assert.ok(!/license/i.test(html), 'no license property or word');
    assert.ok(!('license' in jsonLd(html)));
  }
});

test('off: a plain credit line replaces both "Reuse under" lines, with the same as-of time', () => {
  const html = renderHolidayReport({});
  assert.equal(html.split('Reuse under').length - 1, 0);
  const credits = html.match(/Source: Sparkfare \(sparkfare\.com\), as of [^<]*<\/p>/g) || [];
  assert.equal(credits.length, 2, 'one beside each download group');
  const on = renderHolidayReport(ON);
  const asOf = (s) => s.match(/as of ([A-Z][a-z]+ \d{1,2}, \d{4} [\d:]+ UTC)/)[1];
  assert.equal(asOf(credits[0]), asOf(on.match(/Reuse under[^<]*<a[^>]*>CC BY 4\.0<\/a>\. Attribution: [^<]*<\/p>/)[0]));
});

test('on: today\'s text exactly (two visible lines and the Dataset license)', () => {
  const html = renderHolidayReport(ON);
  assert.equal(html.split('Reuse under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Attribution: Sparkfare (sparkfare.com), as of ').length - 1, 2);
  assert.equal(jsonLd(html).license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.ok(!html.includes('Source: Sparkfare (sparkfare.com), as of'));
});

test('the page is identical in both states apart from those three places', () => {
  const strip = (h) => h
    .replace(/"license":"[^"]*",/, '')
    .replace(/Reuse under <a href="[^"]*">CC BY 4\.0<\/a>\. Attribution: Sparkfare/g, 'Source: Sparkfare');
  assert.equal(strip(renderHolidayReport(ON)), renderHolidayReport({}));
});

test('the CSVs are the same either way and carry no licence text', () => {
  assert.ok(!/creativecommons|CC BY|license/i.test(HOLIDAY_REPORT_CSV + HOLIDAY_DEPARTURES_CSV));
});

test('the Worker route follows the flag', async () => {
  const get = async (env) => (await worker.fetch(new Request('https://sparkfare.com/reports/holiday-2026'), { ENABLE_REPORTS: 'true', ...env }, { waitUntil() {} })).text();
  assert.ok(!/CC BY/.test(await get({})));
  assert.ok(/CC BY 4\.0/.test(await get(ON)));
});

test('wrangler.jsonc ships the flag on (Travelpayouts written yes, 2026-11-03), next to ENABLE_REPORTS', () => {
  const w = read('../wrangler.jsonc');
  assert.match(w, /"ENABLE_REPORT_CC_BY":\s*"true"/);
  assert.ok(w.indexOf('"ENABLE_REPORTS"') < w.indexOf('"ENABLE_REPORT_CC_BY"'));
});

test('the generator emits the same switch the checked-in module has, so regenerating cannot drop it', () => {
  const gen = read('../scripts/generate-holiday-report.mjs');
  const mod = read('../src/holidayReport.js');
  const block = gen.match(/const LICENCE_SWITCH = String\.raw`([\s\S]*?)`;\n/)[1];
  assert.ok(block.includes('function applyReportLicence'));
  assert.ok(mod.includes(block), 'the module contains the generator text verbatim');
  assert.ok(gen.includes('return applyReportLicence(RAW_HTML.replace('));
  assert.ok(mod.includes('return applyReportLicence(RAW_HTML.replace('));
});
