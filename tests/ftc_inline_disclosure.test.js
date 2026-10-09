// ROADMAP step 16: an affiliate disclosure has to sit next to the affiliate link it relates to
// (FTC Endorsement Guides), not only behind a nav link to /disclosure. These tests fail if an
// affiliate link is added or moved without a disclosure before/next to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (f) => fs.readFileSync(f, 'utf8');
const AFFILIATE_HREF = /href="\/(?:go|out)\//;

test('every blog post with partner links discloses before the first one', () => {
  const files = fs.readdirSync('blog').filter(f => f.endsWith('.html'));
  let checked = 0;
  for (const f of files) {
    const html = read(path.join('blog', f));
    const m = AFFILIATE_HREF.exec(html);
    if (!m) continue;
    checked++;
    const d = html.indexOf('class="affiliate-disclosure"');
    assert.ok(d !== -1 && d < m.index, `blog/${f}: no disclosure before the first partner link`);
    assert.match(html.slice(d, d + 400), /commission/, `blog/${f}: disclosure must say Sparkfare may earn a commission`);
    assert.match(html.slice(d, d + 400), /href="\/disclosure"/, `blog/${f}: disclosure must link to /disclosure`);
  }
  assert.ok(checked >= 40, `expected to check the 40 known blog posts, checked ${checked}`);
});

test('the blog generator template emits the disclosure, so regenerating cannot drop it', () => {
  const py = read('Phase 20 Blog Generator.py');
  const d = py.indexOf('affiliate-disclosure');
  assert.ok(d !== -1 && d < py.indexOf('class="affiliate-grid"'));
});

// Referral-positioning pass (2026-10-07): one grid-level line (not one per card), plus the hero's
// own note directly under its link. Every fare link reads "View fare ↗" (shortened from "View fare on Aviasales ↗" on 2026-10-09 at the owner's request) and keeps an aria-label
// that says Sparkfare does not sell or book travel.
test('index.html: one grid-level affiliate disclosure, the hero note under its link, and every fare link labelled', () => {
  const html = read('index.html');
  const copy = read('src/referralCopy.js').match(/export const GRID_DISCLOSURE =\s*'([^']+)'/)[1];
  assert.ok(html.includes(`const GRID_DISCLOSURE = '${copy}'`), 'index.html grid disclosure must match src/referralCopy.js');
  assert.ok(html.includes('id="grid-disclosure"'), 'the board must render the grid-level disclosure');
  const re = /<a [^>]*track-booking[^>]*>View fare ↗<\/a>/g;
  const links = html.match(re) || [];
  assert.ok(links.length >= 3, `expected hero, card and join-flight links, found ${links.length}`);
  for (const l of links) {
    assert.match(l, /aria-label="View this fare on Aviasales \(opens in a new tab\)\. Sparkfare does not sell or book travel\."/);
  }
  // The grid-level line is the only copy of the sentence: no per-card notes and no second copy under
  // the hero (the hero sits directly above the grid, so the line is right below its link).
  assert.equal((html.match(/<p class="affiliate-note">/g) || []).length, 0, 'no per-card affiliate notes any more');
  const hero = html.indexOf('class="hero-cta track-booking"');
  assert.ok(!/class="affiliate-note/.test(html.slice(hero, hero + 900)), 'hero must not repeat the grid disclosure');
});

test('Worker-rendered route page and redirect page disclose next to affiliate links', () => {
  const js = read('src/index.js');
  const list = js.indexOf('<ul class="partners-list">');
  const near = js.lastIndexOf('affiliate-disclosure', list);
  assert.ok(near !== -1 && list - near < 600, 'route page: disclosure must sit right above the partner list');
  // /departing/ moved to src/interstitial.js: the disclosure sits directly under the booking
  // button, which is itself directly above the affiliate service links.
  const page = read('src/interstitial.js');
  const cta = page.indexOf('${cta}');
  const disc = page.indexOf('<p class="disclosure">');
  const services = page.indexOf('<ul class="services">');
  assert.ok(cta !== -1 && disc > cta && disc - cta < 600, '/departing/: disclosure must sit right under the booking button');
  assert.ok(services > disc && services - disc < 600, '/departing/: disclosure must precede the service links');
});
