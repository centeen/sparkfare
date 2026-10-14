// 2026-10-14 (Addendum B s7): three live strings used the words the council's referral-copy rule is aimed at ("book", "secure").
// scripts/check-referral-copy.js did not catch them because its patterns are specific phrases (it bans "secured", not "secure").
// This pins the three corrected strings. It does not widen the checker: the same wording ("worth booking", "secure travel
// insurance", "Before you book") still appears in the generated destination guides and /data pages, which is a separate decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('homepage signup description no longer says "worth booking"', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="signup-desc"'));
  const line = html.split('\n').find((l) => l.includes('id="signup-desc"'));
  assert.ok(!/worth booking/i.test(line), line);
  assert.ok(/genuinely worth a look/.test(line));
});

test('/away-mode meta and og descriptions no longer say "Secure essential travel services"', () => {
  const html = read('away-mode.html');
  assert.ok(!/Secure essential travel services/i.test(html));
  const hits = html.match(/See what to sort out before you depart\./g) || [];
  assert.equal(hits.length, 2, 'meta description and og:description');
});

test('the disclosure sentence does not say "When you book a flight"', () => {
  const html = read('disclosure.html');
  assert.ok(!/When you book a flight/i.test(html));
  assert.ok(html.includes('When you follow a link on this site or in our emails and buy a flight or a service, we may earn a commission'));
});
