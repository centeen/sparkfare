// K-B5 (ROADMAP step 129, scan T-1, T-2, T-3): the /time-off planner. The plan headline is the hero, a strip shows the windows on a timeline,
// each window is one line that opens on tap, destinations are ranked (a fare first, else window fit) and shown as three 4:3 postcards with
// credit lines, and the long holiday table is collapsed. Pure rendering, so it runs on the real functions and the stored photos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTimeOffOrigin, rankDestinations, PTO_ORIGINS } from '../src/ptoPages.js';
import { COMMON_HOLIDAY_SET, holidaysInRange, bridgeOpportunities, optimize, destinationsForWindow, DESTINATION_FIT } from '../src/ptoCalendar.js';
import { unsplashVariant, imgAttrs } from '../src/unsplashImg.js';
import { unsplashVariant as sharedVariant, imgAttrs as sharedAttrs } from '../scripts/apply-image-pipeline.mjs';

const NOW = new Date('2026-10-19T12:00:00Z');
const images = JSON.parse(fs.readFileSync(new URL('../sparkfare_images.json', import.meta.url), 'utf8'));
const render = (extra = {}) => renderTimeOffOrigin({ origin: 'SEA', now: NOW, appUrl: 'https://sparkfare.com', leaveReady: true, images, ...extra });
const body = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
const plan = () => {
  const holidays = holidaysInRange({ from: '2026-10-19', to: '2027-12-31', keys: COMMON_HOLIDAY_SET });
  return optimize({ budget: 10, blocks: bridgeOpportunities({ from: '2026-10-19', to: '2027-12-31', holidays }) });
};

test('hero: the plan headline in Space Grotesk 44 px with the PTO days in Plex Mono beneath, equal to the optimizer totals', () => {
  const html = render();
  const { totals } = plan();
  assert.ok(html.includes(`<p class="hero-num">${totals.daysOff} days off</p><p class="hero-sub">for ${totals.ptoUsed} PTO days</p>`));
  assert.match(html, /\.hero-num \{ font-family: var\(--font-display\); font-size: 44px;/);
  assert.match(html, /\.hero-sub \{ font-family: var\(--font-mono\);/);
  assert.equal((body(html).match(/<h1[\s>]/g) || []).length, 1);
});

test('an empty plan keeps the plain sentence instead of a hero', () => {
  const html = renderTimeOffOrigin({ origin: 'SEA', now: NOW, appUrl: 'https://sparkfare.com', keys: [], budget: 0 });
  assert.ok(html.includes('No long weekend fits 0 PTO days with this holiday set'));
  assert.ok(!html.includes('hero-num">'));
  assert.ok(!html.includes('<div class="strip"'));
});

test('windows: one collapsed line each (dates, holiday, days off, PTO), none open by default, postcards only inside', () => {
  const html = render();
  const { plan: blocks } = plan();
  const wins = body(html).match(/<details class="window block"[^>]*>/g) || [];
  assert.equal(wins.length, blocks.length);
  assert.ok(wins.every((w) => !/\sopen[\s>]/.test(w)), 'no window starts open');
  const summaries = [...body(html).matchAll(/<summary><span class="win-range">([^<]+)<\/span>(?:<span class="win-name">[^<]*<\/span>)?<span class="win-meta">(\d+) days off · ([^<]+)<\/span><\/summary>/g)];
  assert.equal(summaries.length, blocks.length);
  assert.match(summaries[0][1], /^[A-Z][a-z]{2} \d+ to [A-Z][a-z]{2} \d+$/);
  // every postcard list sits inside a window body, after its summary
  const outside = body(html).replace(/<details class="window block"[\s\S]*?<\/details>\s*(?=<details class="window block"|<div class="actions">)/g, '');
  assert.ok(!outside.includes('class="postcards"'));
});

test('the long holiday table is collapsed behind one summary', () => {
  const html = body(render());
  assert.match(html, /<details class="holidays">\s*<summary>Every holiday and its best bridges<\/summary>\s*<table>/);
});

test('ranking: a destination with a fare first (cheapest first), then by fit, then alphabetical; only destinations that fit', () => {
  const block = { start: '2026-11-21', end: '2026-11-29', daysOff: 9, ptoUsed: 3, holidayKeys: [] };
  const fits = destinationsForWindow(9, 'SEA');
  assert.ok(fits.length > 10);
  const two = fits.slice(5, 7);
  const store = { windows: { 'SEA:2026-11-21:2026-11-29': { fares: [
    { destination: two[0], price: 700 }, { destination: two[1], price: 500 }, { destination: 'Atlantis, Nowhere', price: 100 },
  ] } } };
  const ranked = rankDestinations(block, 'SEA', store);
  assert.deepEqual(ranked.slice(0, 2), [two[1], two[0]], 'cheapest fare first');
  assert.ok(!ranked.includes('Atlantis, Nowhere'), 'a destination that does not fit is never listed');
  assert.equal(new Set(ranked).size, ranked.length);
  assert.equal(ranked.length, fits.length);
  const rest = ranked.slice(2);
  for (let i = 1; i < rest.length; i++) {
    const [a, b] = [rest[i - 1], rest[i]];
    assert.ok(DESTINATION_FIT[a] > DESTINATION_FIT[b] || (DESTINATION_FIT[a] === DESTINATION_FIT[b] && a.localeCompare(b) <= 0), `${a} before ${b}`);
  }
  // no fares: the same ranking by fit alone
  assert.deepEqual(rankDestinations(block, 'SEA', null), [...fits].sort((x, y) => (DESTINATION_FIT[y] - DESTINATION_FIT[x]) || x.localeCompare(y)));
});

test('postcards: three per window as 4:3 images with sizes, lazy, a credit line under each, a link to the route page, and "See all N" for the rest', () => {
  const html = body(render());
  const lists = html.match(/<ul class="postcards">[\s\S]*?<\/ul>/g) || [];
  assert.ok(lists.length >= 6);
  for (const list of lists) {
    const cards = list.match(/<li>/g) || [];
    assert.equal(cards.length, 3);
    for (const li of list.match(/<li>[\s\S]*?<\/li>/g)) {
      assert.match(li, /<a class="postcard-link" href="\/data\/sea-to-[a-z0-9-]+">/);
      assert.match(li, /<img class="postcard-photo" src="[^"]+w=480[^"]*" srcset="[^"]+480w, [^"]+720w" sizes="[^"]+" width="480" height="360" alt="" loading="lazy" decoding="async">/);
      assert.match(li, /<p class="postcard-credit">Photo by <a href="https:\/\/unsplash\.com\/[^"]*" target="_blank" rel="noopener">[^<]+<\/a> on <a href="[^"]*unsplash\.com[^"]*" target="_blank" rel="noopener">Unsplash<\/a><\/p>/);
    }
  }
  assert.match(html, /<summary>See all \d+ that fit this window<\/summary>/);
});

test('no stored photo: the card keeps its name and link, with no broken image and no credit line', () => {
  const html = body(render({ images: {} }));
  assert.ok(html.includes('class="postcard-photo" aria-hidden="true"'));
  assert.ok(!html.includes('postcard-credit">'));
  assert.ok(!html.includes('<img class="postcard-photo"'));
});

test('strip: one mark per window inside the bar, described for assistive technology, months hidden from it', () => {
  const html = body(render());
  const { plan: blocks } = plan();
  const strip = html.match(/<div class="strip" role="img" aria-label="([^"]+)">([\s\S]*?)<\/div>/);
  assert.ok(strip);
  assert.match(strip[1], new RegExp(`^${blocks.length} windows between `));
  const marks = [...strip[2].matchAll(/<i style="left:([\d.]+)%;width:([\d.]+)%">/g)];
  assert.equal(marks.length, blocks.length);
  for (const [, left, width] of marks) assert.ok(Number(left) >= 0 && Number(left) + Number(width) <= 100.01);
  assert.match(html, /<div class="strip-months" aria-hidden="true">/);
});

test('J3 C8 to C10 still hold: the leave link follows the window length, and the watch button still carries its window', () => {
  const html = render({ watchEnabled: true });
  assert.match(html, /Before you go: get your home ready/);
  assert.match(html, /Leaving for longer\? <a href="\/leave\?src=pto">Make a checklist<\/a>/);
  assert.match(html, /class="secondary pto-watch-btn" data-start="2026-\d\d-\d\d" data-end="\d{4}-\d\d-\d\d" data-origin="SEA"/);
});

test('every origin still renders a plan, and an unknown photo map entry never throws', () => {
  for (const origin of PTO_ORIGINS) {
    const html = renderTimeOffOrigin({ origin, now: NOW, appUrl: 'https://sparkfare.com', images });
    assert.match(html, /class="hero-num"/, origin);
  }
  assert.doesNotThrow(() => render({ images: { 'Bali, Indonesia': {} } }));
});

test('the Worker copy of the Unsplash rewrite equals the shared script, for every stored photo and width', () => {
  const urls = Object.values(images).map((i) => i.image_url).filter(Boolean);
  assert.ok(urls.length >= 40);
  for (const u of urls) {
    for (const w of [480, 720, 960]) assert.equal(unsplashVariant(u, w), sharedVariant(u, w));
    assert.equal(imgAttrs(u, [480, 720], 'sizes'), sharedAttrs(u, [480, 720], 'sizes'));
  }
  assert.equal(unsplashVariant('https://example.com/a.jpg?w=1', 480), 'https://example.com/a.jpg?w=1');
});
