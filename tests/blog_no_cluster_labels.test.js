// The internal cluster number ("Cluster 2") is not a public label: no blog post and no blog generator template says it.
// The explainer posts still describe how destinations are grouped, in words, without numbering them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('no blog post contains "Cluster <number>"', () => {
  const bad = fs.readdirSync(new URL('../blog', import.meta.url)).filter((f) => f.endsWith('.html') && /Cluster\s*[0-9]/.test(read(`blog/${f}`)));
  assert.deepEqual(bad, []);
});

test('the blog generator no longer writes "under Cluster N" into destination guides', () => {
  const src = read('Phase 20 Blog Generator.py');
  assert.doesNotMatch(src, /under Cluster/);
  assert.match(src, /Like every priced route, \{city_name\} earns a deal badge only when/);
});

test('destination guides keep the explanation of the deal rule, with the destination as the subject', () => {
  const t = read('blog/lisbon-portugal.html');
  assert.match(t, /Like every priced route, Lisbon earns a deal badge only when a fare falls below its own 30-day median/);
  assert.match(t, /Full math in <a href="\/blog\/how-we-rank-deals">how we rank deals<\/a>/);
});

test('the commissions post names the exception without the cluster number', () => {
  const t = read('blog/why-commissions-dont-influence-ranking.html');
  assert.match(t, /Featured destinations are the honest exception, and they're labeled as such/);
});
