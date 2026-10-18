// K-B10: the hex lint and the gold-only check (scripts/brand-lint.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { countHex, classifyGold, compare, scanRepo, loadBaseline, baselineKey } from '../scripts/brand-lint.mjs';

test('the repo is at or under its baseline: no new hex colour outside tokens.css, no gold outside the chip, mark and token', () => {
  assert.deepEqual(compare(scanRepo(), loadBaseline()), []);
});

test('hex lint counts colour literals, not anchors, entities or words', () => {
  assert.equal(countHex('a { color: #fff; background:#E8B930; border: 1px solid #12345678 }'), 3);
  assert.equal(countHex('<a href="#main">x</a> <a href="#signup-form">y</a> &#8594; #add-to-cart url(#grad)'), 0);
  assert.equal(countHex("const c = '#2F6B47'; fill=\"#E8B930\""), 2);
});

test('a file over its baseline fails, a file with no baseline may have none, and lowering is fine', () => {
  const base = { hex: { 'a.html': 2 }, sparklineDots: {} };
  assert.deepEqual(compare({ hex: { 'a.html': 2 }, sparklineDots: {}, goldOther: [], deferredGold: {} }, base), []);
  assert.deepEqual(compare({ hex: { 'a.html': 1 }, sparklineDots: {}, goldOther: [], deferredGold: {} }, base), []);
  assert.equal(compare({ hex: { 'a.html': 3 }, sparklineDots: {}, goldOther: [], deferredGold: {} }, base).length, 1);
  assert.equal(compare({ hex: { 'new.html': 1 }, sparklineDots: {}, goldOther: [], deferredGold: {} }, base).length, 1);
});

test('gold may paint the Deal chip, the mark dot and the token; a button or link in gold is rejected', () => {
  assert.equal(classifyGold('.chip-deal { background: var(--spark); color: var(--ink); }').chip, 1);
  assert.equal(classifyGold('<circle cx="18" cy="22" r="3.5" fill="#E8B930"/>').mark, 1);
  assert.equal(classifyGold('  --spark: #E8B930;').token, 1);
  assert.equal(classifyGold('<circle cx="5" cy="5" r="2" fill="#E8B930"/>').sparkline_dot, 1);
  const bad = classifyGold('.cta {\n  background: var(--spark);\n}');
  assert.equal(bad.other.length, 1);
  assert.equal(classifyGold('a:hover { color: #E8B930; }').other.length, 1);
});

test('generated page families share one baseline number', () => {
  assert.equal(baselineKey('data/jfk-to-prague-czechia.html'), 'data/*.html');
  assert.equal(baselineKey('blog/how-we-rank-deals.html'), 'blog/*.html');
  assert.equal(baselineKey('index.html'), 'index.html');
});

test('the baseline file only holds positive whole numbers', () => {
  const b = loadBaseline();
  for (const group of ['hex', 'sparklineDots', 'deferredGold']) for (const [k, n] of Object.entries(b[group] || {})) assert.ok(Number.isInteger(n) && n > 0, `${group}.${k}`);
  assert.ok(fs.existsSync(new URL('../brand/tokens.css', import.meta.url)));
});
