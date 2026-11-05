// S3-1 round 3 (Guard read 2026-11-01 ~18:30, items 1-2, C1a/C1b/C2a): priced route pages and blog posts no longer promise a
// route-level email; blog og:description equals the post's own meta description.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const files = (dir) => fs.readdirSync(new URL(dir, import.meta.url)).filter((f) => f.endsWith('.html'));
const OLD = ['Track this route', 'when it drops below its usual price', 'how to watch this route'];

test('the old promise is gone from every route page, blog post, the blog index and both generators', () => {
  const hits = [];
  for (const f of files('../data/')) for (const s of OLD) if (read('../data/' + f).includes(s)) hits.push('data/' + f);
  for (const f of files('../blog/')) for (const s of OLD) if (read('../blog/' + f).includes(s)) hits.push('blog/' + f);
  for (const g of ['../Phase 17 pSEO Generator (Step 106).py', '../Phase 20 Blog Generator.py']) for (const s of OLD) if (read(g).includes(s)) hits.push(g);
  assert.deepEqual(hits, []);
});

test('priced route pages: meta, og:description and JSON-LD carry the approved line with the page\'s own airport', () => {
  let n = 0;
  for (const f of files('../data/')) {
    const t = read('../data/' + f);
    const m = t.match(/<meta name="description" content="(Flights from ([A-Z]{3}) to [^"]*? vs\. a [^"]*?)"/);
    if (!m) continue;
    n += 1;
    assert.ok(m[1].endsWith(`30-day median. At most one fare email a day, with fares from ${m[2]}.`), f);
    assert.ok(t.includes(`<meta property="og:description" content="${m[1]}">`), f + ' og');
    assert.ok(!/undefined|vs\. a\s+30-day|vs\. a N\/A/.test(m[1]), f + ' blank median');
  }
  assert.ok(n > 100, 'expected many priced pages, saw ' + n);
});

test('generator: the priced meta is only built when a median exists (no blank or N/A median in a snippet)', () => {
  const g = read('../Phase 17 pSEO Generator (Step 106).py');
  assert.ok(g.includes('elif record.get("status") in ("deal", "priced_no_deal") and median_html != "N/A":'));
  assert.ok(g.includes('At most one fare email a day, with fares from {origin}.'));
});

test('blog: every post\'s og:description equals its own meta description, and the template does the same', () => {
  let n = 0;
  for (const f of files('../blog/')) {
    const t = read('../blog/' + f);
    const d = t.match(/<meta name="description" content="([^"]*)"/);
    const o = t.match(/<meta property="og:description" content="([^"]*)"/);
    if (!d || !o) continue;
    if (/On-the-ground notes for/.test(o[1]) || /On-the-ground notes for/.test(d[1])) { n += 1; assert.equal(o[1], d[1], f); }
  }
  assert.ok(n >= 40, 'saw ' + n);
  const g = read('../Phase 20 Blog Generator.py');
  const d = g.match(/<meta name="description" content="([^"]*)">/)[1];
  assert.ok(g.includes(`<meta property="og:description" content="${d}">`));
});

test('blog index excerpts use the approved wording and promise no alert', () => {
  const t = read('../blog/index.html');
  assert.ok(t.split('how Sparkfare compares fares from your home airport with their usual price').length - 1 >= 30); // 30 priced routes; the 10 featured routes say 'always featured' (Guard round 9, R1)
});
