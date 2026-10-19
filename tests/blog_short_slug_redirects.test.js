// 2026-10-14: sixteen older short-slug destination posts (blog/algarve.html, ...) duplicated their full-slug twins
// (blog/algarve-portugal.html, ...) with the same title and intro. They were in sitemap.xml and linked from the blog index while the
// twins (which carry the partner grid and disclosure) were not. Each short slug now 301s to its twin through _redirects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const MAP = {
  algarve: 'algarve-portugal', antigua: 'antigua-guatemala', baku: 'baku-azerbaijan', bucharest: 'bucharest-romania',
  'cape-town': 'cape-town-south-africa', cebu: 'cebu-philippines', 'guatemala-city': 'guatemala-city-guatemala',
  'ho-chi-minh-city': 'ho-chi-minh-city-vietnam', larnaca: 'larnaca-cyprus', maldives: 'maldives-male', oaxaca: 'oaxaca-mexico',
  phuket: 'phuket-thailand', 'san-jose': 'san-jose-costa-rica', taipei: 'taipei-taiwan', tbilisi: 'tbilisi-georgia',
  thessaloniki: 'thessaloniki-greece',
};

test('_redirects sends every short slug (with and without .html) to its twin with a 301', () => {
  const rules = read('_redirects').split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  for (const [s, t] of Object.entries(MAP)) {
    assert.ok(rules.includes(`/blog/${s} /blog/${t} 301`), `missing /blog/${s}`);
    assert.ok(rules.includes(`/blog/${s}.html /blog/${t} 301`), `missing /blog/${s}.html`);
  }
  // 2026-10-18 (step 97): the "book" post was renamed; its two old URLs 301 to the new one.
  for (const ext of ['', '.html']) assert.ok(rules.includes(`/blog/what-happens-after-you-click-book${ext} /blog/what-happens-after-you-click-a-fare 301`), 'missing renamed-post redirect');
  // the browsers' default /favicon.ico request goes to the PNG (it was a 404 in every page's console)
  assert.ok(rules.includes('/favicon.ico /favicon.png 302'), 'missing favicon redirect');
  assert.equal(rules.length, Object.keys(MAP).length * 2 + 3, 'unexpected extra redirect rule');
});

test('_redirects is not asset-ignored and stays within Cloudflare static-rule limits', () => {
  const ignore = read('.assetsignore').split(/\r?\n/).map((l) => l.trim());
  assert.ok(!ignore.some((l) => l === '_redirects' || l === '_*'), '_redirects must be uploaded');
  assert.ok(Object.keys(MAP).length * 2 + 3 <= 100);
});

test('the short-slug files are gone and every twin exists', () => {
  for (const [s, t] of Object.entries(MAP)) {
    assert.ok(!fs.existsSync(path.join(ROOT, 'blog', `${s}.html`)), `blog/${s}.html should be removed`);
    assert.ok(fs.existsSync(path.join(ROOT, 'blog', `${t}.html`)), `blog/${t}.html missing`);
  }
});

test('sitemap.xml lists each twin exactly once and no short slug', () => {
  const sm = read('sitemap.xml');
  for (const [s, t] of Object.entries(MAP)) {
    assert.equal(sm.split(`<loc>https://sparkfare.com/blog/${t}</loc>`).length - 1, 1, `${t} should appear once`);
    assert.ok(!sm.includes(`<loc>https://sparkfare.com/blog/${s}</loc>`), `${s} should not be listed`);
  }
});

test('the blog index links the twins, never a short slug', () => {
  const idx = read('blog/index.html');
  for (const [s, t] of Object.entries(MAP)) {
    assert.ok(!idx.includes(`href="/blog/${s}"`), `index still links /blog/${s}`);
    assert.ok(idx.includes(`href="/blog/${t}"`), `index does not link /blog/${t}`);
  }
});
