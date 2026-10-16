// Owner report 2026-10-16: the Clerk card overflowed its container on /sign-in (Clerk sizes its own card box and padding,
// ignoring the box it is mounted in). Layout only: every layer fills the container and never exceeds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../sign-in.html', import.meta.url), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const rule = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `rule for ${selector}`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
};

test('the viewport meta tag is set and box-sizing is border-box everywhere', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1.0"/);
  assert.match(css, /\*\s*\{\s*box-sizing:\s*border-box;?\s*\}/);
});

test('the mount node and Clerk\'s card layers fill the container and never exceed it', () => {
  const root = rule('#clerk-root');
  assert.match(root, /width:\s*100%/);
  assert.match(root, /max-width:\s*100%/);
  assert.match(root, /min-width:\s*0/);
  const layers = css.match(/#clerk-root \.cl-cardBox,\s*#clerk-root \.cl-card\s*\{([^}]*)\}/);
  assert.ok(layers, 'cardBox/card rule');
  assert.match(layers[1], /width:\s*100%/);
  assert.match(layers[1], /max-width:\s*100%/);
  assert.match(layers[1], /min-width:\s*0/);
  assert.match(layers[1], /box-sizing:\s*border-box/);
});

test('no fixed pixel width or min-width on the modal, mount node or Clerk layers', () => {
  const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel]) => /modal-card|clerk-root|cl-card/.test(sel));
  for (const [, sel, body] of blocks) {
    assert.doesNotMatch(body, /(^|[;\s])(min-)?width:\s*\d+px/, `fixed width in ${sel.trim()}`);
  }
  assert.match(rule('.modal-card'), /max-width:\s*420px/, 'a max-width (not a width) caps the card');
});

test('on phones the padding is trimmed so the Clerk card has room (the "Last used" badge sits inside it)', () => {
  const media = css.match(/@media \(max-width:\s*480px\)\s*\{([\s\S]*?)\n    \}/);
  assert.ok(media, 'a max-width: 480px block');
  assert.match(media[1], /\.modal-card\s*\{\s*padding:\s*24px 16px 20px/);
  assert.match(media[1], /#clerk-root \.cl-card\s*\{\s*padding:\s*24px 16px/);
});

test('a card taller than the window stays reachable: the fixed backdrop scrolls and the card centres with auto margins', () => {
  const backdrop = rule('.modal-backdrop');
  assert.match(backdrop, /overflow-y:\s*auto/);
  assert.doesNotMatch(backdrop, /align-items:\s*center/, 'align-items: center clips the top of an overflowing flex child');
  assert.match(rule('.modal-card'), /margin:\s*auto/);
});
