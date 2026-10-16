// Addendum D item 3: the /blog/ index lists every post exactly once, each with a real title and excerpt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const html = fs.readFileSync(path.join(ROOT, 'blog', 'index.html'), 'utf8');
const cards = html.split('<li class="post-card').slice(1).map((s) => s.split('</li>')[0]);
const titleLink = (c) => c.match(/<a class="post-title" href="([^"]*)">([^<]*)<\/a>/);

test('every card has a title link with a /blog/ href and a non-empty title', () => {
  assert.ok(cards.length >= 60);
  for (const c of cards) {
    const m = titleLink(c);
    assert.ok(m, `card without a post-title link: ${c.slice(0, 120)}`);
    assert.match(m[1], /^\/blog\/[a-z0-9-]+$/);
    assert.ok(m[2].trim().length >= 15, `short title for ${m[1]}: ${JSON.stringify(m[2])}`);
    assert.doesNotMatch(m[2], /^\/blog\//, `slug used as title for ${m[1]}`);
    assert.match(c, /<p class="post-excerpt">[^<]{20,}/, `excerpt for ${m[1]}`);
  }
});

test('no post is listed twice', () => {
  const hrefs = cards.map((c) => titleLink(c)[1]);
  const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
  assert.deepEqual(dupes, []);
});

test('every blog post file has exactly one card, and every card points at a real post', () => {
  const files = fs.readdirSync(path.join(ROOT, 'blog')).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => `/blog/${f.replace(/\.html$/, '')}`);
  const hrefs = new Set(cards.map((c) => titleLink(c)[1]));
  assert.deepEqual(files.filter((f) => !hrefs.has(f)), [], 'posts missing from the index');
  assert.deepEqual([...hrefs].filter((h) => !files.includes(h)), [], 'cards pointing nowhere');
});

test('titles with quotation marks are kept whole in the markup', () => {
  const t = (slug) => titleLink(cards.find((c) => c.includes(`href="/blog/${slug}"`)))[2];
  assert.equal(t('away-mode-checklist'), 'What "Away Mode" actually covers before your next trip');
  assert.equal(t('departing-soon-alert-explained'), 'Why we send a "departing soon" alert, and what actually triggers it');
  assert.equal(t('no-data-vs-insufficient-history'), '"No data" vs. "insufficient history": two different honest states');
});
