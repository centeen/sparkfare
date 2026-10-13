// /trips (My Trips): on a phone the badge, the checkbox and the Share button sat in an inline-styled flex row inside a
// two-column grid, so they ran past the card edge (reported 2026-10-13). The checkbox was labelled just "Open", with no
// hint of what it does. It sets trips.is_open, which makes the shared trip card show a "Join this trip" button and lets
// /api/trips/:id/public return the destination, so it is now worded for what it does and explained once on the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../trips.html', import.meta.url), 'utf8').split('\r\n').join('\n');

test('the controls use a wrapping class, not an inline-styled flex row', () => {
  assert.match(html, /\.trip-actions \{[^}]*flex-wrap: wrap;/);
  assert.match(html, /<div class="trip-actions">/);
  assert.doesNotMatch(html, /<div style="display:flex; gap:10px; align-items:center;">/);
});

test('on phones the row is one column and the controls have a 44px tap height', () => {
  const m = html.match(/@media \(max-width: 600px\) \{([\s\S]*?)\n    \}/);
  assert.ok(m, 'expected a max-width: 600px block');
  assert.match(m[1], /\.trip-row \{ grid-template-columns: 1fr;/);
  assert.match(m[1], /\.trip-open \{ min-height: 44px;/);
  assert.match(m[1], /\.btn-share \{ min-height: 44px;/);
});

test('the checkbox says what it does and the page explains it once', () => {
  assert.match(html, /> Let friends join\n/);
  assert.doesNotMatch(html, /\)}> Open\n/);
  assert.match(html, /class="share-help"[^>]*>Share copies a link to your trip card\. Tick "Let friends join" first/);
});

test('the wording keeps clear of the banned referral phrases', () => {
  const help = html.match(/class="share-help"[^>]*>([^<]*)</)[1];
  assert.doesNotMatch(help, /\bbook\w*|secur\w+|locked in|reserv\w+/i);
});
