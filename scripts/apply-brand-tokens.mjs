#!/usr/bin/env node
// K-A1a (ROADMAP step 119): moves a page from its own copy of the palette and font stack onto brand/tokens.css and brand/fonts.css.
//   node scripts/apply-brand-tokens.mjs <file...>        rewrites the files in place
// For each file: removes the page's own `:root { ... }` colour block, adds the two stylesheet links before the first <style>, points every
// font-family at a token, and replaces known old palette hex values with the token that now holds them. It is idempotent.
// It changes no text, link, flag or script. CSS rules are rewritten only inside <style> blocks and style="..." attributes; fill="#..."
// attributes, meta colours and script strings are left as they were. Anything it cannot map is left alone and printed.
import fs from 'node:fs';

const LINKS = '<link rel="stylesheet" href="/brand/tokens.css">\n<link rel="stylesheet" href="/brand/fonts.css">\n';
export const HEX_TO_TOKEN = {
  '#E8DCC5': 'var(--paper)', '#FAF6EE': 'var(--card)', '#D9CBB0': 'var(--line)', '#B8720F': 'var(--spark-ink)', '#4F7A52': 'var(--sage)',
  '#2E2318': 'var(--ink)', '#6B5A45': 'var(--ink-2)', '#605142': 'var(--ink-2)', '#F3EBDA': 'var(--paper-deep)', '#3F6442': 'var(--sage-dark)',
  '#EDE6D6': 'var(--paper)', '#E3D9C4': 'var(--paper-deep)', '#2B2620': 'var(--ink)', '#6B6255': 'var(--ink-2)', '#DCD3BF': 'var(--line)',
  '#E8B930': 'var(--spark)',
};
const LEGACY_ROOT = /--(sand|card|border|amber|sage|text|muted|paper|ledger|line)\b/;

export function fontToken(decl) {
  if (/Space Grotesk/i.test(decl)) return 'var(--font-display)';
  if (/mono|courier/i.test(decl)) return 'var(--font-mono)';
  return 'var(--font-body)';
}

// Applies fn only to CSS: the inside of <style> blocks and style="..." attributes.
export function inCss(s, fn) {
  return s
    .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, body, c) => a + fn(body) + c)
    .replace(/(\sstyle=")([^"]*)(")/g, (m, a, body, c) => a + fn(body) + c);
}

export function cssTransform(css) {
  let s = css;
  // the page's own :root block, only when it defines the legacy palette names
  s = s.replace(/[ \t]*:root\s*\{[^}]*\}\n?/g, (m) => (LEGACY_ROOT.test(m) ? '' : m));
  // font-family declarations naming a real family; inherit and var() are left alone
  s = s.replace(/font-family\s*:\s*([^;}\n]+?)\s*(?=[;}\n])/g, (m, value) => (/^(inherit|initial|unset)$/i.test(value) || /^var\(/.test(value) ? m : `font-family: ${fontToken(value)}`));
  // old palette hex values
  s = s.replace(/#[0-9A-Fa-f]{6}\b/g, (hex) => HEX_TO_TOKEN[hex.toUpperCase()] || hex);
  // the external font host's @import goes (fonts are self-hosted)
  s = s.replace(/[ \t]*@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);\n?/g, '');
  return s;
}

export function transform(src) {
  let s = inCss(src, cssTransform);
  s = s.replace(/[ \t]*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '');
  if (!s.includes('/brand/tokens.css')) {
    const i = s.search(/<style[ >]/);
    s = i >= 0 ? s.slice(0, i) + LINKS + s.slice(i) : s.replace('</head>', LINKS + '</head>');
  }
  return s;
}

if (process.argv[1]?.endsWith('apply-brand-tokens.mjs')) {
  let changed = 0;
  const leftover = new Map();
  for (const file of process.argv.slice(2)) {
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    const before = raw.replace(/\r\n/g, '\n');
    const after = transform(before);
    if (after !== before) { fs.writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after); changed += 1; }
    for (const hex of after.match(/#[0-9A-Fa-f]{6}\b/g) || []) leftover.set(hex.toUpperCase(), (leftover.get(hex.toUpperCase()) || 0) + 1);
  }
  console.log(`rewrote ${changed} of ${process.argv.length - 2} files`);
  if (leftover.size) console.log('hex values left:', [...leftover].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h} x${n}`).join(', '));
}
