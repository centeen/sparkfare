// 2026-10-14 (referral-copy scope, step 2): the 40 generated destination guides and their source copy no longer use
// 'worth booking', 'secure', 'lock in/down' or 'Before you book'. Hand-written posts are step 3 and are not covered here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const OLD = /worth booking|\bsecure[sd]?\b|lock(?:ed)?[ -](?:in|down)|before you book|smart travelers book|\bbook smarter/i;

test('destination copy in sparkfare_destinations.json has no book/secure/lock-in wording in the three copy fields', () => {
  const d = JSON.parse(read('sparkfare_destinations.json'));
  const bad = [];
  for (const [name, v] of Object.entries(d)) {
    for (const f of ['the_hook', 'away_mode_transition']) if (OLD.test(v.copywriting[f])) bad.push(name + ':' + f);
  }
  assert.deepEqual(bad, []);
});

test('the blog generator template and every generated destination post are free of the old wording', () => {
  const gen = read('Phase 20 Blog Generator.py');
  assert.ok(!OLD.test(gen));
  assert.ok(gen.includes('Before you settle your dates'));
  const d = JSON.parse(read('sparkfare_destinations.json'));
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let n = 0;
  for (const name of Object.keys(d)) {
    const f = path.join(ROOT, 'blog', slug(name) + '.html');
    if (!fs.existsSync(f)) continue;
    n += 1;
    const html = fs.readFileSync(f, 'utf8');
    assert.ok(!OLD.test(html), f);
  }
  assert.ok(n >= 40, 'expected 40 generated posts, found ' + n);
});
