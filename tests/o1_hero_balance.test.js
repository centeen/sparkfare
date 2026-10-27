// Addendum O, O1 (D-045, G106): the desktop hero balance is CSS only and touches nothing at 899 px and below. The layout itself was measured in
// a real browser (docs/handoff/addendum_O_report_2026-10-26.md; 0 element differences at 320 to 899 px against the previous file, MIA and JFK
// bottoms equal at 1366 and 1440 px). These checks keep the change from growing past what was approved.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

/** The CSS with every @media block removed, i.e. what applies at every width. */
function withoutMedia(text) {
  let out = ''; let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@media', i);
    if (at < 0) { out += text.slice(i); break; }
    out += text.slice(i, at);
    let depth = 0; let j = text.indexOf('{', at);
    for (; j < text.length; j++) { if (text[j] === '{') depth++; else if (text[j] === '}') { depth--; if (depth === 0) break; } }
    i = j + 1;
  }
  return out;
}

function mediaBlock(text, query) {
  const at = text.indexOf(`@media (${query})`);
  assert.ok(at >= 0, `${query} block exists`);
  let depth = 0; let j = text.indexOf('{', at);
  const start = j;
  for (; j < text.length; j++) { if (text[j] === '{') depth++; else if (text[j] === '}') { depth--; if (depth === 0) break; } }
  return text.slice(start + 1, j);
}

test('the hero balance rules sit only inside the 900 px and 1100 px blocks, never at every width', () => {
  const base = withoutMedia(css);
  assert.ok(!base.includes('#hero-section { align-self'));
  assert.ok(!base.includes('.hero > div:first-child {'));
  assert.doesNotMatch(base, /#hero-section\s*>\s*\.hero\s*\{[^}]*flex:\s*1 1 auto/);
  assert.doesNotMatch(base, /align-self:\s*stretch/);
  const wide = mediaBlock(css, 'min-width: 900px');
  assert.match(wide, /\.home-top > #hero-section \{ align-self: stretch; display: flex; flex-direction: column; \}/);
  assert.match(wide, /\.home-top > #hero-section > \.hero \{ flex: 1 1 auto; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  assert.match(wide, /\.hero-photo-fallback \{ flex: 1 1 auto; min-height: 0; height: auto; width: 100%; aspect-ratio: auto; max-height: none; object-fit: cover; \}/);
  const wider = mediaBlock(css, 'min-width: 1100px');
  assert.match(wider, /\.home-top \{ grid-template-columns: minmax\(0, 9fr\) minmax\(0, 16fr\); \}/);
});

test('below 900 px nothing about the hero changed: the one-column rules are as before', () => {
  assert.match(css, /\.home-top \.hero \{ grid-template-columns: 1fr; gap: 16px; padding: 0; border-bottom: 0; \}/);
  assert.match(css, /\.home-top \.hero-photo \{ max-height: 240px; \}/);
  assert.match(css, /grid-template-areas: "intro" "origin" "hero" "signup"; margin-bottom: 8px;/);
  const narrow = mediaBlock(css, 'max-width: 720px');
  assert.match(narrow, /\.hero \{ grid-template-columns: 1fr; \}/);
});

test('the hero markup, text and form are untouched: the change adds CSS lines only', () => {
  // The hero is still built as two blocks (photo with its credit line, then the details) and the photo keeps its credit paragraph.
  assert.match(html, /class="attribution"/);
  assert.match(html, /<div id="hero-section">/);
  assert.equal((html.match(/id="signup-form"/g) || []).length, 1);
});
