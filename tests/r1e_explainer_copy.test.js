// Addendum R, R1e (D-053, Hub Guard read 2026-10-30): the explainer pages say the same true thing about fares. They are the lowest
// round-trip price in search data we retrieved, not quotes; the fare can be older than the retrieval time; Aviasales can differ;
// the deal comparison uses our own 30-day history. The old claims that implied a live or fare-time-fresh price are gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const PARAGRAPH =
  'Fares are the lowest round-trip price found in search data we retrieved. They are not quotes, and the fare itself can be older than the retrieval time. The price on Aviasales can be higher or lower. The deal comparison uses our own 30-day history, not the Aviasales price.';
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const PAGES = ['how-it-works.html', 'check.html', 'disclosure.html', 'blog/how-we-rank-deals.html'];

function faqAnswers(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  const out = [];
  for (const s of m) {
    const j = JSON.parse(s.replace(/<script[^>]*>|<\/script>/g, ''));
    for (const node of j['@graph'] || [j]) for (const q of node.mainEntity || []) out.push(q.acceptedAnswer.text);
  }
  return out;
}

test('every explainer page carries the Guard paragraph in its visible text', () => {
  for (const f of PAGES) assert.ok(read(f).includes(PARAGRAPH), f);
});

test('/how-it-works and /check also carry it in the FAQ structured data, matching the visible answer', () => {
  for (const f of ['how-it-works.html', 'check.html']) {
    const html = read(f);
    const answers = faqAnswers(html);
    assert.ok(answers.some((a) => a.includes(PARAGRAPH)), f + ' structured data');
    for (const a of answers) assert.ok(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes(a.replace(/\s+/g, ' ')), f + ': FAQ text must also be visible: ' + a.slice(0, 50));
  }
});

test('the old claims are gone from every explainer, blog post and legal page', () => {
  const files = [...PAGES, 'blog/why-commissions-dont-influence-ranking.html', 'blog/how-we-built-the-2027-long-weekend-calendar.html', 'terms.html'];
  const banned = [/never see outdated/i, /today's (cheapest|lowest)/i, /observed daily/i, /recent search data/i, /has not been observed/i, /48-hour freshness cutoff/i, /disqualified from current deal status/i];
  for (const f of files) for (const b of banned) assert.doesNotMatch(read(f), b, f + ' ' + b);
});

test('the shared footer sentence no longer says "recent search data" (and the Worker copy matches the static pages)', () => {
  assert.doesNotMatch(read('src/referralCopy.js'), /recent search data/);
  assert.doesNotMatch(read('site-footer.js'), /recent search data/);
});

test('no explainer claims one adult, economy or a live price', () => {
  for (const f of PAGES) {
    const text = read(f).replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(text, /one adult|economy|real-time price|live price/i, f);
  }
});
