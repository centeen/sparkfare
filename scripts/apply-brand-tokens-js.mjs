#!/usr/bin/env node
// K-A1a: the same rewrite for HTML that lives in the Worker's template strings (src/*.js, src/*.html). Every <style> block gets the same
// CSS rewrite; every block that has no brand link in front of it gets the two stylesheet links.
//   node scripts/apply-brand-tokens-js.mjs src/index.js ...
import fs from 'node:fs';
import { cssTransform } from './apply-brand-tokens.mjs';

const LINKS = '<link rel="stylesheet" href="/brand/tokens.css">\n<link rel="stylesheet" href="/brand/fonts.css">\n';

export function transformJs(src) {
  let s = src.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, body, c) => a + cssTransform(body) + c);
  s = s.replace(/[ \t]*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '');
  let out = '';
  let last = 0;
  for (const m of s.matchAll(/<style[ >]/g)) {
    out += s.slice(last, m.index);
    if (!s.slice(Math.max(0, m.index - 120), m.index).includes('/brand/tokens.css')) out += LINKS;
    last = m.index;
  }
  return out + s.slice(last);
}

if (process.argv[1]?.endsWith('apply-brand-tokens-js.mjs')) {
  for (const file of process.argv.slice(2)) {
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    const before = raw.replace(/\r\n/g, '\n');
    const after = transformJs(before);
    if (after !== before) fs.writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after);
    console.log(file, after !== before ? 'rewritten' : 'unchanged');
  }
}
