// S3-1 round 3, item 4 (Guard read 2026-11-01 ~18:30): "deal alerts" labels on signup blocks and the verification email say "fare alerts".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('/leave heading, route-page template button, archive button and verification email use "fare alerts"', () => {
  assert.ok(read('../leave.html').includes('<h2>Want flight fare alerts too?</h2>'));
  assert.ok(read('../src/index.js').includes('class="cta">Get fare alerts</a>'));
  assert.ok(read('../src/digestArchive.js').includes('cursor:pointer;">Get fare alerts</button>'));
  assert.ok(read('../src/email.js').includes('Verify your email to start receiving fare alerts.'));
});

test('the old labels are gone from those files (no "deal" left in a label or accessible name)', () => {
  assert.ok(!/Want flight deal alerts/.test(read('../leave.html')));
  assert.ok(!/Get Deal Alerts|Get deal alerts/.test(read('../src/index.js').replace(/\/\/.*$/gm, '')));
  assert.ok(!/Get deal alerts/.test(read('../src/digestArchive.js')));
  assert.ok(!/receiving deal alerts/.test(read('../src/email.js')));
});

test('privacy.html and sign-in.html are deliberately untouched (Guard: legal text; sign-in describes the account)', () => {
  assert.ok(read('../privacy.html').includes('deal alerts'));
  assert.ok(read('../sign-in.html').includes('manage your saved origin, deal alerts, and Away Mode preferences'));
});
