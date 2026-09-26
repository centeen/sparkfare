import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards for the homepage mobile-UI fixes made after the 2026-09-26 audit of ROADMAP step 14, measured
// on production at 375x812. These are static checks on the source; the real measurements (positions,
// tap-target sizes, contrast) were taken in a browser and are recorded in CLAUDE.md.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// normalise CRLF (Windows checkouts) so the block regexes below see plain LF
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

// --- 1. undefined CSS custom properties ------------------------------------------------------------
// The "Create Watchlist" and "Browse All 480 Routes" buttons were styled with style-guide variable
// names this page never defines. An undefined custom property does not fall back to anything sensible:
// it invalidates the whole declaration, so the background and border silently vanished and both
// buttons rendered as plain text.
function undefinedVars(file) {
  const s = stripComments(read(file));
  const used = new Set([...s.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
  const defined = new Set([...s.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  return [...used].filter((v) => !defined.has(v));
}

test('no page uses a CSS variable it never defines', () => {
  const files = [
    ...fs.readdirSync(root).filter((f) => f.endsWith('.html')),
    ...fs.readdirSync(path.join(root, 'blog')).filter((f) => f.endsWith('.html')).map((f) => `blog/${f}`),
    ...fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.html')).map((f) => `data/${f}`),
  ];
  assert.ok(files.length > 500);
  const bad = files
    .map((f) => [f, undefinedVars(f)])
    .filter(([, v]) => v.length)
    .map(([f, v]) => `${f}: ${v.join(', ')}`);
  assert.deepEqual(bad, [], `undefined CSS variables:\n${bad.slice(0, 5).join('\n')}`);
});

// --- 2. promo placement and copy -------------------------------------------------------------------
test('the watchlist and directory promos sit below the deal board, before the footer', () => {
  const at = (needle) => {
    const i = html.indexOf(needle);
    assert.ok(i >= 0, `missing ${needle}`);
    return i;
  };
  const board = at('<div id="board-sections">');
  const watchlist = at('<section class="watchlist-promo"');
  const directory = at('<section class="directory-promo"');
  const footer = at('<footer>');
  assert.ok(board < watchlist && watchlist < directory && directory < footer, 'promos must follow the board and precede the footer');
  // and not above the hero, where they pushed it below the fold on phones
  assert.ok(at('<div id="hero-section">') < watchlist);
});

test('copy that says "the board above" is only used when the promo really follows the board', () => {
  const m = html.match(/<section class="directory-promo"[\s\S]*?<\/section>/);
  assert.ok(m);
  if (/board above/i.test(m[0])) {
    assert.ok(html.indexOf('<section class="directory-promo"') > html.indexOf('<div id="board-sections">'));
  }
  assert.doesNotMatch(m[0], /only shows active price drops/i, 'the board also lists routes priced normally and ones still building history');
});

// --- 3. CTA buttons --------------------------------------------------------------------------------
test('promo CTAs are real styled buttons with a 44px minimum height and no inline variable styling', () => {
  for (const cls of ['watchlist-cta', 'directory-promo']) {
    assert.ok(html.includes(cls));
  }
  const links = [...html.matchAll(/<a [^>]*class="[^"]*promo-cta[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(links.length, 2, 'both promo CTAs use the .promo-cta class');
  for (const l of links) assert.doesNotMatch(l, /style=/, 'styling belongs in the stylesheet, not inline');

  const css = stripComments(html);
  const base = css.match(/\.promo-cta\s*\{([^}]*)\}/);
  assert.ok(base, '.promo-cta rule');
  const minH = base[1].match(/min-height:\s*(\d+)px/);
  assert.ok(minH && Number(minH[1]) >= 44, 'promo CTAs must be at least 44px tall');
  assert.match(css, /\.promo-cta-solid\s*\{[^}]*background:\s*var\(--card\)/);
  assert.match(css, /\.promo-cta-outline\s*\{[^}]*border:\s*1px solid var\(--sage\)/);
});

// --- 4. "More" toggle tap target -------------------------------------------------------------------
test('the "More" toggle has an enlarged, invisible tap area', () => {
  const css = stripComments(html);
  const after = css.match(/\.expand-toggle::after\s*\{([^}]*)\}/);
  assert.ok(after, '.expand-toggle::after rule');
  const inset = after[1].match(/inset:\s*(-\d+)px\s+(-\d+)px/);
  assert.ok(inset, 'negative inset extends the hit area');
  // the button measured 31x17px; the visible size is unchanged, the hit area is 31+2*8 by 17+2*14
  assert.ok(Math.abs(Number(inset[1])) * 2 + 17 >= 44, 'vertical hit area must reach 44px');
  assert.ok(Math.abs(Number(inset[2])) * 2 + 31 >= 44, 'horizontal hit area must reach 44px');
  assert.match(css, /\.expand-toggle\s*\{\s*position:\s*relative;/);
});

// --- 5. sort / filter bar --------------------------------------------------------------------------
test('each sort/filter label is wrapped with its own control and stacks together on phones', () => {
  const bar = html.match(/<section class="origin-bar"[\s\S]*?<\/section>/)[0];
  const fields = [...bar.matchAll(/<div class="origin-bar-field">([\s\S]*?)<\/div>/g)].map((m) => m[1]);
  assert.equal(fields.length, 2, 'origin and sort are two label+control pairs');
  for (const f of fields) {
    const label = f.match(/<label[^>]*for="([^"]+)"/);
    assert.ok(label, 'each pair has a label');
    assert.ok(f.includes(`<select id="${label[1]}"`), `the label targets the select inside its own pair (${label[1]})`);
  }
  const mobile = html.match(/@media \(max-width: 768px\) \{[\s\S]*?\n  \}\n/);
  assert.ok(mobile, 'the 768px mobile block');
  assert.match(mobile[0], /\.origin-bar\s*\{[^}]*flex-direction:\s*column/);
  assert.match(mobile[0], /\.origin-bar-field\s*\{[^}]*flex-direction:\s*column/);
  assert.match(mobile[0], /\.origin-bar select\s*\{[^}]*min-height:\s*44px/);
});
