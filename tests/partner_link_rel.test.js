// Partner links are paid links. Google asks for rel="sponsored" on them, and `nofollow` plus a
// robots.txt Disallow keep crawlers from following the /out/ and /go/ redirects. A crawler that follows
// one is logged as an outbound click and sent on to the partner: that is the most likely source of the
// 11 to 20 anonymous clicks a day seen across all 14 partners with only 3 real users (2026-10-07).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const REQUIRED = ['sponsored', 'nofollow', 'noopener'];

function staticPages() {
  const out = fs.readdirSync(root).filter((f) => f.endsWith('.html') && !f.startsWith('google'));
  for (const d of ['blog', 'data']) out.push(...fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`));
  return out;
}

function partnerAnchors(text) {
  return [...text.matchAll(/<a\s[^>]*href="\/(?:go|out)\/[^"]*"[^>]*>/g)].map((m) => m[0]);
}

function relTokens(anchor) {
  const m = anchor.match(/\brel="([^"]*)"/);
  return m ? m[1].split(/\s+/) : [];
}

test('robots.txt keeps crawlers out of the partner redirects but not out of the site', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^Disallow: \/out\/\s*$/m);
  assert.match(robots, /^Disallow: \/go\/\s*$/m);
  assert.match(robots, /^Allow: \/\s*$/m);
  assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m, 'must not disallow the whole site');
  for (const sm of ['sitemap.xml', 'sitemap-digest.xml', 'sitemap-routes.xml']) assert.ok(robots.includes(`https://sparkfare.com/${sm}`), sm);
});

test('every partner link in every static page is rel="sponsored nofollow noopener"', () => {
  let checked = 0;
  const bad = [];
  for (const rel of staticPages()) {
    for (const a of partnerAnchors(read(rel))) {
      checked++;
      const tokens = relTokens(a);
      if (!REQUIRED.every((t) => tokens.includes(t))) bad.push(`${rel}: ${a.slice(0, 110)}`);
    }
  }
  assert.ok(checked >= 300, `expected the 320 blog partner links, found ${checked}`);
  assert.deepEqual(bad, []);
});

test('partner links built in JavaScript and the generators carry the same rel', () => {
  for (const file of ['away-mode.html', 'src/index.js', 'Phase 20 Blog Generator.py']) {
    const anchors = partnerAnchors(read(file));
    assert.ok(anchors.length >= 1, `${file} should render at least one partner link`);
    for (const a of anchors) assert.ok(REQUIRED.every((t) => relTokens(a).includes(t)), `${file}: ${a.slice(0, 110)}`);
  }
  // The blog generator is what regenerates the posts, so it must emit the same links the posts have.
  assert.equal(partnerAnchors(read('Phase 20 Blog Generator.py')).length, 8);
});

test('the interstitial marks the flight button and every service link sponsored and nofollow', () => {
  const src = read('src/interstitial.js');
  assert.match(src, /const REL = 'sponsored nofollow noopener noreferrer';/);
  assert.equal((src.match(/rel="\$\{REL\}"/g) || []).length, 2, 'the flight button and the service rows both use REL');
});
