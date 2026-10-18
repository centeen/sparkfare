// K-B6: text on a sage fill uses --on-sage (white in the day theme, near-black in the night theme, where sage is light).
// Finds CSS rules and style attributes that paint "background: var(--sage)" and swaps a white-ish "color:" in the same
// block for var(--on-sage). Idempotent. Usage: node scripts/apply-night-sage.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const check = process.argv.includes('--check');
const SKIP = /^(tests|docs|scratch|claude|node_modules|\.claude|scripts|tmp|brand)\//;
const BG = /background(?:-color)?:\s*var\(--sage\)/;
const WHITE = /(?<![-\w])color:(\s*)(?:#fff(?:fff)?|#FFF(?:FFF)?|white|var\(--card\))(?![-\w])/g;
let changed = 0;

export function swap(text) {
  const fix = (block) => (BG.test(block) ? block.replace(WHITE, (m, sp) => `color:${sp}var(--on-sage)`) : block);
  let out = text.replace(/\{[^{}]*\}/g, fix);
  out = out.replace(/style="[^"]*"/g, fix);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => /\.(html|js|py)$/.test(f) && !SKIP.test(f));
  for (const f of files) {
    const p = path.join(ROOT, f); const s = fs.readFileSync(p, 'utf8'); const n = swap(s);
    if (n !== s) { changed++; if (!check) fs.writeFileSync(p, n); else console.log('would change', f); }
  }
  console.log(check ? `${changed} file(s) differ` : `${changed} file(s) written`);
  if (check && changed) process.exit(1);
}
