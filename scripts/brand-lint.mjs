// K-B10 (ROADMAP step 132): static brand checks that run inside `npm test`.
//  1. Hex lint: only brand/tokens.css may define a colour. Everything else is a per-file ratchet (scripts/brand-baseline.json):
//     a file may not have more hex colour literals than its baseline, and a file with no baseline may have none.
//     Lower the numbers when a file is cleaned up (K-B8 does the emails); never raise one without the owner's say.
//  2. Gold: the brand gold (#E8B930, var(--spark)) may only paint the Deal chip, the mark's dot, and the token itself.
//     The sparkline's end dot is a known exception, counted per file (baseline) until the owner decides.
// Excluded on purpose: tests, docs, scripts, scratch, claude/ and the image-drawing scripts (Phase 3 social card, og image),
// which paint raster images, not pages.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = path.join(ROOT, 'scripts', 'brand-baseline.json');

const EXCLUDE_DIR = /^(tests|docs|scratch|claude|node_modules|\.claude|scripts|tmp)\//;
const EXCLUDE_FILE = /^(brand\/tokens\.css|Phase 3 Social Broadcaster\.py|make_og_default_image\.py)$/;
const EXT = /\.(html|css|js|mjs|py)$/;
// not preceded by a word character or '&' or '/', so anchors (#signup-form, href="#main") and entities do not count
export const HEX_RE = /(?<=[:\s(,"'])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b(?![-\w])/g;
// Email builders define their own palettes (K-B8 moves them to the tokens). Their gold is counted per file until then.
export const GOLD_DEFERRED = new Set(['src/emailTemplates/dailyDigest.js', 'src/postClickEmail.js']);
const GOLD_RE = /#E8B930|var\(--spark\)/gi;

export function trackedFiles(root = ROOT) {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter((f) => EXT.test(f) && !EXCLUDE_DIR.test(f) && !EXCLUDE_FILE.test(f));
}

// Key used in the baseline: generated page families share one number (the largest in the family).
export function baselineKey(file) {
  if (/^data\/[^/]+\.html$/.test(file)) return 'data/*.html';
  if (/^blog\/[^/]+\.html$/.test(file)) return 'blog/*.html';
  return file;
}

export function countHex(text) { return (text.match(HEX_RE) || []).length; }

// Classify each gold use in a file's text. Returns { mark, chip, token, sparkline_dot, other: [lines] }.
export function classifyGold(text) {
  const out = { mark: 0, chip: 0, token: 0, sparkline_dot: 0, other: [] };
  const lines = text.split(/\r?\n/);
  // the CSS selector a line belongs to: the last "{"-opening text before it on this or an earlier line
  lines.forEach((line, i) => {
    const hits = line.match(GOLD_RE);
    if (!hits) return;
    for (const _ of hits) {
      if (/<circle[^>]*\br="3\.5"/.test(line)) out.mark++;                       // the mark's dot (header, 404, templates)
      else if (/--spark\s*:/.test(line)) out.token++;                            // the token definition
      else if (/<circle[^>]*\br="(?:2|2\.5)"/.test(line) || /fill="var\(--spark\)"/.test(line)) out.sparkline_dot++;
      else {
        let sel = line.includes('{') ? line.split('{')[0] : '';
        for (let j = i - 1; !sel && j >= 0 && j > i - 6; j--) { if (lines[j].includes('{')) sel = lines[j].split('{')[0]; }
        if (/chip-deal|badge\.deal|\.deal\b|deal-chip/.test(sel)) out.chip++;
        else out.other.push(`${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    }
  });
  return out;
}

export function scanRepo(root = ROOT) {
  const hex = {}; const gold = {}; const goldOther = []; const deferred = {};
  for (const f of trackedFiles(root)) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    const key = baselineKey(f);
    const n = countHex(text);
    if (n) hex[key] = Math.max(hex[key] || 0, n);
    const g = classifyGold(text);
    if (g.sparkline_dot) gold[key] = Math.max(gold[key] || 0, g.sparkline_dot);
    if (GOLD_DEFERRED.has(f)) { if (g.other.length) deferred[f] = g.other.length; continue; }
    for (const o of g.other) goldOther.push(`${f}:${o}`);
  }
  return { hex, sparklineDots: gold, goldOther, deferredGold: deferred };
}

export function compare(scan, baseline) {
  const problems = [];
  for (const [k, n] of Object.entries(scan.hex)) {
    const allowed = (baseline.hex || {})[k] ?? 0;
    if (n > allowed) problems.push(`hex: ${k} has ${n} colour literal(s), baseline ${allowed}. Use a token from brand/tokens.css.`);
  }
  for (const [k, n] of Object.entries(scan.sparklineDots)) {
    const allowed = (baseline.sparklineDots || {})[k] ?? 0;
    if (n > allowed) problems.push(`gold: ${k} has ${n} sparkline dot(s) painted gold, baseline ${allowed}.`);
  }
  for (const [k, n] of Object.entries(scan.deferredGold || {})) {
    const allowed = (baseline.deferredGold || {})[k] ?? 0;
    if (n > allowed) problems.push(`gold: ${k} has ${n} gold use(s) outside the tokens, baseline ${allowed} (emails move to tokens in K-B8).`);
  }
  for (const o of scan.goldOther) problems.push(`gold: ${o} (gold may only paint the Deal chip, the mark and the token)`);
  return problems;
}

export function loadBaseline() { return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scan = scanRepo();
  if (process.argv.includes('--write-baseline')) {
    const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
    const out = { note: 'K-B10 ratchet. Numbers may only go down. See scripts/brand-lint.mjs.', hex: sorted(scan.hex), sparklineDots: sorted(scan.sparklineDots), deferredGold: sorted(scan.deferredGold) };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n');
    console.log('baseline written:', Object.keys(out.hex).length, 'files with hex,', Object.keys(out.sparklineDots).length, 'with sparkline dots');
  } else {
    const problems = compare(scan, loadBaseline());
    if (problems.length) { console.error('Brand lint failed:\n  ' + problems.join('\n  ')); process.exit(1); }
    console.log('Brand lint passed.');
  }
}
