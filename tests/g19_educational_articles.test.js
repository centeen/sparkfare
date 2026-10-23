// G19 educational articles test: all 8 Away Mode preparation and return articles are published,
// indexed, linked from the blog index and sitemap, adhere to Brand v1 structure, and cite primary sources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const G19_SLUGS = [
  'one-page-home-handoff-sheet',
  'leaving-a-cat-two-to-three-weeks',
  'winter-absences-protecting-pipes',
  'after-you-return-restarting-mail-and-checking-home',
  'leaving-home-for-30-days',
  'leaving-plants-and-garden-for-a-month',
  'taking-your-pet-abroad-vs-leaving-it',
  'vacancy-rules-and-homeowners-insurance',
];

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const blogIndex = fs.readFileSync(path.join(ROOT, 'blog', 'index.html'), 'utf8');

test('all 8 G19 articles exist in blog/ directory', () => {
  for (const slug of G19_SLUGS) {
    const file = path.join(ROOT, 'blog', `${slug}.html`);
    assert.ok(fs.existsSync(file), `blog/${slug}.html must exist`);
  }
});

test('all 8 G19 articles are listed in sitemap.xml with canonical URLs', () => {
  for (const slug of G19_SLUGS) {
    const canonical = `https://sparkfare.com/blog/${slug}`;
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `sitemap.xml missing ${canonical}`);
  }
});

test('all 8 G19 articles are linked from blog/index.html with valid cards', () => {
  for (const slug of G19_SLUGS) {
    assert.ok(blogIndex.includes(`href="/blog/${slug}"`), `blog/index.html missing link to /blog/${slug}`);
  }
});

test('each G19 article has valid Brand v1 structure, H1, main, skip link, and Away Mode CTA', () => {
  for (const slug of G19_SLUGS) {
    const html = fs.readFileSync(path.join(ROOT, 'blog', `${slug}.html`), 'utf8');
    assert.match(html, /<a class="skip-link" href="#main">Skip to content<\/a>/);
    assert.match(html, /<main id="main">/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `exactly one <h1> in ${slug}`);
    assert.equal((html.match(/<main[\s>]/g) || []).length, 1, `exactly one <main> in ${slug}`);
    assert.match(html, /<link rel="stylesheet" href="\/brand\/tokens\.css">/);
    assert.match(html, /<link rel="stylesheet" href="\/brand\/fonts\.css">/);
    assert.match(html, /<p class="byline">Away Mode/);
    assert.match(html, /<a class="cta" href="\/away-mode">Open Away Mode<\/a>/);
    assert.match(html, /<h2>Sources and (?:primary|official) references<\/h2>/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b(?![^<]*>)/, `no raw hex colors in ${slug}`);
  }
});
