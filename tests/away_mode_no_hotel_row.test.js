// Addendum D item 4: /away-mode no longer shows a "Still need a hotel? Coming soon" prompt. No hotel partner is live or
// recorded as planned in the repo, so the page makes no hotel promise. The car-rental row stays and maps to QEEQ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../away-mode.html', import.meta.url), 'utf8');

test('/away-mode has no hotel row and no "Coming soon" pill', () => {
  assert.doesNotMatch(html, /Still need a hotel/i);
  assert.doesNotMatch(html, /data-key="hotel"/);
  assert.doesNotMatch(html, /class="coming-soon-pill"/);
});

test('the car-rental prompt is unchanged and still maps to QEEQ', () => {
  assert.match(html, /Renting a car at your destination\?/);
  assert.match(html, /'car_rental':\s*'qeeq'/);
});
