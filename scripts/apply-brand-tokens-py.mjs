#!/usr/bin/env node
// K-A1a: the same rewrite as apply-brand-tokens.mjs, for the CSS that lives inside the Python page generators' f-strings
// (where a literal brace is written `{{` and `}}`). Only the text between <style> and </style> is touched.
//   node scripts/apply-brand-tokens-py.mjs "<generator.py>" ...
import fs from 'node:fs';
import { cssTransform } from './apply-brand-tokens.mjs';

const LINKS = '<link rel="stylesheet" href="/brand/tokens.css">\n<link rel="stylesheet" href="/brand/fonts.css">\n';

export function transformPy(src) {
  return src.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, body, close) => {
    const plain = body.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
    const done = cssTransform(plain).replace(/\{/g, '{{').replace(/\}/g, '}}');
    const prefix = src.slice(Math.max(0, src.indexOf(m) - 120), src.indexOf(m)).includes('/brand/tokens.css') ? '' : LINKS;
    return prefix + open + done + close;
  });
}

if (process.argv[1]?.endsWith('apply-brand-tokens-py.mjs')) {
  for (const file of process.argv.slice(2)) {
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    const before = raw.replace(/\r\n/g, '\n');
    const after = transformPy(before);
    if (after !== before) fs.writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after);
    console.log(file, after !== before ? 'rewritten' : 'unchanged');
  }
}
