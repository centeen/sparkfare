// Step 4 of the 2026-10-14 wording scope: scripts/check-referral-copy.js now also bans the bare words "secure", "book*" and
// "lock in/down" in visible copy. URLs, slugs and CSS names are not copy; statements of what Sparkfare does not do are allowlisted;
// bare "book*" in src/*.js is a ratchet (a file may not use more than its pinned count).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText, stripUrlTokens, applyBaselines, loadAllowlist, scanRepo } from '../scripts/check-referral-copy.js';

const allow = loadAllowlist();
const ids = (html, file = 'x.html') => scanText(html, file, allow).map((f) => f.id);

test('bare secure, book and lock in/down are flagged in visible text', () => {
  assert.ok(ids('<p>Secure your trip today.</p>').includes('secure-word'));
  assert.ok(ids('<p>Before you book, check your cover.</p>').includes('book-word'));
  assert.ok(ids('<p>Lock in your dates.</p>').includes('lock-in-down'));
  assert.ok(ids('<p>We will lock down the details.</p>').includes('lock-in-down'));
  assert.ok(ids('<p>a trip that was booked</p>').includes('book-word'));
});

test('slugs, hrefs, CSS names and script comments are not copy', () => {
  assert.deepEqual(ids('<a href="/blog/why-book-through-us-first" class="book-link track-booking">Why a short page</a>'), []);
  assert.deepEqual(ids('<style>.book-link:hover { color: red; } .badge.booked { color: blue; }</style>'), []);
  assert.deepEqual(ids('<script>\n  // booking clicks, secure context\n  const a = 1;\n</script>'), []);
  assert.equal(stripUrlTokens('see https://example.com/book-now and /blog/secure-your-trip please').includes('book'), false);
});

test('allowlisted statements of what Sparkfare does not do still pass', () => {
  for (const s of [
    "Aviasales, which handles booking and payment.",
    "Sparkfare doesn't sell, book, ticket, arrange or take payment for travel.",
    'Aviasales handles booking and payment.',
    'the booking-link network our fare links route through',
    'We cannot book flights or manage cancellations.',
    'Links go to the booking site.',
  ]) assert.deepEqual(ids('<p>' + s + '</p>'), [], s);
});

test('the baseline ratchet lets a file stay at its count and fails it above', () => {
  const hit = (n) => Array.from({ length: n }, (_, i) => ({ file: 'src/a.js', id: 'book-word', line: i + 1, text: 't' }));
  assert.equal(applyBaselines(hit(2), { 'book-word': { 'src/a.js': 2 } }).length, 0);
  assert.equal(applyBaselines(hit(1), { 'book-word': { 'src/a.js': 2 } }).length, 0);
  const over = applyBaselines(hit(3), { 'book-word': { 'src/a.js': 2 } });
  assert.equal(over.length, 3);
  assert.match(over[0].text, /over baseline of 2/);
  assert.equal(applyBaselines(hit(1), {}).length, 1, 'a file with no baseline is strict');
});

test('the repo passes, and the rules are strict for every file that has no baseline', () => {
  assert.deepEqual(scanRepo().map((r) => `${r.file}:${r.line} ${r.id}`), []);
  const base = allow.baselines['book-word'] || {};
  assert.ok(Object.keys(base).every((f) => f.startsWith('src/') && f.endsWith('.js')), 'baselines are for src JS only');
  assert.equal(allow.baselines['secure-word'], undefined);
  assert.equal(allow.baselines['lock-in-down'], undefined);
});
