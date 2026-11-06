// Guard read round 9 (2026-11-05): the rules the Hub asked to have pinned over all 40 destination posts and the hand-written Away Mode posts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const dests = Object.keys(JSON.parse(read('sparkfare_destinations.json')));
const posts = dests.map((n) => ({ name: n, slug: slug(n), html: read(`blog/${slug(n)}.html`) }));
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
// Same pattern as HOOK_BLOCK in Phase 20 Blog Generator.py.
const HOOK_BLOCK = /\d|[$€£]|\b(dollars?|euros?|than|less|more|half|fraction|cheaper|price\w*|pricing|cost\w*|cheap\w*|budget|value|markup|premium|season\w*|off-peak|window\w*|before)\b/i;
const BULLET_WORDS = /\b(zero|eliminat\w*|half|less than|than|price\w*|pricing|cost\w*|cheap\w*|budget|markup|crowds?)\b/i;
const FEATURED_BODY = "this route isn't judged against a price baseline";

test('there are 40 destination posts', () => assert.equal(posts.length, 40));

test('S3-60: no post hook (the text before the method or featured sentence) carries a price, comparison, figure or timing word', () => {
  const bad = [];
  for (const p of posts) {
    const para = [...p.html.matchAll(/<p>([^<]*Full math in[\s\S]*?)<\/p>/g)].map((m) => strip(m[1]))[0] || '';
    const cut = para.search(/Like every priced route|Sparkfare shows /);
    const hook = cut > 0 ? para.slice(0, cut).trim() : '';
    if (hook && HOOK_BLOCK.test(hook)) bad.push(`${p.slug}: ${hook}`);
  }
  assert.deepEqual(bad, []);
});

test('S3-61: no destination post has a "What it actually costs" section, and no on-the-ground bullet carries a price, cost or absolute word', () => {
  const bad = [];
  const remaining = [];
  for (const p of posts) {
    assert.ok(!/What it actually costs/i.test(p.html), p.slug);
    const sec = p.html.match(/<h2>On the ground<\/h2>\s*<ul>([\s\S]*?)<\/ul>/);
    if (!sec) continue;
    for (const li of sec[1].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const t = strip(li[1]);
      remaining.push(`${p.slug}: ${t}`);
      if (BULLET_WORDS.test(t)) bad.push(`${p.slug}: ${t}`);
    }
  }
  assert.deepEqual(bad, []);
  // Read-out for the Hub (F11): node --test tests/blog_round9_pins.test.js with BLOG_BULLET_READOUT=1.
  if (process.env.BLOG_BULLET_READOUT) console.log(remaining.join('\n'));
});

test('S3-65: a featured route says "always featured" in its meta, og and index card; a priced route never does, and the other way round', () => {
  const idx = read('blog/index.html');
  const bad = [];
  for (const p of posts) {
    const featured = p.html.includes(FEATURED_BODY);
    const metas = [p.html.match(/name="description" content="([^"]*)"/)[1], p.html.match(/property="og:description" content="([^"]*)"/)[1]];
    const i = idx.indexOf(`href="/blog/${p.slug}"`);
    const a = idx.indexOf('<p class="post-excerpt">', i) + 24;
    const card = idx.slice(a, idx.indexOf('</p>', a));
    for (const t of [...metas, card]) {
      if (featured && (/genuine dip|compares fares/.test(t) || !/always featured/.test(t))) bad.push(`${p.slug} (featured): ${t}`);
      if (!featured && /always featured/.test(t)) bad.push(`${p.slug} (priced): ${t}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('S3-62: the vacancy post does not cite a 30- to 60-day figure in its meta, og or index card', () => {
  assert.ok(!/30- to 60-day/.test(read('blog/vacancy-rules-and-homeowners-insurance.html')));
  assert.ok(!/30- to 60-day/.test(read('blog/index.html')));
});

test('S3-63: no post says Away Mode has a dedicated checklist section', () => {
  const bad = fs.readdirSync(path.join(ROOT, 'blog')).filter((f) => f.endsWith('.html') && /dedicated checklist section/.test(read(`blog/${f}`)));
  assert.deepEqual(bad, []);
});

test('S3-64: the trip-protection index card says the benefits must be bought soon, not that they expire', () => {
  const idx = read('blog/index.html');
  assert.ok(!/expire soon after your first payment/.test(idx));
  assert.ok(idx.includes('Some trip protection benefits must be bought soon after your first trip payment.'));
});

test('Guard round 10: a priced guide\'s meta and og description do not promise an "On the ground" section, which no guide has', () => {
  const bad = [];
  for (const p of posts) {
    if (p.html.includes(FEATURED_BODY)) continue; // featured routes keep the wording the owner approved on Nov 5
    for (const m of [p.html.match(/name="description" content="([^"]*)"/)[1], p.html.match(/property="og:description" content="([^"]*)"/)[1]]) {
      if (/on-the-ground/i.test(m) || !m.startsWith('What to sort out before you go to ')) bad.push(`${p.slug}: ${m}`);
    }
  }
  assert.deepEqual(bad, []);
});
