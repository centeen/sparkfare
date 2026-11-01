// S6 (Addendum S, G118): the sale-fare guide at /check/sale-fares, Guard conditions C1-C7 (2026-11-01).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const page = read('../check/sale-fares.html');
const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
const text = main.replace(/<[^>]+>/g, ' ');

test('title, H1, canonical and meta description are the approved text (C6: "actually good")', () => {
  assert.match(page, /<title>Is this sale fare actually good\? \| Sparkfare<\/title>/);
  assert.equal((page.match(/<h1>/g) || []).length, 1);
  assert.ok(page.includes('<h1>Is this sale fare actually good?</h1>'));
  assert.ok(page.includes('<link rel="canonical" href="https://sparkfare.com/check/sale-fares" />'));
  const d = "Learn how to judge a sale fare against its route's own 30-day price history, with Sparkfare's free price checker. No predictions, just the history.";
  assert.equal(d.length, 147);
  assert.ok(page.includes(`content="${d}"`));
  assert.ok(!/\breal\b/i.test(page.match(/<title>[^<]*/)[0] + page.match(/<h1>[^<]*/)[0]));
});

test('the six steps and the closing line are present once', () => {
  assert.equal((main.match(/<li><strong>/g) || []).length, 6);
  for (const s of ['Note the round-trip price.', 'Enter the route.', 'Read the verdict.', 'Check how much history there is.', 'Keep the limits in mind.', 'Decide for yourself.']) {
    assert.equal(main.split(s).length - 1, 1, s);
  }
  assert.equal(main.split("Have a sale fare in mind? Check it with Sparkfare's free <a href=\"/check\">price checker</a>.").length - 1, 1);
  assert.ok(main.includes('Last reviewed: Nov 1, 2026'));
});

test('C3/C4: no number from data, and only internal links to /check and /how-it-works', () => {
  const hrefs = [...main.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(hrefs)].sort(), ['/check', '/how-it-works']);
  assert.ok(!/\$\s?\d/.test(text) && !/\d+\s?%/.test(text), 'no price or percentage');
  assert.ok(!/<form|<input|api\/signup/i.test(main), 'C5: no signup block');
});

test('C1: none of the banned words or claims', () => {
  assert.ok(!/\b(book|booking|secure|secured|instantly|cheapest day|only \d+ left|countdown|hurry|last chance|save \$|you.ll save|will (rise|fall|drop))\b/i.test(text), text.match(/\b(book|booking|secure|instantly)\b/i)?.[0]);
  assert.ok(text.includes("doesn't sell flights"));
});

test('C2: the guide still matches what /check does', () => {
  const c = read('../check.html');
  assert.ok(c.includes("trailing 30-day median of the lowest cached round-trip fares"));
  assert.ok(c.includes("VERDICT_WORDS = { deal: 'Deal', typical: 'Typical', high: 'High' }"));
  assert.ok(c.includes("We haven't seen enough fares for "));
  assert.ok(c.includes('Round-trip price you saw'));
});

test('sitemap lists the guide once', () => {
  assert.equal(read('../sitemap.xml').split('<loc>https://sparkfare.com/check/sale-fares</loc>').length - 1, 1);
});

test('/check carries the one-line pointer only until Dec 2, linking the guide', () => {
  const c = read('../check.html');
  assert.equal(c.split('<a href="/check/sale-fares">how to judge it</a>').length - 1, 1);
  assert.ok(c.includes('id="sale-fares-note" hidden'));
  assert.ok(c.includes('Date.now() < Date.UTC(2026, 11, 2)'));
});

test('the page is a public static file (not asset-ignored) with the shared header', () => {
  assert.ok(!/^check\/?$|^check\/sale/m.test(read('../.assetsignore')));
  assert.ok(page.includes('class="site-nav sf-nav"') && page.includes('/site-footer.js'));
});
