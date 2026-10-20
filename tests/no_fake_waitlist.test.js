// 2026-10-20: the account and watchlists pages had "Join the Premium Waitlist" buttons that showed "We've added you to the
// Premium waitlist" and recorded nothing, beside promises of unlimited origins, hourly checks and Early Bird SMS alerts, none of
// which exist. The only waitlist is the double opt-in one at /pricing. These checks keep a fake one from coming back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const pages = fs.readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));

test('no page tells a visitor they were added to a waitlist from a browser alert', () => {
  for (const f of pages) assert.doesNotMatch(read(f), /alert\([^)]*added you to the [^)]*waitlist/i, f);
});

test('no page promises hourly checks, SMS alerts or unlimited origins for a plan', () => {
  for (const f of pages) {
    const t = read(f);
    assert.doesNotMatch(t, /Hourly pricing checks|Early Bird\s*<strong>SMS|Premium Waitlist/i, f);
  }
});

test('the account page sends people to the real waitlist at /pricing, and says nothing is charged', () => {
  const a = read('account.html');
  assert.match(a, /href="\/pricing\?src=account"[^>]*>Join the Plus waitlist<\/a>/);
  assert.match(a, /not available yet and nothing is charged/);
});

test('the watchlist form has no check-frequency choice (it was never sent to the server)', () => {
  const w = read('watchlists.html');
  assert.doesNotMatch(w, /wl-frequency|Check frequency/);
  assert.match(w, /We check fares daily/);
});

test('the real waitlist route exists and is double opt-in', () => {
  const idx = read('src/index.js');
  assert.match(idx, /plus_waitlist_verified/);
  assert.match(read('wrangler.jsonc'), /"ENABLE_PLUS_WAITLIST":\s*"true"/);
});
