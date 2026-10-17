// K-A1a (ROADMAP step 119): one place for colours and fonts. brand/tokens.css and brand/fonts.css exist, every public page links them, no page keeps its
// own palette or its own font stack, and the fonts are self-hosted (no external font host).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const tokens = read('brand/tokens.css');
const fontsCss = read('brand/fonts.css');

const NO_PAGE = new Set(['google81f5625feccca61c.html']); // a search-console verification file, not a page
const pages = [
  ...fs.readdirSync(root).filter((f) => f.endsWith('.html') && !NO_PAGE.has(f)),
  ...fs.readdirSync(path.join(root, 'blog')).filter((f) => f.endsWith('.html')).map((f) => 'blog/' + f),
  ...fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.html')).map((f) => 'data/' + f),
];

test('the brand tokens are the spec values', () => {
  for (const [name, value] of Object.entries({
    paper: '#F5EFE3', card: '#FFFCF6', 'paper-deep': '#EBE2D0', ink: '#231C14', 'ink-2': '#5A4C3C', spark: '#E8B930', 'spark-ink': '#7A4F00', sage: '#2F6B47', clay: '#A63D2A', line: '#DCCFB8',
  })) assert.match(tokens, new RegExp(`--${name}:\\s*${value}\\b`, 'i'), name);
  assert.match(tokens, /--radius:\s*6px/);
  assert.match(tokens, /--radius-pill:\s*999px/);
});

test('the fonts are self-hosted: every file fonts.css names exists, with its licence next to it', () => {
  const urls = [...fontsCss.matchAll(/url\('\/(brand\/fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 6);
  for (const u of urls) assert.ok(fs.statSync(path.join(root, u)).size > 5000, u);
  for (const lic of ['space-grotesk', 'inter', 'ibm-plex-mono']) assert.match(read(`brand/fonts/LICENSE-${lic}.txt`), /SIL Open Font License/);
  assert.ok(!/https?:/.test(fontsCss), 'no external URL in fonts.css');
});

test('every page links tokens.css and fonts.css, once, before its own styles', () => {
  const bad = [];
  for (const f of pages) {
    const s = read(f);
    if (!/<style[ >]/.test(s)) continue; // a page with no styles of its own still gets links below
    const t = s.indexOf('/brand/tokens.css');
    if (t < 0 || s.indexOf('/brand/fonts.css') < 0 || t > s.search(/<style[ >]/) || s.split('/brand/tokens.css').length !== 2) bad.push(f);
  }
  assert.deepEqual(bad, []);
  const noStyle = pages.filter((f) => !/<style[ >]/.test(read(f)) && !read(f).includes('/brand/tokens.css'));
  assert.deepEqual(noStyle, [], 'pages without styles are expected to be none');
});

test('no page defines its own palette or font stack, and none loads an external font host', () => {
  const bad = [];
  for (const f of pages) {
    const s = read(f);
    const css = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    if (/:root\s*\{[^}]*--(sand|amber|sage|text|muted|paper|ledger)\b/.test(css)) bad.push(f + ': own :root palette');
    if (/font-family\s*:\s*['"]?(Segoe UI|Arial|Roboto|Courier|system-ui)/i.test(css)) bad.push(f + ': own font stack');
    if (/fonts\.(googleapis|gstatic)\.com/.test(s)) bad.push(f + ': external font host');
  }
  assert.deepEqual(bad, []);
});

test('the generators and the Worker templates carry the same change', () => {
  for (const f of ['Phase 17 pSEO Generator (Step 106).py', 'Phase 20 Blog Generator.py', 'src/ptoPages.js', 'src/interstitial.js', 'src/embed.html', 'src/widget.html']) {
    const s = read(f);
    assert.ok(s.includes('/brand/tokens.css') && s.includes('/brand/fonts.css'), f);
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(s), f + ' loads an external font host');
    assert.ok(!/:root\s*\{\{?[^}]*--sand/.test(s), f + ' keeps its own palette');
  }
  assert.ok(!/fonts\.googleapis\.com/.test(read('src/index.js')));
});
