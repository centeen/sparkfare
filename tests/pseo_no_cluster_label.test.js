// Addendum D item 1: the internal cluster number and name ("Cluster 4: Visual Clickbait") must not appear on any public
// route page. The cluster logic itself (grouping similar destinations) stays; only the label is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

test('no /data/ page (880 route pages and the listing) contains the capitalised word "Cluster" (internal names)', () => {
  const dir = path.join(ROOT, 'data');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  assert.ok(files.length >= 880, `expected the route pages, found ${files.length}`);
  const bad = files.filter((f) => /Cluster/.test(fs.readFileSync(path.join(dir, f), "utf8")));
  assert.deepEqual(bad, []);
});

test('the related-routes block still lists similar destinations, under a plain heading', () => {
  const html = fs.readFileSync(path.join(ROOT, 'data', 'jfk-to-prague-czechia.html'), 'utf8');
  assert.match(html, /<p class="related-label">Similar destinations<\/p>/);
  assert.match(html, /<p class="related-label">Similar destinations<\/p><ul><li><a href="\/data\/jfk-to-/);
});

test('the generator no longer prints the cluster into the heading', () => {
  const src = fs.readFileSync(path.join(ROOT, 'Phase 17 pSEO Generator (Step 106).py'), 'utf8');
  assert.doesNotMatch(src, /Similar destinations \(\{cluster\}\)/);
  assert.match(src, /Similar destinations<\/p>/);
});
