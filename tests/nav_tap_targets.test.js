// The nav links on content pages measured about 22px tall on a phone. WCAG 2.5.8 sets a 24px minimum
// and 44px is the comfortable size. Every page's nav gets one phone-width rule that pads the links,
// and the same rule lives in each template so regenerated pages keep it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MARK = '/* nav tap targets */';
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const tracked = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' })
  .split('\n').filter(Boolean);

test('every tracked page with a site nav carries the tap-target rule', () => {
  const navPages = tracked.filter((f) => read(f).includes('class="site-nav"'));
  assert.ok(navPages.length > 600, 'expected hundreds of nav pages, found ' + navPages.length);
  const missing = navPages.filter((f) => !read(f).includes(MARK));
  assert.deepEqual(missing, []);
});

test('the rule pads links to at least 10px each side on phones and drops the row gap', () => {
  const html = read('away-mode.html');
  const rule = html.match(/\/\* nav tap targets \*\/ @media \(max-width: 768px\) \{([^\n]*)\}\s*$/m);
  assert.ok(rule, 'rule found');
  const pad = rule[1].match(/padding:\s*(\d+)px 0/);
  assert.ok(pad && Number(pad[1]) >= 10, 'vertical padding >= 10px');
  assert.match(rule[1], /\.site-nav \{ gap: 0 18px; \}/, 'wrapped rows do not add their own gap');
});

test('the Worker templates and both generators emit the rule next to every .site-nav a rule', () => {
  const count = (s, re) => (s.match(re) || []).length;
  const js = read('src/index.js');
  assert.equal(count(js, /\.site-nav a \{ color:/g), count(js, /\/\* nav tap targets \*\//g));
  assert.ok(count(js, /\/\* nav tap targets \*\//g) >= 2);
  for (const f of ['Phase 17 pSEO Generator (Step 106).py', 'Phase 20 Blog Generator.py']) {
    const py = read(f);
    const rules = count(py, /\.site-nav a \{\{ color:/g);
    assert.ok(rules >= 1, f + ' has a nav rule');
    assert.equal(count(py, /\/\* nav tap targets \*\//g), rules, f);
    // f-string braces must be doubled so the rendered CSS matches the static pages
    assert.ok(py.includes('@media (max-width: 768px) {{ .site-nav {{ gap: 0 18px; }}'), f);
  }
});

test('the homepage hamburger menu pads its links and removes the column gap', () => {
  const home = read('index.html');
  assert.ok(home.includes(MARK + ' .site-nav a { display: block; padding: 11px 0; }'));
  assert.ok(/margin-top: 10px; gap: 0; \}/.test(home), 'column gap replaced by link padding');
});
