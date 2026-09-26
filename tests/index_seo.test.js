import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// index.html is the highest-traffic page. It already had a title, description and basic Open Graph
// tags; these tests pin the rest of what a crawler or a link-preview needs: a canonical URL, a real
// share image, Twitter card tags and valid structured data.

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));

const meta = (attr, name) => {
  const m = head.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`));
  return m ? m[1] : null;
};

test('index.html has a canonical URL pointing at the bare homepage', () => {
  const m = head.match(/<link rel="canonical" href="([^"]+)"/);
  assert.equal(m && m[1], 'https://sparkfare.com/');
  assert.equal((head.match(/rel="canonical"/g) || []).length, 1, 'exactly one canonical');
});

test('index.html has a description and matching Open Graph / Twitter text', () => {
  const description = meta('name', 'description');
  assert.ok(description && description.length >= 70 && description.length <= 200, 'description length is search-snippet friendly');
  assert.equal(meta('property', 'og:description'), description);
  assert.equal(meta('name', 'twitter:description'), description);
  assert.equal(meta('property', 'og:title'), meta('name', 'twitter:title'));
  assert.equal(meta('property', 'og:site_name'), 'Sparkfare');
  assert.equal(meta('property', 'og:type'), 'website');
  assert.equal(meta('property', 'og:url'), 'https://sparkfare.com/');
});

test('index.html share image is an absolute URL to a real 1200x630 PNG that ships with the site', () => {
  const ogImage = meta('property', 'og:image');
  assert.equal(ogImage, meta('name', 'twitter:image'));
  assert.match(ogImage, /^https:\/\/sparkfare\.com\/[^/]+\.png$/);
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  assert.equal(meta('property', 'og:image:width'), '1200');
  assert.equal(meta('property', 'og:image:height'), '630');
  assert.ok(meta('property', 'og:image:alt'));

  const file = new URL(`../${ogImage.split('/').pop()}`, import.meta.url);
  const png = fs.readFileSync(file);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'valid PNG signature');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.length < 300 * 1024, 'share image stays small enough for crawlers');

  // wrangler only uploads what .assetsignore doesn't exclude -- a png rule there would 404 the image.
  const ignore = fs.readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8').split(/\r?\n/).map((l) => l.trim());
  assert.ok(!ignore.some((l) => l === '*.png' || l === ogImage.split('/').pop()), 'og image must not be asset-ignored');
});

test('index.html structured data is valid JSON-LD for the Organization and WebSite', () => {
  const m = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'JSON-LD block present');
  const data = JSON.parse(m[1]);
  assert.equal(data['@context'], 'https://schema.org');
  const byType = Object.fromEntries(data['@graph'].map((n) => [n['@type'], n]));
  assert.equal(byType.Organization.name, 'Sparkfare');
  assert.equal(byType.WebSite.url, 'https://sparkfare.com/');
  assert.equal(byType.WebSite.publisher['@id'], byType.Organization['@id']);
  assert.match(byType.Organization.logo, /^https:\/\/sparkfare\.com\/.+\.png$/);
});
