// K-B6 (ROADMAP step 129): night mode. Tokens from Brand v1, text on sage and on the gold chip stays readable, and the checks run in night mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { swap } from '../scripts/apply-night-sage.mjs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tokens = read('brand/tokens.css');
const night = tokens.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/);
const val = (block, name) => (block.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})')) || [])[1];

test('the night tokens are the Brand v1 values', () => {
  assert.ok(night, 'tokens.css has a prefers-color-scheme: dark block');
  const want = { paper: '#17130E', card: '#211B14', 'paper-deep': '#2A231A', ink: '#F2EADB', 'ink-2': '#B9AC97', spark: '#E8B930', 'spark-ink': '#E8B930', sage: '#7FBF93', clay: '#E08A73', line: '#3A3128' };
  for (const [k, v] of Object.entries(want)) assert.equal(val(night[1], k)?.toUpperCase(), v, k);
});

test('text on a sage fill and on the gold chip is dark in the night theme, and the page follows the system theme', () => {
  assert.equal(val(night[1], 'on-sage')?.toUpperCase(), '#17130E');
  assert.equal(val(tokens, 'on-spark')?.toUpperCase(), '#231C14', 'the chip text token is dark in the day theme and is not overridden at night');
  assert.doesNotMatch(night[1], /--on-spark/);
  assert.match(tokens, /color-scheme:\s*light dark/);
  assert.match(read('index.html'), /\.chip-deal \{[^}]*color: var\(--on-spark\)/);
});

test('contrast arithmetic: dark text on the night sage and on the gold chip is at least 4.5:1', () => {
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  assert.ok(ratio('#17130E', '#7FBF93') >= 4.5, 'on-sage on night sage');
  assert.ok(ratio('#231C14', '#E8B930') >= 4.5, 'on-spark on gold');
  assert.ok(ratio('#F2EADB', '#17130E') >= 4.5, 'night ink on night paper');
  assert.ok(ratio('#7FBF93', '#17130E') >= 4.5, 'night sage links on night paper');
});

test('no page, generator or template paints white or card-coloured text on a sage fill any more (the swap script finds nothing to do)', () => {
  const out = execFileSync(process.execPath, ['scripts/apply-night-sage.mjs', '--check'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.match(out, /0 file\(s\) differ/);
});

test('the swap changes white text on sage and leaves other colours alone', () => {
  assert.equal(swap('.b { background: var(--sage); color: #fff; }'), '.b { background: var(--sage); color: var(--on-sage); }');
  assert.equal(swap('.b {\n  background: var(--amber);\n  color: white;\n}'), '.b {\n  background: var(--amber);\n  color: var(--on-sage);\n}');
  assert.equal(swap('<a style="background: var(--sage); color: var(--card);">x</a>'), '<a style="background: var(--sage); color: var(--on-sage);">x</a>');
  assert.equal(swap('.b { background: var(--card); color: #fff; }'), '.b { background: var(--card); color: #fff; }', 'a non-sage fill is untouched');
  assert.equal(swap('.b { background: var(--sage); border-color: #fff; }'), '.b { background: var(--sage); border-color: #fff; }', 'only the text colour changes');
});

test('the mark, sparklines and unstyled links follow the tokens', () => {
  assert.match(tokens, /\.brand-mark path \{ stroke: var\(--ink\); \}/);
  assert.match(tokens, /polyline\[stroke="#2B2620"\] \{ stroke: var\(--ink\); \}/);
  assert.match(tokens, /a:where\(:not\(\[class\]\)\) \{ color: var\(--sage\); \}/);
});

test('the footer and the hub use tokens, not day-theme hex values', () => {
  const footer = read('site-footer.js');
  assert.doesNotMatch(footer, /#5A5145|#2B2620|#D9CBB0/);
  assert.match(footer, /var\(--ink-2/);
  assert.doesNotMatch(read('hub.html'), /background: #fff;|#f2f9f3/);
});

test('the checks run in night mode with their own baseline, and the text-node diff is wired for green-lane PRs', () => {
  const y = read('.github/workflows/brand-checks.yml');
  assert.match(y, /brand-checks\.mjs --dark/);
  assert.match(y, /text-node-diff\.mjs/);
  assert.match(y, /green-lane/);
  const dark = JSON.parse(read('scripts/brand-checks-baseline-dark.json'));
  assert.equal(dark.mode, 'dark');
  for (const [k, v] of Object.entries(dark.surfaces)) assert.ok(!('contrast' in v), `${k}: night contrast must be zero, not baselined`);
  assert.match(read('scripts/brand-checks.mjs'), /colorScheme: dark \? 'dark' : 'light'/);
});

test('the text-node diff reports added and removed lines and ignores spacing and order', async () => {
  const { diffText } = await import('../scripts/text-node-diff.mjs');
  assert.deepEqual(diffText('A\nB\n', '  B \nA'), { removed: [], added: [] });
  assert.deepEqual(diffText('Book now\nKeep', 'View fare\nKeep'), { removed: ['Book now'], added: ['View fare'] });
});
