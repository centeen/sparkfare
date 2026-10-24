// tests/m5_holiday_report.test.js
// Tests for Package M5: Holiday Fare Report page (/reports/holiday-2026)
// Addendum M (ROADMAP step 144)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import worker from '../src/index.js';
import {
  renderHolidayReport,
  HOLIDAY_REPORT_CSV,
  HOLIDAY_DEPARTURES_CSV,
  HOLIDAY_REPORT_DATA,
} from '../src/holidayReport.js';

const ROOT = path.resolve(process.cwd());

test('M5: flag-gated under ENABLE_REPORTS - returns 404 when flag is omitted or false', async () => {
  const envOff = { ENABLE_REPORTS: 'false' };
  const envEmpty = {};

  const paths = [
    '/reports/holiday-2026',
    '/reports/holiday-2026.html',
    '/reports/holiday-2026.csv',
    '/reports/holiday-2026-departures.csv',
    '/reports',
    '/reports/',
    '/reports/other',
  ];

  for (const p of paths) {
    const resOff = await worker.fetch(new Request(`https://sparkfare.com${p}`), envOff, { waitUntil() {} });
    assert.equal(resOff.status, 404, `Expected 404 for ${p} when ENABLE_REPORTS='false', got ${resOff.status}`);

    const resEmpty = await worker.fetch(new Request(`https://sparkfare.com${p}`), envEmpty, { waitUntil() {} });
    assert.equal(resEmpty.status, 404, `Expected 404 for ${p} when ENABLE_REPORTS is omitted, got ${resEmpty.status}`);
  }
});

test('M5: routes when ENABLE_REPORTS="true" - /reports redirects to /reports/holiday-2026', async () => {
  const env = { ENABLE_REPORTS: 'true' };

  const res1 = await worker.fetch(new Request('https://sparkfare.com/reports'), env, { waitUntil() {} });
  assert.equal(res1.status, 302);
  assert.equal(res1.headers.get('Location'), '/reports/holiday-2026');

  const res2 = await worker.fetch(new Request('https://sparkfare.com/reports/'), env, { waitUntil() {} });
  assert.equal(res2.status, 302);
  assert.equal(res2.headers.get('Location'), '/reports/holiday-2026');
});

test('M5: serves /reports/holiday-2026 HTML report with correct headers and status', async () => {
  const env = { ENABLE_REPORTS: 'true' };

  const res = await worker.fetch(new Request('https://sparkfare.com/reports/holiday-2026'), env, { waitUntil() {} });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /text\/html/);
  assert.match(res.headers.get('Cache-Control'), /public, max-age=3600/);

  const html = await res.text();
  assert.ok(html.includes('Holiday Fare Report 2026: international fares from 22 US airports'), 'Contains headline');
  assert.ok(html.includes('At or past the deal floor on'), 'Contains hero metrics with a date');
  assert.ok(html.includes('Coverage and deal share by US airport'), 'Contains hub table section');
  assert.ok(html.includes('Observed holiday-window departures'), 'Contains departures table section');
  assert.ok(html.includes('Methodology, Data Sources &amp; Sample Limits'), 'Contains methodology section');
});

test('M5: HEAD and method handling on /reports routes', async () => {
  const env = { ENABLE_REPORTS: 'true' };

  // HEAD returns 200 with null body
  const headRes = await worker.fetch(new Request('https://sparkfare.com/reports/holiday-2026', { method: 'HEAD' }), env, { waitUntil() {} });
  assert.equal(headRes.status, 200);
  const headBody = await headRes.text();
  assert.equal(headBody, '');

  // POST returns 405 Method Not Allowed
  const postRes = await worker.fetch(new Request('https://sparkfare.com/reports/holiday-2026', { method: 'POST' }), env, { waitUntil() {} });
  assert.equal(postRes.status, 405);
  assert.equal(postRes.headers.get('Allow'), 'GET, HEAD');
});

test('M5: serves /reports/holiday-2026.csv and /reports/holiday-2026-departures.csv downloads', async () => {
  const env = { ENABLE_REPORTS: 'true' };

  const resCsv1 = await worker.fetch(new Request('https://sparkfare.com/reports/holiday-2026.csv'), env, { waitUntil() {} });
  assert.equal(resCsv1.status, 200);
  assert.match(resCsv1.headers.get('Content-Type'), /text\/csv/);
  assert.equal(resCsv1.headers.get('Content-Disposition'), 'attachment; filename="holiday-2026.csv"');
  const csv1 = await resCsv1.text();
  assert.ok(csv1.startsWith('hub_code,hub_name,region,routes_tracked,priced_routes'), 'Hub CSV header matches');
  assert.ok(csv1.includes('US_TOTAL,"All 22 Tracked US Hubs"'), 'Contains US summary row');

  const resCsv2 = await worker.fetch(new Request('https://sparkfare.com/reports/holiday-2026-departures.csv'), env, { waitUntil() {} });
  assert.equal(resCsv2.status, 200);
  assert.match(resCsv2.headers.get('Content-Type'), /text\/csv/);
  assert.equal(resCsv2.headers.get('Content-Disposition'), 'attachment; filename="holiday-2026-departures.csv"');
  const csv2 = await resCsv2.text();
  assert.ok(csv2.startsWith('hub_code,holiday_window,departures_observed,at_or_past_deal_floor'), 'Departures CSV header matches');
  assert.ok(csv2.includes('Thanksgiving'), 'Contains Thanksgiving rows');
  assert.ok(csv2.includes('Christmas/New Year'), 'Contains Christmas/New Year rows');
});

test('M5: Schema.org Dataset structured data is valid JSON-LD', () => {
  const html = renderHolidayReport();
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'Found application/ld+json script block');

  const parsed = JSON.parse(match[1]);
  assert.equal(parsed['@type'], 'Dataset');
  assert.equal(parsed.name, 'Sparkfare Holiday Fare Report 2026: international fares from 22 US airports');
  assert.match(parsed.temporalCoverage, /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/, 'coverage dates come from the data');
  assert.equal(parsed.url, 'https://sparkfare.com/reports/holiday-2026');
  assert.equal(parsed.license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.ok(Array.isArray(parsed.distribution), 'distribution is an array');
  assert.equal(parsed.distribution.length, 2);
  assert.equal(parsed.distribution[0].contentUrl, 'https://sparkfare.com/reports/holiday-2026.csv');
  assert.equal(parsed.distribution[1].contentUrl, 'https://sparkfare.com/reports/holiday-2026-departures.csv');
});

test('M5: Strict compliance with Guard condition 5 (no predictions, no booking claims)', () => {
  const html = renderHolidayReport();
  const lowerHtml = html.toLowerCase();

  // Banned predictive phrases
  const bannedPhrases = [
    'cheapest day to book',
    'best day to book',
    'cheapest day to buy',
    'best day to buy',
    'prices will rise',
    'prices will fall',
    'book now before',
    'guaranteed savings',
    'will save you',
    'our prediction',
    'forecast',
  ];

  for (const phrase of bannedPhrases) {
    assert.ok(!lowerHtml.includes(phrase), `Prohibited phrase found: "${phrase}"`);
  }

  // Must include explicit non-commercial disclaimer with allowed copy phrase
  assert.ok(html.includes('Sparkfare does not sell or book travel.'), 'Contains canonical disclaimer');
});

test('M5: Brand v1 visual tokens - 0 hex literals, font floor, shared nav, site footer', () => {
  const html = renderHolidayReport();

  // Check 0 hex literals in HTML and inline CSS
  // Exclude entity refs or URLs; test for CSS hex colors #xxx or #xxxxxx
  const hexPattern = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  const hexMatches = html.match(hexPattern) || [];
  assert.deepEqual(hexMatches, [], `Found disallowed hex colors in report HTML: ${hexMatches.join(', ')}`);

  // Check shared header and site footer
  assert.ok(html.includes('class="site-header"'), 'Contains shared header container');
  assert.ok(html.includes('class="site-nav'), 'Contains shared site-nav');
  assert.ok(html.includes('<script src="/site-footer.js" defer></script>'), 'Contains site-footer script');

  // Check skip link
  assert.ok(html.includes('<a class="skip-link" href="#main">Skip to main content</a>'), 'Contains skip-link');

  // Check font size floor: no 0.8rem or smaller (0.8125rem / 13px floor)
  assert.ok(!html.includes('font-size: 0.8rem'), 'No font-size below 13px floor');
  assert.ok(!html.includes('font-size: 0.75rem'), 'No font-size below 13px floor');
});

test('M5: data integrity across 22 US origin hubs and holiday departure window', () => {
  // The data files move every day, so these check relationships, not a pinned snapshot.
  const d = HOLIDAY_REPORT_DATA;
  assert.equal(d.totalRoutes, 880);
  assert.ok(d.pricedRoutes <= d.totalRoutes);
  assert.ok(d.verdictCapableRoutes <= d.pricedRoutes);
  assert.ok(d.totalDeals <= d.verdictCapableRoutes);
  assert.equal(d.verdictCapableHubs + d.thinHubs, 22);
  assert.equal(d.capableHubCodes.length, d.verdictCapableHubs);
  assert.equal(d.thinHubCodes.length, d.thinHubs);
  assert.equal(d.thanksgivingDepartures + d.christmasDepartures, d.totalHolidayDepartures);
  assert.ok(d.thanksgivingAtFloor <= d.thanksgivingDepartures && d.christmasAtFloor <= d.christmasDepartures);
  assert.match(d.periodStart, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(d.periodEnd, /^\d{4}-\d{2}-\d{2}$/);

  // Hub CSV lines: 1 header + 22 hubs + 1 summary row = 24 non-empty lines
  const hubLines = HOLIDAY_REPORT_CSV.trim().split('\n');
  assert.equal(hubLines.length, 24, `Expected 24 CSV rows (header + 22 hubs + summary), got ${hubLines.length}`);

  // Window counts CSV: 1 header + 22 hubs x 2 windows
  const depLines = HOLIDAY_DEPARTURES_CSV.trim().split('\n');
  assert.equal(depLines.length, 1 + 22 * 2);
  assert.deepEqual(depLines[0].split(','), ['hub_code', 'holiday_window', 'departures_observed', 'at_or_past_deal_floor']);
});

test('M5: the window CSV holds counts only: no fares, dates or routes (Hub Guard read 2026-10-24)', () => {
  const header = HOLIDAY_DEPARTURES_CSV.split('\n')[0].toLowerCase();
  for (const banned of ['price', 'usd', 'fare', 'destination', 'departure_date', 'return_date', 'median']) {
    assert.ok(!header.includes(banned), `window CSV header must not include "${banned}"`);
  }
  for (const line of HOLIDAY_DEPARTURES_CSV.trim().split('\n').slice(1)) {
    assert.match(line, /^[A-Z]{3},"[^"]+",\d+,\d+$/, `row is hub, window, two counts: ${line}`);
    const [, seen, floor] = line.match(/^[A-Z]{3},"[^"]+",(\d+),(\d+)$/);
    assert.ok(Number(floor) <= Number(seen));
  }
  const html = renderHolidayReport();
  assert.ok(!/\$\d{3,}/.test(html), 'the report page shows no individual fares');
  assert.ok(!html.includes('including mandatory taxes and fees'), 'no unverified tax claim');
  assert.ok(!html.includes('Active Deals Today'), 'hero metric is dated');
});

test('M5: static report files on disk match generated module', () => {
  const staticHtml = fs.readFileSync(path.join(ROOT, 'reports', 'holiday-2026.html'), 'utf8');
  const staticHubCsv = fs.readFileSync(path.join(ROOT, 'reports', 'holiday-2026.csv'), 'utf8');
  const staticDepCsv = fs.readFileSync(path.join(ROOT, 'reports', 'holiday-2026-departures.csv'), 'utf8');

  assert.equal(staticHubCsv.replace(/\r\n/g, '\n'), HOLIDAY_REPORT_CSV.replace(/\r\n/g, '\n'));
  assert.equal(staticDepCsv.replace(/\r\n/g, '\n'), HOLIDAY_DEPARTURES_CSV.replace(/\r\n/g, '\n'));
  assert.ok(staticHtml.includes('Holiday Fare Report 2026: international fares from 22 US airports'));
  assert.ok(staticHtml.includes('Sparkfare does not sell or book travel.'));
});
