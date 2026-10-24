// Hub Guard read of M5 and M6 (2026-10-24): the copy conditions and the IndexNow allowlist, as tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isIndexablePath,
  urlForChangedFile,
  indexableUrlsFromFiles,
} from '../src/indexNow.js';
import { TIME_OFF_FAQS } from '../src/ptoPages.js';

const read = (f) => fs.readFileSync(f, 'utf8');

test('how-it-works: the deal rule matches the code (two MAD below the median)', () => {
  const html = read('how-it-works.html');
  assert.ok(!html.includes('exceed two median absolute deviations'));
  assert.ok(html.includes('at least two median absolute deviations below it'));
});

test('how-it-works: freshness says the clock is Sparkfare\'s fetch, not when the quote was observed', () => {
  const html = read('how-it-works.html');
  assert.ok(!html.includes('observed the quote'));
  assert.ok(html.includes("counted from when Sparkfare's scheduled fetch retrieved the price"));
});

test('how-it-works: fare links go to a third-party booking site, with the commission mention, and no airline or "unbiased" claims', () => {
  const html = read('how-it-works.html');
  assert.ok(!html.includes('directly to our booking partners or airlines'));
  assert.ok(!html.includes('trusted booking partners and airlines'));
  assert.ok(!/unbiased/i.test(html));
  assert.ok(!html.includes('every single day'));
  assert.ok(!html.includes('economy'));
  assert.ok(!html.includes('We do not track your browsing'));
  assert.ok(html.includes('Sparkfare may earn a commission if you buy there.'));
});

test('/check FAQ: no absolute privacy claim, Typical defined as the code does, MAD named', () => {
  const html = read('check.html');
  assert.ok(!html.includes('without cookies or personal tracking'));
  assert.ok(!html.includes('across all searches'));
  assert.ok(!html.includes('expected historical fluctuations'));
  assert.ok(html.includes('Typical means the price is neither a Deal nor High.'));
  assert.ok(html.includes('The price you type is not saved to an account or sold'));
});

test('/time-off FAQ: names the seven default holidays, no unsourced statistic, no fares claimed', () => {
  const a = TIME_OFF_FAQS.map((f) => f.a).join(' ');
  for (const name of ["New Year's Day", 'Memorial Day', 'Independence Day', 'Labor Day', 'Thanksgiving', 'the day after Thanksgiving', 'Christmas']) {
    assert.ok(a.includes(name), `names ${name}`);
  }
  assert.ok(!a.includes('most commonly granted'));
  assert.ok(!a.includes('any federal holiday'));
  assert.ok(!a.includes('economy'));
  assert.ok(a.includes('not prices'), 'says the planner shows dates, not prices');
  assert.ok(a.includes('the day after Thanksgiving is not a federal holiday'));
});

test('llms.txt: no dark report URL, no "US airfares" framing', () => {
  const llms = read('llms.txt');
  assert.ok(!llms.includes('/reports/'));
  assert.ok(llms.includes('international round-trip fares from 22 US airports'));
});

test('IndexNow allowlist: public content pages only', () => {
  for (const ok of ['/', '/how-it-works', '/check', '/time-off', '/away-mode', '/blog/', '/blog/how-we-rank-deals', '/data/', '/data/jfk-to-lisbon-portugal']) {
    assert.equal(isIndexablePath(ok), true, ok);
  }
  for (const no of [
    '/account', '/trips', '/watchlists', '/sign-in', '/welcome', '/hub', '/reward-terms', '/home-card', '/card/abc', '/plan', '/passport',
    '/admin/growth', '/admin/rules', '/departing/abc', '/share/abc', '/deal/JFK/LIS/2026-12-01', '/og/check/JFK/LIS.png', '/api/health',
    '/reports/holiday-2026', '/time-off?budget=10', '/check#price', '/data/../account', '/', '', 'account', null, undefined,
  ].filter((p) => p !== '/')) {
    assert.equal(isIndexablePath(no), false, String(no));
  }
});

test('IndexNow: changed files map to canonical URLs; everything else is dropped', () => {
  assert.equal(urlForChangedFile('how-it-works.html'), 'https://sparkfare.com/how-it-works');
  assert.equal(urlForChangedFile('blog/index.html'), 'https://sparkfare.com/blog/');
  assert.equal(urlForChangedFile('data/index.html'), 'https://sparkfare.com/data/');
  assert.equal(urlForChangedFile('data\\jfk-to-lisbon-portugal.html'), 'https://sparkfare.com/data/jfk-to-lisbon-portugal');
  for (const f of ['account.html', 'trips.html', 'home-card.html', 'welcome.html', 'plan.html', 'src/index.js', 'sparkfare_ranked_deals.json', 'reports/holiday-2026.html', 'scratch/x.html', '']) {
    assert.equal(urlForChangedFile(f), null, f);
  }
  assert.deepEqual(
    indexableUrlsFromFiles(['check.html', 'check.html', 'account.html', 'blog/a.html']),
    ['https://sparkfare.com/blog/a', 'https://sparkfare.com/check'],
  );
});

test('IndexNow: the workflow only watches public content paths and is wired to the script', () => {
  const wf = read('.github/workflows/indexnow-ping.yml');
  assert.ok(wf.includes('scripts/indexnow-ping.mjs'));
  for (const p of ['account.html', 'trips.html', 'home-card', 'welcome.html', 'admin']) {
    assert.ok(!wf.includes(p), `workflow does not watch ${p}`);
  }
  assert.ok(wf.includes('dry_run'), 'manual runs default to a dry run');
});

// ---- Second Guard read of PR 364 (2026-10-24) -------------------------------------------------------------
import { renderHolidayReport, HOLIDAY_REPORT_CSV } from '../src/holidayReport.js';

test('/how-it-works Q3 is scoped to the website and mentions the 72-hour email window', () => {
  const html = read('how-it-works.html');
  assert.equal(html.split("On the website, fares are judged against a 48-hour freshness window").length - 1, 2, 'visible text and JSON-LD');
  assert.ok(html.includes('Daily emails use a 72-hour window.'));
  assert.ok(!html.includes('verified when you open the booking site'));
});

test('/time-off: the Q3 question fits its answer', () => {
  const q = TIME_OFF_FAQS.map((f) => f.q);
  assert.ok(q.includes('Does the planner show flight prices?'));
  assert.ok(!q.includes('Can flight prices change for these holiday windows?'));
});

test('llms.txt: /check line does not claim a comparison for all 880 routes', () => {
  const llms = read('llms.txt');
  assert.ok(!llms.includes('each of 880 routes'));
  assert.ok(llms.includes('that have enough history'));
});

test('report: no Travelpayouts mark, a neutral disclaimer heading, a dated hub CSV and the licence line', () => {
  const html = renderHolidayReport();
  assert.ok(!/travelpayouts/i.test(html));
  assert.ok(!html.includes('Strict Consumer Protections'));
  assert.ok(html.includes('What this report does not do:'));
  assert.ok(HOLIDAY_REPORT_CSV.split('\n')[0].endsWith(',as_of_utc'));
  const rows = HOLIDAY_REPORT_CSV.trim().split('\n').slice(1);
  assert.ok(rows.every((r) => /,\d{4}-\d{2}-\d{2}T[\d:.]+(\+00:00|Z)?$/.test(r) || /,\d{4}-\d{2}-\d{2}T/.test(r)), 'every row carries the as-of time');
  assert.equal(html.split('Reuse under <a').length - 1, 2, 'licence line beside both download groups');
  assert.ok(html.includes('creativecommons.org/licenses/by/4.0/'));
});
