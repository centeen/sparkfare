// tests/m4_pto_2027.test.js
// Package M4 (Addendum M, ROADMAP step 143): 2027 PTO page, press-ready.
// 1. Print stylesheet for /time-off/<origin> (clean 1- to 2-page calendar sheet; .ics covers all 2027 windows).
// 2. National "2027 long weekends" bridge table (id="2027-long-weekends"), method note citing OPM federal rules & observed days, "As of {month} {year}".
// 3. 1200x630 social image per airport: Brand v1 tokens, computed headline, no fare ($), no traveler data.
// 4. Embed snippet: iframe of national calendar (/time-off/embed), credit link back to /time-off, no tracking cookies or third-party scripts.
// 5. Privacy policy disclosure in privacy.html.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import satori from 'satori';
import worker, { ptoOgHtml } from '../src/index.js';
import { renderTimeOffIndex, renderTimeOffEmbed, renderTimeOffOrigin } from '../src/ptoPages.js';
import { countHex } from '../scripts/brand-lint.mjs';
import { scanText, loadAllowlist } from '../scripts/check-referral-copy.js';

const ctx = { waitUntil: () => {} };
const ON = { ENABLE_PTO_CALENDAR: 'true', APP_URL: 'https://sparkfare.com' };
const get = (urlPath, env = ON, init = {}) => worker.fetch(new Request(`https://sparkfare.com${urlPath}`, { redirect: 'manual', ...init }), env, ctx);

test('1. Print stylesheet: @media print rules clean the page for printing', async () => {
  const ptoPagesSrc = fs.readFileSync('src/ptoPages.js', 'utf8');
  assert.ok(ptoPagesSrc.includes('@media print'), 'contains @media print block');
  assert.ok(ptoPagesSrc.includes('@page { size: auto; margin: 12mm 15mm; }'), 'defines @page margins');
  assert.ok(ptoPagesSrc.includes('.site-nav') && ptoPagesSrc.includes('display: none !important'), 'hides navigation');
  assert.ok(ptoPagesSrc.includes('button') && ptoPagesSrc.includes('display: none !important'), 'hides interactive buttons');
  assert.ok(ptoPagesSrc.includes('.postcards') && ptoPagesSrc.includes('display: none !important'), 'hides postcards');
  assert.ok(ptoPagesSrc.includes('break-inside: avoid'), 'avoids breaking inside blocks/cards');
  assert.ok(ptoPagesSrc.includes('.print-only { display: none; }'), 'print-only header is hidden on screen');

  const originRes = await get('/time-off/den');
  assert.equal(originRes.status, 200);
  const originHtml = await originRes.text();
  assert.ok(originHtml.includes('class="print-only"'), 'origin page includes print-only header');
  assert.ok(originHtml.includes('Sparkfare · Long weekends from Denver (2026-2027) · sparkfare.com/time-off/den'));
});

test('2. National 2027 long weekends section: id="2027-long-weekends", bridge table, method note, as-of date', async () => {
  const res = await get('/time-off');
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.ok(html.includes('id="2027-long-weekends"'), 'contains 2027-long-weekends section');
  assert.ok(html.includes('2027 long weekends</h2>'), 'contains 2027 heading');
  assert.ok(html.includes('2027 Options &amp; Bridges'), 'contains 2027 table header');

  // Verify federal holidays appear in the 2027 table
  assert.ok(html.includes("New Year&#39;s Day") || html.includes("New Year's Day"));
  assert.ok(html.includes('Memorial Day'));
  assert.ok(html.includes('Independence Day'));
  assert.ok(html.includes('Labor Day'));
  assert.ok(html.includes('Thanksgiving'));
  assert.ok(html.includes('Christmas'));

  // Method note citing official OPM federal calendar rules & observed days
  assert.ok(html.includes('OPM federal calendar rules'), 'cites OPM federal calendar rules');
  assert.ok(html.includes('Many employers do not give every federal holiday'), 'notes employer variations');

  // "As of {month} {year}" timestamp
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const expectedAsOf = `As of ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  assert.ok(html.includes(expectedAsOf), `contains as-of timestamp: ${expectedAsOf}`);
});

test('3. 1200x630 social image: Brand v1 tokens, computed headline, no fare ($), no traveler data', async () => {
  const cardData = { city: 'Denver', ptoUsed: 10, daysOff: 42 };
  const vdom = ptoOgHtml(cardData);

  // Verify satori can render it without errors using existing Inter font
  const interFont = fs.readFileSync(new URL('../src/assets/Inter-Medium.ttf', import.meta.url));
  const svg = await satori(vdom, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: interFont, weight: 500, style: 'normal' }],
  });
  assert.ok(svg.startsWith('<svg'), 'satori renders valid SVG');
  assert.ok(svg.includes('1200') && svg.includes('630'), 'renders at 1200x630 dimensions');

  // Verify Brand v1 tokens are present in the output
  assert.ok(svg.includes('#F5EFE3') || svg.includes('rgb(245, 239, 227)'), 'uses Brand v1 paper (#F5EFE3)');
  assert.ok(svg.includes('#231C14') || svg.includes('rgb(35, 28, 20)'), 'uses Brand v1 ink (#231C14)');
  assert.ok(svg.includes('#5A4C3C') || svg.includes('rgb(90, 76, 60)'), 'uses Brand v1 ink-2 (#5A4C3C)');
  assert.ok(svg.includes('#2F6B47') || svg.includes('rgb(47, 107, 71)'), 'uses Brand v1 sage (#2F6B47)');
  assert.ok(svg.includes('#DCCFB8') || svg.includes('rgb(220, 207, 184)'), 'uses Brand v1 border/line (#DCCFB8)');

  // Verify headline and absence of fare ($) or traveler data in the template vdom
  const vdomJson = JSON.stringify(vdom);
  assert.ok(vdomJson.includes('10 PTO days'), 'displays computed PTO days');
  assert.ok(vdomJson.includes('42 days off'), 'displays computed days off');
  assert.ok(vdomJson.includes('Denver'), 'displays origin city');
  assert.ok(!vdomJson.includes('$'), 'contains no fare ($)');

  // Verify page meta tags for og:image dimensions
  const originRes = await get('/time-off/den');
  const originHtml = await originRes.text();
  assert.ok(originHtml.includes('<meta property="og:image:width" content="1200" />'), 'has og:image:width 1200');
  assert.ok(originHtml.includes('<meta property="og:image:height" content="630" />'), 'has og:image:height 630');
});

test('4. Embed snippet and /time-off/embed endpoint', async () => {
  // Index page contains embed snippet with copy action
  const indexRes = await get('/time-off');
  const indexHtml = await indexRes.text();
  assert.ok(indexHtml.includes('id="embed-section"'), 'contains embed-section');
  assert.ok(indexHtml.includes('id="embed-code"'), 'contains textarea for embed code');
  assert.ok(indexHtml.includes('id="copy-embed-btn"'), 'contains copy button');
  assert.ok(indexHtml.includes('&lt;iframe src="https://sparkfare.com/time-off/embed"'), 'snippet iframe points to /time-off/embed');

  // GET /time-off/embed serves calendar iframe
  const embedRes = await get('/time-off/embed');
  assert.equal(embedRes.status, 200);
  assert.equal(embedRes.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(embedRes.headers.get('Cache-Control'), 'public, max-age=3600');

  const embedHtml = await embedRes.text();
  assert.ok(embedHtml.includes('<title>2027 Long Weekends Calendar | Sparkfare</title>'));
  assert.ok(embedHtml.includes('2027 Long Weekends &amp; Bridges'));
  assert.ok(embedHtml.includes('Memorial Day'));
  assert.ok(embedHtml.includes('Thanksgiving'));
  assert.ok(embedHtml.includes('OPM'));
  assert.ok(embedHtml.includes('href="https://sparkfare.com/time-off"'));
  assert.ok(embedHtml.includes('target="_blank" rel="noopener"'));

  // No tracking cookies, third-party analytics, or scripts in embed
  assert.ok(!embedRes.headers.has('Set-Cookie'), 'sets no cookies');
  assert.ok(!embedHtml.includes('<script'), 'no script tags on embed page');
  assert.ok(!embedHtml.includes('google-analytics') && !embedHtml.includes('cloudflareinsights'), 'no analytics scripts');

  // Flag off: /time-off/embed returns 404
  const disabledRes = await get('/time-off/embed', { ENABLE_PTO_CALENDAR: 'false' });
  assert.equal(disabledRes.status, 404);
});

test('5. Privacy policy disclosure for /time-off/embed', () => {
  const privacyHtml = fs.readFileSync('privacy.html', 'utf8');
  assert.ok(privacyHtml.includes('/time-off/embed'), 'mentions /time-off/embed in privacy policy');
  assert.ok(
    privacyHtml.includes('without tracking cookies, third-party analytics, or personal data collection'),
    'discloses no tracking or personal data collection for embeds'
  );
});

test('6. Brand lint and copy rules compliance', () => {
  // Zero hex literals in src/ptoPages.js
  const ptoPagesText = fs.readFileSync('src/ptoPages.js', 'utf8');
  assert.equal(countHex(ptoPagesText), 0, 'src/ptoPages.js has 0 hex literals');

  // Privacy.html has 0 hex literals
  const privacyText = fs.readFileSync('privacy.html', 'utf8');
  assert.equal(countHex(privacyText), 0, 'privacy.html has 0 hex literals');

  // Index.js hex count does not exceed baseline (49)
  const indexText = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(countHex(indexText) <= 49, `src/index.js hex count (${countHex(indexText)}) <= 49`);

  // Copy checks for rendered pages
  const allow = loadAllowlist();
  const indexRendered = renderTimeOffIndex({ appUrl: 'https://sparkfare.com', now: new Date() });
  const embedRendered = renderTimeOffEmbed({ appUrl: 'https://sparkfare.com', now: new Date() });
  const originRendered = renderTimeOffOrigin({
    origin: 'DEN',
    budget: 10,
    keys: undefined,
    now: new Date(),
    appUrl: 'https://sparkfare.com',
    leaveReady: true,
  });

  for (const [name, text] of [['index', indexRendered], ['embed', embedRendered], ['origin', originRendered]]) {
    const hits = scanText(text, `${name}.html`, allow);
    assert.deepEqual(hits, [], `no banned referral copy in ${name} page`);
  }
});

test('7. .ics calendar download covers 2027 windows', async () => {
  const res = await get('/time-off/den.ics');
  assert.equal(res.status, 200);
  const ics = await res.text();
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:2027'), 'ics includes 2027 start dates');
  assert.ok(ics.includes('DTEND;VALUE=DATE:2027'), 'ics includes 2027 end dates');
  assert.ok(!ics.includes('$'), 'ics contains no fares');
});
