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

// The two explainer posts describe how destinations are grouped without the internal group names or the word "cluster".
// The URL slug (/blog/destination-clusters-explained) is unchanged so existing links keep working.
const visibleText = (p) => read(p).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ');

test('no blog post uses the internal group names', () => {
  const bad = fs.readdirSync(new URL('../blog', import.meta.url)).filter((f) => f.endsWith('.html') && /Visual Clickbait|Shoulder-Season Cliffs|LCC Routing Anomalies|Long-Haul Volatility/.test(read(`blog/${f}`)));
  assert.deepEqual(bad, []);
});

test('the two explainer posts say "groups" in their visible text and metadata, never "cluster"', () => {
  for (const p of ['blog/destination-clusters-explained.html', 'blog/how-we-rank-deals.html']) {
    const meta = [...read(p).matchAll(/<meta[^>]*content="([^"]*)"/g)].map((m) => m[1]).filter((v) => !/^https?:\/\//.test(v)).join(' ');
    assert.doesNotMatch(visibleText(p) + ' ' + meta, /cluster/i, p);
  }
  const t = visibleText('blog/destination-clusters-explained.html');
  assert.match(t, /sits in one of four groups/);
  assert.match(t, /Long-haul routes/);
  assert.match(t, /Featured destinations — no threshold, always shown/);
});

test('links to the explainer keep the slug but no longer say "cluster" in their text', () => {
  assert.match(read('blog/destination-clusters-explained.html'), /<link rel="canonical" href="https:\/\/sparkfare\.com\/blog\/destination-clusters-explained">/);
  assert.match(read('blog/how-we-rank-deals.html'), /how our destination groups work<\/a>/);
  assert.match(read('blog/why-commissions-dont-influence-ranking.html'), />grouping of destinations<\/a>/);
  assert.match(read('blog/index.html'), /A full breakdown of our four destination groups/);
  assert.doesNotMatch(visibleText('blog/index.html') + visibleText('blog/why-commissions-dont-influence-ranking.html'), /destination clusters|cluster system/i);
});
