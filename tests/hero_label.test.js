// The homepage hero label must say what kind of pick it is. Before this, every non-deal pick read "Today's featured
// destination", including a route with only 3 days of history (MSP on 2026-10-13) whose price had not been judged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CRLF = String.fromCharCode(13, 10);
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').split(CRLF).join('\n');
const src = html.match(/function heroLabel\(pick\) \{[\s\S]*?\n\}\n/)[0];
const heroLabel = vm.runInNewContext(`(${src.replace(/^function heroLabel/, 'function')})`);

test('a deal is the only status called a deal, and keeps its basis text', () => {
  assert.equal(heroLabel({ status: 'deal', basis_text: '27% below the 30-day median (23 observations)' }),
    "Today's sharpest deal — 27% below the 30-day median (23 observations)");
  assert.equal(heroLabel({ status: 'deal' }), "Today's sharpest deal");
  for (const status of ['featured', 'priced_no_deal', 'insufficient_history', 'no_data', undefined]) {
    assert.doesNotMatch(heroLabel({ status, basis_text: 'x' }), /sharpest deal/i, String(status));
  }
});

test('each non-deal status says so, in the words the sections below use', () => {
  assert.equal(heroLabel({ status: 'featured' }), "Today's featured destination — chosen for the place, not the price");
  assert.equal(heroLabel({ status: 'priced_no_deal' }), "Today's featured destination — priced normally today, not a deal");
  assert.equal(heroLabel({ status: 'insufficient_history' }), "Today's featured destination — price history still building, so no deal verdict");
  assert.equal(heroLabel({ status: 'something_new' }), "Today's featured destination");
});

test('renderHero uses heroLabel, and the section wording it echoes is still on the page', () => {
  assert.match(html, /const label = heroLabel\(topPick\);/);
  assert.match(html, /Selected for the destination, not the discount\./);
  assert.match(html, /Priced normally today — no bargain, no markup\./);
  assert.match(html, /Not enough price history yet to call these a deal or not\./);
});

test('the unjudged label does not get the deal styling', () => {
  assert.match(html, /<section class="hero ticket ticket-\$\{fareChip\(topPick\)\.kind\}">/);
});
