// K-B8 (ROADMAP step 132, scan S-1): the sign-in page. Clerk's colours, font and radius come from the brand tokens; the Sparkfare card is the only box
// (Clerk's own card loses its fill, border, shadow and padding); there is a way back to the site; and the page has one H1 once Clerk's card has mounted.
// The page's own functions are run here against fakes. Clerk's real widget cannot be mounted outside sparkfare.com, so its class names were read from the
// live page (cl-card, cl-cardBox, cl-footer, h1.cl-headerTitle) and the rules below are written against those.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../sign-in.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tokens = fs.readFileSync(new URL('../brand/tokens.css', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const grab = (re) => script.match(re)[0];
const code = [grab(/function clerkVariables\(styles\) \{[\s\S]*?\n    \}\n/), grab(/function demoteOurHeading\(doc\) \{[\s\S]*?\n    \}\n/)].join('\n');
const page = vm.runInNewContext(`${code}\n;({ clerkVariables, demoteOurHeading })`);
const tok = (name) => tokens.slice(0, tokens.indexOf('/* Spacing */')).match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))[1];

test('Clerk variables are the brand tokens, read from the page; a token that cannot be read is left out so Clerk keeps its own default', () => {
  const tokenValues = { '--sage': ' #7FBF93 ', '--ink': '#F2EADB' }; // a night page: some tokens present, others missing
  const v = page.clerkVariables({ getPropertyValue: (n) => tokenValues[n] || '' });
  assert.equal(v.colorPrimary, '#7FBF93');
  assert.equal(v.colorText, '#F2EADB');
  assert.ok(!('colorBackground' in v) && !('colorDanger' in v), 'unreadable tokens are omitted, not guessed');
  const all = page.clerkVariables({ getPropertyValue: (n) => ({ '--sage': tok('sage'), '--ink': tok('ink'), '--ink-2': tok('ink-2'), '--card': tok('card'), '--clay': tok('clay'), '--on-sage': '#FFFFFF' }[n] || '') });
  assert.equal(all.colorPrimary, tok('sage'));
  assert.equal(all.colorBackground, tok('card'));
  assert.equal(all.colorInputBackground, tok('card'));
  assert.equal(all.colorTextSecondary, tok('ink-2'));
  assert.equal(all.colorDanger, tok('clay'));
  assert.equal(all.colorTextOnPrimaryBackground, '#FFFFFF');
  assert.match(all.fontFamily, /^Inter,/);
  assert.equal(all.borderRadius, '6px');
  const bare = page.clerkVariables(null);
  assert.deepEqual(Object.keys(bare).sort(), ['borderRadius', 'fontFamily']);
});

function fakeDoc({ ours = 'H1', clerkH1 = false } = {}) {
  const state = { replaced: null };
  const node = { tagName: ours, id: 'page-heading', textContent: 'Welcome back to Sparkfare', replaceWith(n) { state.replaced = n; } };
  const doc = {
    getElementById: (id) => (id === 'page-heading' ? node : null),
    querySelector: (sel) => (sel === '#clerk-root h1' && clerkH1 ? {} : null),
    createElement: (tag) => ({ tag, id: '', className: '', textContent: '' }),
  };
  return { doc, state };
}

test('once Clerk\'s own H1 exists, our heading becomes a small line (same text, same id); before that it stays the H1', () => {
  const before = fakeDoc({ clerkH1: false });
  assert.equal(page.demoteOurHeading(before.doc), false);
  assert.equal(before.state.replaced, null, 'ours stays the H1 when Clerk has not mounted');
  const after = fakeDoc({ clerkH1: true });
  assert.equal(page.demoteOurHeading(after.doc), true);
  assert.deepEqual({ ...after.state.replaced }, { tag: 'p', id: 'page-heading', className: 'eyebrow', textContent: 'Welcome back to Sparkfare' });
  const already = fakeDoc({ ours: 'P', clerkH1: true });
  assert.equal(page.demoteOurHeading(already.doc), false);
});

test('the page ships with one H1 and a back link to the site', () => {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  assert.equal((body.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(body, /<h1 id="page-heading">Welcome back to Sparkfare<\/h1>/);
  assert.match(body, /<p class="back-link"><a href="\/">Back to Sparkfare<\/a><\/p>/);
  assert.match(html, /\.back-link a \{[^}]*display: inline-block; padding: 10px 8px;/);
});

test('mount: variables from the tokens, a MutationObserver that demotes our heading, and no per-element fills left in the appearance', () => {
  assert.match(script, /variables: clerkVariables\(getComputedStyle\(document\.documentElement\)\),/);
  assert.match(script, /new MutationObserver\(\(records, observer\) => \{ if \(demoteOurHeading\(document\)\) observer\.disconnect\(\); \}\)/);
  assert.match(script, /\.observe\(document\.getElementById\('clerk-root'\), \{ childList: true, subtree: true \}\)/);
  assert.match(script, /subtree: true \}\);\s*demoteOurHeading\(document\);/, 'a check right after observing covers a card that rendered first');
  const appearance = script.slice(script.indexOf('appearance: {'), script.indexOf('} catch (error)'));
  assert.doesNotMatch(appearance, /border: 1px solid|border-radius: 8px|background: var\(--card\)/);
});

test('one card: Clerk\'s card, card box and footer lose fill, border and shadow, the card loses its padding, and the Clerk footer stays visible', () => {
  const rule = html.match(/#clerk-root \.cl-cardBox,\s*#clerk-root \.cl-card,\s*#clerk-root \.cl-footer \{([^}]*)\}/)[1];
  assert.match(rule, /background: transparent;/);
  assert.match(rule, /border: 0;/);
  assert.match(rule, /box-shadow: none;/);
  assert.match(html, /#clerk-root \.cl-card \{ padding: 0; \}/);
  for (const [, body] of html.matchAll(/#clerk-root \.cl-card\s*\{([^}]*)\}/g)) assert.doesNotMatch(body, /(^|[;\s])border(-[a-z]+)?\s*:|box-shadow|background/, 'no later rule gives the Clerk card a box again');
  assert.doesNotMatch(html, /\.cl-footer[^{]*\{[^}]*display:\s*none/);
  assert.doesNotMatch(html, /cl-internal|cl-footerAction|cl-badge/, 'nothing hides Clerk attribution');
  assert.ok(!/#[0-9A-Fa-f]{6}\b/.test(html), 'no hex colour anywhere in the page, script included');
});
