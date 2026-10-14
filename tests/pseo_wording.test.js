// 2026-10-14 (referral-copy scope, step 1): the /data generator, its copy cache and its output no longer say "worth booking"
// or "secure a favorable flight rate". The checker is unchanged on purpose; this pins only what step 1 fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const OLD = /worth booking|secure a favorable/i;

test('generator template and copy cache carry the new wording', () => {
  const gen = read('Phase 17 pSEO Generator (Step 106).py');
  assert.ok(!OLD.test(gen));
  assert.ok(gen.includes('is the best way to find a favorable flight rate.'));
  assert.ok(gen.includes('genuinely worth a look'));
  const cache = JSON.parse(read('sparkfare_seo_cache.json'));
  assert.ok(Object.keys(cache).length >= 40);
  for (const [k, v] of Object.entries(cache)) assert.ok(!OLD.test(v.copy), k);
});

test('every generated /data page is free of the old wording', () => {
  const dir = path.join(ROOT, 'data');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  assert.ok(files.length >= 880);
  const bad = files.filter((f) => OLD.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.deepEqual(bad, []);
});

test('the real-API prompt tells the model not to use the words', () => {
  assert.ok(read('Phase 17 pSEO Generator (Step 106).py').includes('Never use the words book, booking, secure or lock in.'));
});
