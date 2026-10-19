// The header's "Deals" link used to point at "/", so from the homepage it just reloaded the page. It now jumps to the deal board (#deals).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SITE_NAV_HTML } from '../src/siteHeader.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('Deals links to the board anchor, the brand link still goes to the top of the homepage', () => {
  assert.match(SITE_NAV_HTML, /<a href="\/#deals">Deals<\/a>/);
  assert.doesNotMatch(SITE_NAV_HTML, /<a href="\/">Deals<\/a>/);
  assert.match(SITE_NAV_HTML, /<a href="\/" class="brand-link">/);
});

test('the homepage has exactly one #deals anchor, on the sort bar that sits right above the board, with room above it', () => {
  const html = read('index.html');
  assert.equal((html.match(/id="deals"/g) || []).length, 1);
  const bar = html.indexOf('<section class="origin-bar sort-bar" id="deals"');
  const board = html.indexOf('<div id="board-sections">');
  assert.ok(bar > 0 && board > bar, 'the anchor is above the board');
  assert.ok(html.indexOf('<div id="hero-section">') < bar, 'the fare and signup stay above it');
  assert.match(html, /\.sort-bar \{[^}]*scroll-margin-top: 16px/);
});

test('every page and generator carries the same Deals link (the apply script is idempotent)', () => {
  for (const f of ['about.html', 'index.html', 'welcome.html', 'blog/how-we-rank-deals.html', 'data/jfk-to-prague-czechia.html']) {
    assert.match(read(f), /<a href="\/#deals">Deals<\/a>/, f);
  }
  assert.match(read('brand/header.html'), /<a href="\/#deals">Deals<\/a>/);
});

test('choosing a header link closes the phone menu', () => {
  const js = read('brand/header.js');
  assert.match(js, /menu\.addEventListener\('click'[\s\S]*?closest\('a'\)[\s\S]*?setOpen\(false\)/);
});
