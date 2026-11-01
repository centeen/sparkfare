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
  for (const s of ['fares crater when demand softens', 'prices plummet', 'April prices collapse', 'collapse regional pricing', 'Move decisively', "don't wait", 'at a fraction of peak-season costs', 'your window closes fast', 'rates reset']) {
    assert.ok(idxRe.test(s), 'index.html: ' + s);
    assert.ok(genRe.test(s), 'generator: ' + s);
  }
  for (const ok of ['Baku collapses centuries into a single skyline', 'World-class beaches, iconic peaks, and vibrant street culture.']) {
    assert.ok(!idxRe.test(ok) && !genRe.test(ok), ok);
  }
  assert.ok(read('../scripts/check-referral-copy.js').includes('crater|plummet|prices? collapse|softens?|move decisively|fraction of'));
});

test('water post: attribution, figures, title and the efficacy sentence', () => {
  const t = read('../blog/water-not-burglars.html');
  assert.ok(t.includes('<title>Water and an empty home: what to check before you go</title>'));
  assert.ok(!/what actually damages|The numbers point at water|8\.1%|more than any gadget|come from a poll run by PEMCO/.test(t));
  assert.ok(t.includes('down 8.6% from 2023') && t.includes('does not name a source for them') && t.includes('24% correctly named') && t.includes('57% rely on'));
  assert.ok(t.includes('Washington and Oregon'));
  const meta = t.match(/name="description" content="([^"]*)"/)[1];
  assert.equal(t.match(/og:description" content="([^"]*)"/)[1], meta);
  assert.ok(read('../blog/index.html').includes('>Water and an empty home: what to check before you go</a>'));
});

test('partner-selection post: no medical-coverage example, no hard count, no regulatory label, a disclosure line that matches the page', () => {
  const t = read('../blog/how-we-pick-away-mode-partners.html');
  assert.ok(!/medical coverage|Thirteen|FTC-style|actually trust|every partner link on every page|through the links below/i.test(t));
  assert.ok(t.includes('partner links on Away Mode, at no extra cost to you'));
  assert.ok(t.includes('On Away Mode and in our emails, every partner link appears after our disclosure, not before.'));
});

test('clusters page states the deployed rule and drops the unsourced pattern claims', () => {
  const t = read('../blog/destination-clusters-explained.html');
  assert.ok(t.includes('at least 15% below the route') && t.includes('at least two median absolute deviations below it'));
  assert.ok(t.includes('clears both the 15% floor and the two-deviation bar'));
  assert.ok(!/more than twice its usual|real cliff|real fare arbitrage|falls well below the route/.test(t));
});
