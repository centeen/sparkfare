// K-A2 (ROADMAP step 120): action colour. Buttons and links are sage with white text on a fill; gold (--spark) appears only as the Deal chip's
// fill (with a 1px spark-ink border); amber is retired (it is an alias of sage); a deal price is plain ink.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rewriteRule, actionCss } from '../scripts/apply-action-colour.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const tokens = read('brand/tokens.css');

const FILES = [
  ...fs.readdirSync(root).filter((f) => f.endsWith('.html') && !f.startsWith('google81')),
  ...fs.readdirSync(path.join(root, 'blog')).filter((f) => f.endsWith('.html')).map((f) => 'blog/' + f),
  ...fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.html')).map((f) => 'data/' + f),
  'src/index.js', 'src/interstitial.js', 'src/ptoPages.js', 'src/embed.html', 'src/widget.html',
  'Phase 17 pSEO Generator (Step 106).py', 'Phase 20 Blog Generator.py',
];

// Every CSS rule (selector + body) and every style="..." attribute in a file.
function rules(s) {
  const out = [];
  for (const m of s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const css = m[1].replace(/\{\{/g, '{').replace(/\}\}/g, '}');
    for (const r of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: r[1].trim(), body: r[2] });
  }
  for (const m of s.matchAll(/\sstyle="([^"]*)"/g)) out.push({ sel: '(inline)', body: m[1] });
  return out;
}

test('tokens: sage is the action colour with white text, and amber is an alias of sage', () => {
  assert.match(tokens, /--on-sage:\s*#FFFFFF/i);
  assert.match(tokens, /--amber:\s*var\(--sage\)/);
});

test('gold is used only by the Deal chip: no other rule paints with --spark or the old gold hex', () => {
  const bad = [];
  for (const f of FILES) {
    for (const { sel, body } of rules(read(f))) {
      if (/\.badge\.deal|\.chip/.test(sel)) continue;
      if (/var\(--spark\)|#E8B930/i.test(body)) bad.push(`${f}: ${sel.slice(0, 50)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the Deal chip is a gold fill, ink text and a spark-ink border', () => {
  const idx = read('index.html');
  const chip = rules(idx).find((r) => r.sel === '.chip-deal');
  assert.ok(chip, 'index.html defines .chip-deal');
  assert.match(chip.body, /background:\s*var\(--spark\)/);
  assert.match(chip.body, /color:\s*var\(--ink\)/);
  assert.match(chip.body, /border-color:\s*var\(--spark-ink\)/);
});

test('a deal price and a watchlist price are plain ink, not amber or gold', () => {
  const bad = [];
  for (const f of FILES) for (const { sel, body } of rules(read(f))) {
    if ((/\.is-deal/.test(sel) || /wl-price/.test(sel)) && /(^|[;\s])color\s*:\s*var\(--(amber|spark|spark-ink)\)/.test(body)) bad.push(`${f}: ${sel}`);
  }
  assert.deepEqual(bad, []);
});

test('the main buttons are sage fills with white text', () => {
  const idx = rules(read('index.html'));
  for (const sel of ['.field button', '.hero-cta', '.book-link']) {
    const r = idx.find((x) => x.sel === sel);
    assert.ok(r, sel);
    assert.match(r.body, /background:\s*var\(--sage\)/, sel);
    assert.match(r.body, /color:\s*var\(--on-sage\)/, sel);
  }
  assert.match(read('src/interstitial.js'), /\.cta \{[^}]*background: var\(--sage\); color: var\(--on-sage\)/);
});

test('the rewrite is idempotent and only touches colour', () => {
  const css = '.x { background: var(--spark); color: var(--text); border-color: var(--spark); padding: 6px; }\n.hero-price.is-deal { color: var(--amber); }\n.badge.deal { color: var(--amber); border: 1px solid var(--amber); }';
  const once = actionCss(css);
  assert.equal(actionCss(once), once);
  assert.match(once, /\.x \{ background: var\(--sage\); color: var\(--on-sage\); border-color: var\(--sage\); padding: 6px; \}/);
  assert.match(once, /\.hero-price\.is-deal \{ color: var\(--ink\); \}/);
  assert.match(once, /\.badge\.deal \{ background: var\(--spark\); color: var\(--ink\); border: 1px solid var\(--spark-ink\); \}/);
  assert.equal(rewriteRule('.a', 'padding: 4px;'), 'padding: 4px;');
});
