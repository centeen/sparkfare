// Step 22d (plus_tier_design_2026-10-07.md section 9): nothing about a user's subscription tier may select a
// different data file. Before this, 'paid' selected the hourly file, so the first billing webhook would have sold speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('rankedDealsFilename takes only an origin, so no tier can reach it', () => {
  const m = src.match(/function rankedDealsFilename\(([^)]*)\)/);
  assert.ok(m, 'rankedDealsFilename exists');
  assert.equal(m[1].trim(), 'origin');
});

test('no code path picks the hourly ranked-deals file for a user', () => {
  // The hourly file may be named in the freshness monitor's list of files to check, and in N10's SHADOW_SERVED_FILES (the three
  // ranked files that exist as shadow copies; read only when ENABLE_CURATED_SERVING is on, never chosen by tier).
  const all = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => l.includes('sparkfare_hourly_ranked_deals.json') && !l.trim().startsWith('//'));
  const shadow = all.filter(([, l]) => l.includes('SHADOW_SERVED_FILES'));
  assert.ok(shadow.every(([, l]) => !/tier|paid|subscription/i.test(l)), 'the shadow list must not involve a tier');
  const hits = all.filter((h) => !shadow.includes(h));
  assert.equal(hits.length, 1, `unexpected references: ${JSON.stringify(hits)}`);
  assert.match(hits[0][1], /maxAgeHours/);
});

test('no call site derives a data tier from subscription_tier', () => {
  assert.doesNotMatch(src, /rankedDealsFilename\(\s*tier/);
  assert.doesNotMatch(src, /subscription_tier\s*===\s*'paid'\s*\?/);
  assert.doesNotMatch(src, /user\?\.subscription_tier === 'paid'/);
});
