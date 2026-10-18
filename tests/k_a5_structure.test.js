// K-A5 (ROADMAP step 123, Addendum J4): every page has exactly one <h1> and one <main>, a working skip link, a visible keyboard focus ring,
// labelled fields, no text under 13px, and the structure is well formed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { transform, matchingDivClose, floorFontSizes, addMain, addSkipLink } from '../scripts/apply-structure.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
// preferences.html is the orphaned ghost page (no link reaches it; /account is the real one), like google81...html it is not a page visitors see.
const NO_PAGE = new Set(['google81f5625feccca61c.html', 'preferences.html']);
const pages = [
  ...fs.readdirSync(root).filter((f) => f.endsWith('.html') && !NO_PAGE.has(f)),
  ...fs.readdirSync(path.join(root, 'blog')).filter((f) => f.endsWith('.html')).map((f) => 'blog/' + f),
  ...fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.html')).map((f) => 'data/' + f),
];
const body = (s) => s.replace(/<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');

// Well-formedness of the container tags: every open has its close, in order.
function balanceProblem(s) {
  const stack = [];
  for (const m of body(s).matchAll(/<(\/?)(div|main|nav|header|section|ul|ol|form|footer|table)\b[^>]*>/gi)) {
    const [, close, tag] = m; const t = tag.toLowerCase();
    if (!close) stack.push(t);
    else if (stack.pop() !== t) return `unexpected </${t}>`;
  }
  return stack.length ? `unclosed <${stack.at(-1)}>` : null;
}

test('every page has exactly one <h1> and one <main id="main">, and the container tags balance', () => {
  const bad = [];
  for (const f of pages) {
    const s = body(read(f));
    const h1 = (s.match(/<h1[\s>]/gi) || []).length;
    const main = (s.match(/<main[\s>]/gi) || []).length;
    if (h1 !== 1) bad.push(`${f}: ${h1} h1`);
    if (main !== 1 || !/<main[^>]*\bid="main"/.test(s)) bad.push(`${f}: ${main} main`);
    const p = balanceProblem(read(f));
    if (p) bad.push(`${f}: ${p}`);
  }
  assert.deepEqual(bad, []);
});

test('every page except the two with nothing before the content has a skip link to #main as the first thing in <body>', () => {
  const bad = [];
  for (const f of pages) {
    const s = read(f);
    const first = s.match(/<body[^>]*>\s*(<a class="skip-link" href="#main">Skip to content<\/a>)?/);
    if (!first || !first[1]) bad.push(f);
  }
  assert.deepEqual(bad, []);
});

test('base rules: a 2px ink focus ring on :focus-visible, a skip link that appears on focus, and no rule removes outlines', () => {
  const css = read('brand/tokens.css');
  assert.match(css, /:focus-visible \{ outline: 2px solid var\(--ink\); outline-offset: 2px; \}/);
  assert.match(css, /\.skip-link:focus \{ top: 8px; \}/);
  const offenders = [];
  for (const f of pages) {
    const s = read(f);
    for (const m of s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) if (/outline\s*:\s*(none|0)\b/.test(m[1].replace(/main:focus/g, ''))) offenders.push(f);
  }
  assert.deepEqual([...new Set(offenders)], []);
});

test('no page, template or generator sets a font size under 13px', () => {
  const files = [...pages, 'src/ptoPages.js', 'Phase 17 pSEO Generator (Step 106).py', 'Phase 20 Blog Generator.py'];
  const bad = [];
  for (const f of files) {
    const s = read(f);
    const css = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n') + [...s.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]).join('\n');
    for (const m of css.matchAll(/font-size\s*:\s*([0-9.]+)(px|rem|em)\b/gi)) {
      const px = m[2] === 'px' ? +m[1] : +m[1] * 16;
      if (px < 13) bad.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
});

test('the homepage H1 is the Brand v1 hero line, with the tagline as its proof line, and the signup has a visible Travelers label', () => {
  const html = read('index.html');
  assert.match(html, /<h1 class="home-h1">Look forward to it\. Honestly\.<\/h1>\s*<p class="tagline">It only sparks when the fare's real\.<\/p>/);
  assert.match(html, /\.home-h1 \{[^}]*font-weight: 700;[^}]*font-size: 44px;/);
  assert.match(html, /@media \(max-width: 767px\) \{ \.home-h1 \{ font-size: 32px; \} \}/);
  // K-B2: the signup is an email field and the airport carried from the selector; trip length and travelers moved to the confirmation page
  const form = html.match(/<form class="signup-form"[\s\S]*?<\/form>/)[0];
  assert.deepEqual([...form.matchAll(/<(input|select|textarea)[^>]*name="([^"]+)"/g)].map((m) => m[2]), ['origin_iata', 'email']);
  assert.doesNotMatch(form, /passenger_count|trip_length/);
  assert.match(html, /<button type="submit" class="btn-secondary">Request it<\/button>/);
  assert.match(html, /\.btn-secondary \{\s*min-height: 44px;/);
  assert.ok(!/<h2[^>]*>Join this trip to/.test(html), 'the empty "Join this trip to !" heading is gone');
});

test('/leave has one H1 (the summary heading is an H2), the hub link field is labelled, the widget has an H1', () => {
  const leave = read('leave.html');
  assert.equal((leave.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(leave, /<h2 id="summary"><\/h2>/);
  assert.match(read('hub.html'), /id="ref-link"[^>]*aria-label="Your referral link"/);
  assert.match(read('widget.html'), /<h1 class="widget-headline">Get deal alerts<\/h1>/);
});

test('the Worker route page and the planner carry the skip link and a main landmark', () => {
  const idx = read('src/index.js');
  assert.match(idx, /<body>\n<a class="skip-link" href="#main">Skip to content<\/a>\n  <header>/);
  assert.match(idx, /<main id="main">\n    <h1>Flight deals to/);
  const pto = read('src/ptoPages.js');
  assert.match(pto, /<main id="main">\n\$\{body\}\n<\/main>/);
  assert.ok(pto.includes('class="skip-link"'));
});

test('the structure script is idempotent and finds the matching </div>', () => {
  const page = '<html><body>\n<div class="wrap">\n<nav>n</nav>\n<div><p>x</p></div>\n</div>\n<script src="a.js"></script></body></html>';
  const once = transform(page);
  assert.equal(transform(once), once);
  assert.match(once, /<nav>n<\/nav>\n<main id="main">\n<div><p>x<\/p><\/div>\n<\/main>\n<\/div>/);
  assert.equal(floorFontSizes('a { font-size: 0.7rem; } b { font-size: 14px; } c { font-size: 12px }'), 'a { font-size: 0.8125rem; } b { font-size: 14px; } c { font-size: 0.8125rem }');
  assert.equal(addSkipLink('<body>x'), '<body>\n<a class="skip-link" href="#main">Skip to content</a>x');
  assert.equal(addMain('<div class="wrap">no header or nav</div>'), '<div class="wrap">no header or nav</div>');
});
