#!/usr/bin/env node
// K-A5 (ROADMAP step 123, Addendum J4): one <main> landmark and a skip link on every page; a 13px floor on font sizes.
//   node scripts/apply-structure.mjs <files...>
// For each file, every `<div class="wrap">` (the page container all of Sparkfare's pages use) gets a <main id="main"> that starts after the
// header or navigation and ends where the container ends, found by counting <div> depth (comments and script/style bodies are skipped).
// A skip link ("Skip to content") is added as the first thing in <body>. Idempotent. Works on HTML, on the Python generators (f-strings) and
// on the Worker's template strings, because it only reads and inserts plain tags. It changes no text other than the skip link.
import fs from 'node:fs';

const SKIP = '<a class="skip-link" href="#main">Skip to content</a>';
const SKIP_PY = SKIP; // no braces, so safe in an f-string

// Index just past the tag that closes the <div> opened at `open` (the index of '<div'); -1 if unbalanced.
export function matchingDivClose(s, open) {
  const re = /<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<(\/?)div\b[^>]*>/gi;
  re.lastIndex = open;
  let depth = 0;
  for (let m; (m = re.exec(s));) {
    if (!m[0].toLowerCase().startsWith('<div') && !m[0].toLowerCase().startsWith('</div')) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { closeStart: m.index, closeEnd: m.index + m[0].length };
  }
  return -1;
}

// Where <main> starts inside a wrap that opens at `open`: after the first </header> or </nav> that is a direct child region before real content.
function mainStart(s, open, close) {
  const inner = s.slice(open, close);
  const hdr = inner.search(/<\/header>/i);
  const nav = inner.search(/<\/nav>/i);
  let at = -1;
  if (hdr >= 0 && (nav < 0 || hdr > nav || nav - hdr < 0)) at = hdr + '</header>'.length;
  else if (nav >= 0) at = nav + '</nav>'.length;
  return at < 0 ? -1 : open + at;
}

export function addMain(src) {
  let s = src;
  let from = 0;
  for (let guard = 0; guard < 50; guard++) {
    const open = s.indexOf('<div class="wrap">', from);
    if (open < 0) break;
    from = open + 1;
    const end = matchingDivClose(s, open);
    if (end === -1) continue;
    const region = s.slice(open, end.closeStart);
    if (/<main[\s>]/i.test(region)) continue;
    const start = mainStart(s, open, end.closeStart);
    if (start < 0) continue;
    s = s.slice(0, start) + '\n<main id="main">' + s.slice(start, end.closeStart) + '</main>\n' + s.slice(end.closeStart);
  }
  return s;
}

export function addSkipLink(src) {
  // every <body> in the file (a generator or a Worker file holds several templates) that is not already followed by the link
  return src.replace(/(<body[^>]*>)(?!\s*<a class="skip-link")/gi, (m) => `${m}\n${SKIP}`);
}

// font-size declarations below 13px become 13px (0.8125rem); px, rem and em values are all handled.
export function floorFontSizes(css) {
  return css.replace(/font-size\s*:\s*([0-9.]+)(px|rem|em)\b/gi, (m, n, unit) => {
    const px = unit === 'px' ? +n : +n * 16;
    return px < 13 ? 'font-size: 0.8125rem' : m;
  });
}

export function transform(src, { floor = true } = {}) {
  let s = addSkipLink(addMain(src));
  if (floor) s = s.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, body, c) => a + floorFontSizes(body) + c).replace(/(\sstyle=")([^"]*)(")/g, (m, a, body, c) => a + floorFontSizes(body) + c);
  return s;
}

if (process.argv[1]?.endsWith('apply-structure.mjs')) {
  let changed = 0;
  for (const file of process.argv.slice(2)) {
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    const before = raw.replace(/\r\n/g, '\n');
    const after = transform(before);
    if (after !== before) { fs.writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after); changed += 1; }
  }
  console.log(`rewrote ${changed} of ${process.argv.length - 2} files`);
}
