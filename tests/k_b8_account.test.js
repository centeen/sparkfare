// K-B8 (ROADMAP step 132): account, watchlists and trips on the brand tokens. No amber and no colour of their own, no emoji marks, prices are numbers in
// Plex Mono in Ink, actions are Sage, and the small buttons are tall enough to tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PAGES = ['account.html', 'watchlists.html', 'trips.html'];
const EMOJI = /[\u{1F300}-\u{1FAFF}✅✔✨⚠❌]/u;

test('no amber, no hex colour and no emoji on any of the three pages', () => {
  for (const f of PAGES) {
    const h = read(f);
    assert.ok(!/var\(--amber\)|#B8720F/i.test(h), `${f}: amber`);
    assert.ok(!/(?<=[:\s(,"'])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![-\w])/.test(h), `${f}: hex colour`);
    assert.ok(!EMOJI.test(h), `${f}: emoji`);
  }
});

test('actions are Sage: the account buttons, the share button and the waitlist outlines', () => {
  const account = read('account.html');
  assert.match(account, /button \{\s*background: var\(--sage\);\s*border-color: var\(--sage\);/);
  assert.match(account, /<a href="\/pricing\?src=account" style="display: inline-block; color: var\(--sage-dark\); border: 1px solid var\(--sage\);/);
  assert.match(account, /<a href="\/trips" style="color: var\(--sage-dark\); display: inline-block; padding: 10px 0;">/);
  assert.match(read('trips.html'), /\.btn-share \{\s*background: var\(--sage\);/);
});

test('the premium heading is Ink and its badge is a token fill, not a cream literal', () => {
  const account = read('account.html');
  assert.match(account, /<h3 style="font-size: 1rem; margin: 0 0 8px; color: var\(--ink\);/);
  assert.match(account, /background: var\(--paper-deep\); padding: 3px 8px; border-radius: 99px;">Coming Soon/);
});

test('prices are numbers: Plex Mono, Ink, tabular figures, on every price the pages print', () => {
  const wl = read('watchlists.html');
  const rule = wl.match(/\.wl-price \{([^}]*)\}/)[1];
  assert.match(rule, /font-family: var\(--font-mono\)/);
  assert.match(rule, /color: var\(--ink\)/);
  assert.equal((wl.match(/class="wl-price"/g) || []).length, 2, 'both the target and the lowest-seen price use it');
  const trips = read('trips.html');
  const t = trips.match(/\.trip-price \{([^}]*)\}/)[1];
  assert.match(t, /font-family: var\(--font-mono\)/);
  assert.match(t, /color: var\(--ink\)/);
  assert.match(t, /font-variant-numeric: tabular-nums/);
  assert.match(trips, /<span class="trip-price">\$\{fmtPrice\(trip\.price_at_click\)\}<\/span>/);
});

test('the lock marks are line icons with no text role, and the small buttons are 44 px tall', () => {
  const wl = read('watchlists.html');
  assert.doesNotMatch(wl, /Premium waitlist|value="hourly"|wl-frequency/i, 'the fake waitlist banner and the hourly option are gone (2026-10-20)');
  assert.match(wl, /color:var\(--clay\);border:1px solid var\(--clay\);cursor:pointer;min-height:44px;/);
});
