// Guard read 2026-11-01 ~20:30, PR A: hooks and filter, water post, partner-selection post, clusters page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const idxRe = new Function(`return ${read('../index.html').match(/const BARRED_COPY = (\/.*\/i);/)[1]}`)();
const genRe = new RegExp(read('../Phase 20 Blog Generator.py').match(/^BARRED_COPY = re\.compile\(r"(.*)", re\.I\)$/m)[1], 'i');

test('hooks: Rio keeps only its descriptive sentence; the prediction, comparison and instruction are gone everywhere', () => {
  const post = read('../blog/rio-de-janeiro-brazil.html');
  assert.ok(post.includes('<p>World-class beaches, iconic peaks, and vibrant street culture. Like every priced route'));
  assert.ok(!/crater|fraction of|Move decisively|softens/i.test(post));
  assert.ok(!/crater|fraction of/i.test(read('../blog/index.html')));
  for (const p of ['larnaca-cyprus', 'bogota-colombia']) assert.ok(!/prices collapse|collapse regional|collapse regional pricing/i.test(read(`../blog/${p}.html`)), p);
});

test('the filter (generator and homepage, in step) and the checker catch the prediction and urgency family', () => {
  for (const s of ['fares crater when demand softens', 'prices plummet', 'April prices collapse', 'collapse regional pricing', 'Move decisively', "don't wait", 'at a fraction of peak-season costs', 'fraction-of-season pricing', 'your window closes fast', 'rates reset']) {
    assert.ok(idxRe.test(s), 'index.html: ' + s);
    assert.ok(genRe.test(s), 'generator: ' + s);
  }
  for (const ok of ['Baku collapses centuries into a single skyline', 'World-class beaches, iconic peaks, and vibrant street culture.']) {
    assert.ok(!idxRe.test(ok) && !genRe.test(ok), ok);
  }
  assert.ok(read('../scripts/check-referral-copy.js').includes('crater|plummet|prices? collapse|softens?|move decisively|don.t wait|fraction[- ]of|pricing windows?'));
  for (const s of ['Rare pricing windows make this journey', 'surprisingly accessible']) {
    assert.ok(idxRe.test(s) && genRe.test(s), s);
  }
});

test('water post: attribution, figures, title and the efficacy sentence', () => {
  const t = read('../blog/water-not-burglars.html');
  assert.ok(t.includes('<title>Water and an empty home: what to check before you go</title>'));
  assert.ok(!/what actually damages|The numbers point at water|8\.1%|more than any gadget|come from a poll run by PEMCO/.test(t));
  assert.ok(t.includes('down 8.6% from 2023') && t.includes('does not name a source for them') && t.includes('24% correctly named') && t.includes('57% rely on'));
  assert.ok(t.includes('PEMCO surveys of Pacific Northwest residents') && t.includes('as reported by CBS News') && t.includes('cbsnews.com/news/fbi-crime-report-2025'));
  assert.ok(!/one insurer's view and a trade article's report|PEMCO poll/.test(t));
  const meta = t.match(/name="description" content="([^"]*)"/)[1];
  assert.equal(t.match(/og:description" content="([^"]*)"/)[1], meta);
  assert.ok(read('../blog/index.html').includes('>Water and an empty home: what to check before you go</a>'));
});

test('partner-selection post: no medical-coverage example, no hard count, no regulatory label, a disclosure line that matches the page', () => {
  const t = read('../blog/how-we-pick-away-mode-partners.html');
  assert.ok(!/medical coverage|Thirteen|FTC-style|actually trust|every partner link on every page|through the links below/i.test(t));
  assert.ok(t.includes('partner links on Away Mode, at no extra cost to you'));
  assert.ok(t.includes('On Away Mode, every partner link appears after our disclosure, not before.') && t.includes('<h2>Disclosure comes first</h2>'));
  assert.ok(!/in our emails, every partner link|earlier version of our daily email/.test(t));
});

test('clusters page states the deployed rule and drops the unsourced pattern claims', () => {
  const t = read('../blog/destination-clusters-explained.html');
  assert.ok(t.includes('at least 15% below the route') && t.includes('at least two median absolute deviations below it'));
  assert.ok(t.includes('clears both the 15% floor and the two-deviation bar'));
  assert.ok(!/more than twice its usual|real cliff|real fare arbitrage|falls well below the route/.test(t));
});

test('Sydney: the price/scarcity sentence is gone from the post and its index card; the clusters heading no longer claims a pattern', () => {
  assert.ok(!/Rare pricing windows|surprisingly accessible|rare window/i.test(read('../blog/sydney-australia.html') + read('../blog/index.html')));
  assert.ok(read('../blog/sydney-australia.html').includes("Sydney's opera-house skyline meets world-class beaches and culinary innovation. Like every priced route"));
  const c = read('../blog/destination-clusters-explained.html');
  assert.ok(c.includes('<h2>Shoulder-season routes</h2>') && !/big shoulder-season drop/.test(c));
});
