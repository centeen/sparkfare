// 2026-10-30: the homepage share button promised "early access (07:00 deals)". The early 07:00 send was retired on 2026-10-20 (PR #345),
// and Sparkfare no longer sells speed, so that claim was false. The button now just says what it does. The referral reward that is real
// (10 watchlists with three confirmed friends) is stated on the confirmation page and the hub, not on this button.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

test('the homepage share button does not promise the retired early send', () => {
  assert.ok(!/get early access/i.test(html), 'index.html still tells visitors they get early access');
  assert.ok(!/07:00 deals?/i.test(html), 'index.html still mentions a 07:00 send');
});

test('the share button reads plainly, both in the markup and where the script sets it', () => {
  assert.match(html, /<button type="button" id="referral-copy">Share Sparkfare<\/button>/);
  assert.match(html, /referralCopyButton\.textContent = 'Share Sparkfare';/);
});
