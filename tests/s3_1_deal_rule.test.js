// S3-1 follow-up (Guard read 2026-11-01 ~19:45, S3-20/S3-30/S3-31/S3-32): the method sentence on the posts and on /blog/how-we-rank-deals
// states the rule dealQuality() actually applies, and the urgency phrases the K-A3 filter missed are caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MIN_DEAL_PCT_BELOW } from '../src/dealQuality.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const gen = read('../Phase 20 Blog Generator.py');
const dq = read('../src/dealQuality.js');
const posts = fs.readdirSync(new URL('../blog/', import.meta.url)).filter((f) => f.endsWith('.html'));
const sentence = gen.match(/DEAL_RULE_SENTENCE = "([^"]*)"/)[1];

test('the sentence\'s numbers are the constants dealQuality() uses (15%, 2 x MAD, 10 distinct days, 14-day span)', () => {
  assert.ok(sentence.includes(`at least ${Math.round(MIN_DEAL_PCT_BELOW * 100)}% below its own 30-day median`));
  assert.ok(sentence.includes('at least two median absolute deviations below it') && /current_price <= baseline - 2 \* mad/.test(dq));
  assert.ok(sentence.includes(`at least ${dq.match(/MIN_HISTORY_POINTS = (\d+)/)[1]} distinct observation days`));
  assert.ok(sentence.includes(`across a ${dq.match(/MIN_HISTORY_SPAN_DAYS = (\d+)/)[1]}-day span`));
});

test('the 30 posts that badge deals carry the sentence once; the 10 featured posts keep their own wording; the old wording is gone', () => {
  let rule = 0, featured = 0;
  const filled = sentence.replace('{city}', '@@');
  for (const f of posts) {
    const t = read('../blog/' + f);
    assert.ok(!/day-to-day price swing|more than twice its usual/.test(t), f + ' old wording');
    if (/earns a deal badge only when/.test(t)) {
      rule += 1;
      const city = t.match(/Like every priced route, (.+?) earns a deal badge/)[1];
      assert.equal(t.split(sentence.replace('{city}', city)).length - 1, 1, f);
    } else if (t.includes('never badges it as a deal')) featured += 1;
  }
  assert.equal(rule, 30);
  assert.equal(featured, 10);
  assert.ok(filled.includes('@@'));
});

test('/blog/how-we-rank-deals states both conditions, the 0.85 floor, and no longer says the bar replaces a fixed percentage', () => {
  const t = read('../blog/how-we-rank-deals.html');
  assert.ok(t.includes('at least 15% below that exact route\'s own trailing 30-day median price and at least two median absolute deviations below it'));
  assert.ok(t.includes("AND today's fare ≤ 0.85 × median"));
  assert.ok(t.includes('On top of a fixed 15% floor, the bar is set from'));
  assert.ok(!/Instead of a fixed percentage|day-to-day price swing/.test(t));
});

test('urgency phrases: filter and checker catch them, and the posts no longer carry them', () => {
  const phrases = ['your window closes fast', 'worth a look before rates reset', 'collapsing prices', 'lock in this fare', 'before the correction'];
  const idx = read('../index.html').match(/const BARRED_COPY = (\/.*\/i);/)[1];
  const idxRe = new Function(`return ${idx}`)();
  const genRe = new RegExp(gen.match(/^BARRED_COPY = re\.compile\(r"(.*)", re\.I\)$/m)[1].replace(/\(\?:/g, '(?:'), 'i');
  for (const p of phrases) {
    assert.ok(idxRe.test(p), 'index.html filter: ' + p);
    assert.ok(genRe.test(p), 'generator filter: ' + p);
  }
  assert.ok(read('../scripts/check-referral-copy.js').includes("id: 'brand-urgency-2'"));
  for (const f of ['amalfi-coast-italy', 'sydney-australia']) {
    const t = read(`../blog/${f}.html`);
    assert.ok(!/closes fast|rates reset|window closes/.test(t), f);
  }
  assert.ok(!/shoulder-season window closes/.test(read('../blog/index.html')));
  assert.ok(read('../blog/amalfi-coast-italy.html').includes("Mediterranean cliffs meet culinary mastery on Europe's most dramatic coastline."));
});
