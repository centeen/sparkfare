// K-B1: writes the shared header (src/siteHeader.js) into every static page, both generators and the Worker templates.
// Idempotent: run it again and nothing changes. Usage: node scripts/apply-shared-header.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { SITE_NAV_HTML } from '../src/siteHeader.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const check = process.argv.includes('--check');
const SKIP = new Set(['node_modules', 'scratch', '.git', '.claude', 'claude', 'docs', 'tests', 'brand', 'tmp']);
let changed = 0;

function write(file, next, prev) {
  if (next === prev) return;
  changed++;
  if (!check) fs.writeFileSync(file, next);
  else console.log('would change', path.relative(ROOT, file));
}
const eolOf = (s) => (/\r\n/.test(s) ? '\r\n' : '\n');
const fragFor = (s) => SITE_NAV_HTML.replace(/\r?\n/g, eolOf(s));

// A page's nav is "<nav class="site-nav"...>...</nav>" plus, once applied, the header stylesheet link and script that follow it.
const NAV_RE = /<nav class="site-nav[^"]*"[^>]*>[\s\S]*?<\/nav>(?:\s*<link rel="stylesheet" href="\/brand\/header\.css">\s*<script src="\/brand\/header\.js"><\/script>)?/;
const HEADER_TOP_RE = /<div class="header-top">[\s\S]*?<\/nav>\s*<\/div>/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

// 1. static pages
for (const f of walk(ROOT)) {
  const s = fs.readFileSync(f, 'utf8');
  if (path.basename(f) === 'index.html' && path.dirname(f) === ROOT) {
    if (HEADER_TOP_RE.test(s)) write(f, s.replace(HEADER_TOP_RE, () => fragFor(s)), s);
    else if (NAV_RE.test(s)) write(f, s.replace(NAV_RE, () => fragFor(s)), s);
    continue;
  }
  if (!NAV_RE.test(s)) continue;
  write(f, s.replace(NAV_RE, () => fragFor(s)), s);
}

// 2. generators: the nav becomes {SITE_NAV_HTML}, read from brand/header.html at run time
const PY_HEAD = "SITE_NAV_HTML = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brand', 'header.html'), encoding='utf-8').read()\n";
for (const name of ['Phase 17 pSEO Generator (Step 106).py', 'Phase 20 Blog Generator.py']) {
  const f = path.join(ROOT, name);
  let s = fs.readFileSync(f, 'utf8');
  const prev = s;
  s = s.replace(/<nav class="site-nav">[\s\S]*?<\/nav>/g, '{SITE_NAV_HTML}');
  if (!s.includes('SITE_NAV_HTML = ')) {
    const m = s.match(/^(import os[^\n]*\n|from [^\n]*\n|import [^\n]*\n)+/m);
    const at = m ? m.index + m[0].length : 0;
    if (!/^import os\b/m.test(s)) s = s.slice(0, at) + 'import os\n' + s.slice(at);
    const m2 = s.match(/^(import [^\n]*\n|from [^\n]*\n)+/m);
    const at2 = m2.index + m2[0].length;
    s = s.slice(0, at2) + PY_HEAD + s.slice(at2);
  }
  write(f, s, prev);
}

// 3. Worker templates: the nav string comes from src/siteHeader.js
{
  const f = path.join(ROOT, 'src/index.js');
  let s = fs.readFileSync(f, 'utf8'); const prev = s;
  s = s.replace(/<nav class="site-nav">[\s\S]*?<\/nav>/g, '${SITE_NAV_HTML}');
  if (!s.includes("from './siteHeader.js'")) s = s.replace(/^(import [^\n]*\n)/m, "$1import { SITE_NAV_HTML } from './siteHeader.js';\n");
  write(f, s, prev);
  const g = path.join(ROOT, 'src/ptoPages.js');
  let p = fs.readFileSync(g, 'utf8'); const prevP = p;
  p = p.replace(/const NAV = `<nav class="site-nav">[\s\S]*?<\/nav>`;/, 'const NAV = SITE_NAV_HTML;');
  if (!p.includes("from './siteHeader.js'")) p = p.replace(/^(import [^\n]*\n)/m, "$1import { SITE_NAV_HTML } from './siteHeader.js';\n");
  write(g, p, prevP);
}

// 4. the plain file generators read
const html = path.join(ROOT, 'brand/header.html');
const frag = SITE_NAV_HTML + '\n';
if (!fs.existsSync(html) || fs.readFileSync(html, 'utf8') !== frag) { changed++; if (!check) fs.writeFileSync(html, frag); }

console.log(check ? `${changed} file(s) differ` : `${changed} file(s) written`);
if (check && changed) process.exit(1);
