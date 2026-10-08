// Away Move 4 (ROADMAP step 71): four trust posts. Each one that exists must carry a review date, dated sources,
// no partner or affiliate links, be in the blog index and the sitemap, and use the shared nav and footer hooks.
// A post that has not landed yet is skipped, so this file stays green while the four PRs merge one at a time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const SLUGS = ['water-not-burglars', 'what-your-card-may-already-cover', 'cant-go-because-of-the-dog', 'trip-protection-has-a-clock'];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const present = SLUGS.filter((s) => existsSync(new URL(`../blog/${s}.html`, import.meta.url)));

test('at least the first trust post exists', () => {
  assert.ok(present.length >= 1);
});

for (const slug of present) {
  test(`${slug}: dated, sourced, no partner links, indexed`, () => {
    const html = read(`blog/${slug}.html`);
    assert.match(html, /Last reviewed 20\d\d-\d\d-\d\d/);
    assert.match(html, /<h2>Sources<\/h2>/);
    assert.match(html, /<li>[^<]*<a href="https:\/\/[^"]+" rel="noopener noreferrer">/, 'at least one linked, external source');
    assert.doesNotMatch(html, /href="[^"]*\/(out|go)\/|aviasales|tpo\.lu|safetywing|skimresources/i, 'no partner or affiliate links');
    assert.doesNotMatch(html, /Sparkfare may earn a commission/, 'no affiliate disclosure needed because there are no affiliate links');
    assert.match(html, new RegExp(`<link rel="canonical" href="https://sparkfare.com/blog/${slug}">`));
    assert.match(html, /id="sign-in-nav-link"/);
    assert.match(html, /syncNavAuthStateLazy\(\)/);
    assert.match(html, /\/site-footer\.js/);
    assert.match(read('blog/index.html'), new RegExp(`href="/blog/${slug}"`));
    assert.match(read('sitemap.xml'), new RegExp(`<loc>https://sparkfare.com/blog/${slug}</loc>`));
  });
}

test('the trip-protection post names no insurer, plan or recommendation', { skip: !present.includes('trip-protection-has-a-clock') }, () => {
  const html = read('blog/trip-protection-has-a-clock.html');
  const body = html.slice(html.indexOf('<h1>'), html.indexOf('<h2>Sources</h2>'));
  assert.doesNotMatch(body, /href="(?!\/away-mode")/, 'no outbound links in the body');
  assert.doesNotMatch(body, /we recommend|best plan|you should buy|safetywing|allianz|world nomads|travel guard/i);
  assert.match(body, /10 to 21 days/);
});

test('the pet post carries no alarm codes and no Rover link', { skip: !present.includes('cant-go-because-of-the-dog') }, () => {
  const html = read('blog/cant-go-because-of-the-dog.html');
  assert.match(html, /Do not write down alarm codes/);
  assert.doesNotMatch(html, /rover\.com|href="[^"]*rover/i);
});

test('no post states the unverified spec figure of 95 million pet households', () => {
  for (const slug of present) assert.doesNotMatch(read(`blog/${slug}.html`), /95 million/);
});
