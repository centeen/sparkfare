// S3-1 round 3 blog regeneration (Guard read 2026-11-01 ~19:15, I3/T1-T3): one shared, education-only pre-trip sentence on every
// destination post; the cluster-2 subtitle no longer implies waiting for a lower fare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const SENTENCE = 'Before you settle your dates, it helps to sort out the basics: ask your health insurer and home insurer what they cover on a trip abroad, arrange house sitter or pet care, and set up an eSIM or data plan.';
const dest = fs.readdirSync(new URL('../blog/', import.meta.url)).filter((f) => f.endsWith('.html') && read('../blog/' + f).includes('<h2>Before you settle your dates</h2>'));

test('every destination post carries the shared pre-trip sentence once, with no link or partner name beside it', () => {
  assert.equal(dest.length, 40);
  for (const f of dest) {
    const t = read('../blog/' + f);
    assert.equal(t.split(`<p>${SENTENCE}</p>`).length - 1, 1, f);
    const i = t.indexOf('<h2>Before you settle your dates</h2>');
    assert.ok(!/<a /.test(t.slice(i, t.indexOf('</p>', i))), f + ' link');
  }
});

test('the necessity and coverage wording is gone from destination posts', () => {
  for (const f of dest) {
    const t = read('../blog/' + f);
    assert.ok(!/non-negotiable|essential for|compound/i.test(t), f);
  }
  const g = read('../Phase 20 Blog Generator.py');
  assert.ok(g.includes(`PRE_TRIP_SENTENCE = "${SENTENCE}"`));
  assert.ok(g.includes('away_transition = PRE_TRIP_SENTENCE'));
});

test('"worth waiting for" is gone from posts, the blog index, the generator and the sitemap; title, og:title and H1 agree', () => {
  for (const f of [...fs.readdirSync(new URL('../blog/', import.meta.url)).map((x) => '../blog/' + x), '../Phase 20 Blog Generator.py', '../sitemap.xml']) {
    if (!/\.(html|py|xml)$/.test(f)) continue;
    assert.ok(!/worth waiting for/i.test(read(f)), f);
  }
  let n = 0;
  for (const f of dest) {
    const t = read('../blog/' + f);
    const title = t.match(/<title>([^<]*)<\/title>/)[1];
    const og = t.match(/og:title" content="([^"]*)"/)[1];
    const h1 = t.match(/<h1>([^<]*)<\/h1>/)[1];
    assert.equal(og, title, f);
    assert.equal(h1.toLowerCase(), title.toLowerCase(), f);
    if (/A destination guide$/.test(title)) n += 1;
  }
  assert.ok(n >= 10, 'cluster 2 + cluster 4 posts use the guide subtitle, saw ' + n);
});

test('no "ROI" or "compound" value-claim line is left in a destination post, and the generator drops them', () => {
  for (const f of dest) assert.ok(!/\bROI\b|compound/i.test(read('../blog/' + f)), f);
  const g = read('../Phase 20 Blog Generator.py');
  assert.ok(g.includes("re.search(r'\\bROI\\b|compound', item, re.I)"));
});
