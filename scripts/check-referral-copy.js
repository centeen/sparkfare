#!/usr/bin/env node
// Referral-positioning copy guard (decision logged 2026-10-07).
//
// Sparkfare publishes fare information and sends people to the booking site; it does not sell,
// book, ticket, arrange or take payment for travel. This script scans user-facing files for
// wording that says otherwise and exits non-zero on a match, so the copy cannot drift back.
//
//   node scripts/check-referral-copy.js          scan the repo
//
// What is scanned: HTML pages (root, blog/, data/, src/*.html) and the rendered strings in
// src/**/*.js. JS comments are stripped first, so comments and code identifiers (`booking_link`,
// `bookingLink`, `reconcileBookings`) never match. Phrases that are fine are listed in
// scripts/referral-copy-allowlist.json: `allowedPhrases` are removed from a line before matching
// (the "Allowed" patterns from the task), and `exceptions` pin a specific known-harmless line
// (a travel-medical "locked in place", a dinner reservation) by file and text.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Each rule: id, regex, and what it protects. Case-insensitive unless noted.
export const BANNED = [
  { id: 'book-now', re: /\bbook now\b/i },
  { id: 'book-this-fare', re: /\bbook this fare\b/i },
  { id: 'book-flight-button', re: /\bbook flight\b/i },
  { id: 'bare-book-button', re: />\s*Book\s*</ },
  { id: 'bare-book-label', re: /(['"`])Book\1/ },
  { id: 'continue-to-flight-booking', re: /\bcontinue to flight booking\b/i },
  { id: 'book-your-flight', re: /\bbook your flight\b/i },
  { id: 'book-with-us', re: /\bbook with us\b/i },
  { id: 'we-book', re: /\bwe(?:'ll| will)? book\b/i },
  { id: 'we-arrange', re: /\bwe arrange\b/i },
  { id: 'found-you-a-trip', re: /\bwe found you a trip\b/i },
  { id: 'booked-for-you', re: /\bbooked for you\b/i },
  { id: 'secured', re: /\bsecured\b/i },
  { id: 'locked-in', re: /\blocked in\b/i },
  { id: 'reserve', re: /\breserv(?:e|es|ation|ations)\b/i },
  { id: 'sparkfare-booking', re: /\bsparkfare booking\b/i },
  { id: 'your-booking', re: /\byour booking\b/i },
  { id: 'booking-confirmed', re: /\bbooking confirmed\b/i },
  // Step 97 (D-018, 2026-10-18): naming the booking site is kept to the handoff, the disclosures and the footer. Case-sensitive, so
  // code identifiers (isAviasalesLink, AVIASALES_CAMPAIGN_ID) and hostnames never match. Ratcheted per file in the allowlist's
  // `baselines['aviasales-mention']`: a file over its number, or a file with no number, fails with every hit listed.
  { id: 'aviasales-mention', re: /\bAviasales\b/, visibleOnly: true },
  // Facts only, never a legal status or a named jurisdiction.
  { id: 'seller-of-travel', re: /\bseller of travel\b/i },
  { id: 'travel-agency', re: /\btravel agency\b/i },
  { id: 'licensed', re: /\blicensed\b/i },
  { id: 'exempt', re: /\bexempt\b/i },
  { id: 'registered-state', re: /\b(california|florida|hawaii)\b/i },
  // Step 4 of the 2026-10-14 wording scope: the bare words, in visible text only (URLs, hrefs and slugs are stripped from the
  // probe first, see stripUrlTokens). Statements of what Sparkfare does NOT do, and descriptive uses, are allowlisted by phrase
  // or pinned as exceptions with a reason in scripts/referral-copy-allowlist.json.
  { id: 'secure-word', re: /\bsecure[sd]?\b/i, visibleOnly: true },
  { id: 'book-word', re: /\bbook(?:s|ed|ing|ings)?\b/i, visibleOnly: true },
  { id: 'lock-in-down', re: /\block(?:s|ed|ing)?[ -](?:in|down)\b/i, visibleOnly: true },
  // K-A3 (ROADMAP step 121): Brand v1 section 5.4 banned list. No false urgency, no hype, no claim of speed or a record.
  { id: 'brand-urgency', re: /\b(hurry|last chance|act now|limited time|prices will rise|only \d+ left|move fast)\b/i, visibleOnly: true },
  { id: 'brand-hype', re: /\b(steals?|insane|guaranteed|lowest ever|hacks?|vanish(?:es|ed|ing)?|save \$\d*)\b/i, visibleOnly: true },
  { id: 'brand-speed', re: /\b(instantly|the moment)\b/i, visibleOnly: true },
  { id: 'brand-live-claim', re: /\blive[- ](?:price|prices|fare|fares|deal|deals|checked)\b|\blive\b[^.<]{0,20}\bprices?\b/i, visibleOnly: true },
];

// URLs, href/src values and site paths are not copy: "/blog/why-book-through-us-first" is a slug, not wording.
export function stripUrlTokens(line) {
  return line
    .replace(/(?:href|src|action|class|id|data-[a-z-]+)=("[^"]*"|'[^']*')/gi, ' ')
    // CSS selectors and classes such as .book-link, .badge.booked, #book-btn, and the JS hook name track-booking.
    .replace(/[.#][a-z0-9_-]*(?:book|secure|lock)[a-z0-9_-]*/gi, ' ')
    .replace(/\btrack-booking\b/gi, ' ')
    .replace(/https?:\/\/[^\s"'<>)]+/gi, ' ')
    .replace(/(?:^|[\s"'(=])\/[a-z0-9_./?&=%-]*(?:book|secure|lock)[a-z0-9_./?&=%-]*/gi, ' ');
}

const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'referral-copy-allowlist.json');

export function loadAllowlist(file = ALLOWLIST_PATH) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    allowedPhrases: (raw.allowedPhrases || []).map((p) => new RegExp(p, 'gi')),
    exceptions: raw.exceptions || [],
    baselines: raw.baselines || {},
  };
}

// Removes // and /* */ comments from JS without touching comment-looking text inside strings.
export function stripJsComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function stripHtmlNonCopy(src) {
  // HTML comments and CSS comments are not user-facing text. Inline scripts that build visible
  // strings are still checked, because index.html renders its cards from JS.
  return src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    // Whole-line // comments inside inline <script> blocks.
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

// Ratchet for the bare-word rules in JS: `baselines` maps rule id -> { file: allowed count }. A file at or under its
// baseline reports nothing; over it, every finding of that rule in the file is reported, so a new use cannot hide among
// the pinned ones. Lower a baseline when a use is removed.
export function applyBaselines(results, baselines = {}) {
  const counts = new Map();
  for (const r of results) {
    const key = `${r.id}\u0000${r.file}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return results
    .filter((r) => {
      const allowed = baselines[r.id] && baselines[r.id][r.file];
      if (allowed === undefined) return true;
      return counts.get(`${r.id}\u0000${r.file}`) > allowed;
    })
    .map((r) => {
      const allowed = baselines[r.id] && baselines[r.id][r.file];
      return allowed === undefined ? r : { ...r, text: `${r.text}  [over baseline of ${allowed} for this file]` };
    });
}

// Returns [{ id, line, text }] for one file's contents.
export function scanText(text, file, allowlist = { allowedPhrases: [], exceptions: [] }, kind = path.extname(file)) {
  const body = kind === '.js' ? stripJsComments(text) : stripHtmlNonCopy(text);
  const findings = [];
  body.split('\n').forEach((line, idx) => {
    let probe = line;
    for (const re of allowlist.allowedPhrases) probe = probe.replace(re, ' ');
    const urlFree = stripUrlTokens(probe);
    for (const rule of BANNED) {
      if (!rule.re.test(rule.visibleOnly ? urlFree : probe)) continue;
      const excused = allowlist.exceptions.some((e) => e.rule === rule.id && file.endsWith(e.file) && line.includes(e.contains));
      if (!excused) findings.push({ id: rule.id, line: idx + 1, text: line.trim().slice(0, 160) });
    }
  });
  return findings;
}

function walk(dir, exts, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(name.name))) out.push(full);
  }
  return out;
}

// The user-facing surface. Not scanned: tests, scripts, docs (*.md), data files (*.json/*.csv),
// the python generators (their output is scanned instead) and the ghost preferences.html.
export function userFacingFiles(root = ROOT) {
  const files = [];
  for (const name of fs.readdirSync(root)) {
    if (name.endsWith('.html') && !name.startsWith('google') && name !== 'preferences.html') files.push(path.join(root, name));
  }
  for (const dir of ['blog', 'data']) {
    if (fs.existsSync(path.join(root, dir))) files.push(...walk(path.join(root, dir), ['.html']));
  }
  files.push(...walk(path.join(root, 'src'), ['.js', '.html']));
  for (const extra of ['site-footer.js', 'nav-auth.js']) {
    if (fs.existsSync(path.join(root, extra))) files.push(path.join(root, extra));
  }
  return files;
}

export function scanRepo(root = ROOT) {
  const allowlist = loadAllowlist();
  const results = [];
  for (const file of userFacingFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const found = scanText(fs.readFileSync(file, 'utf8'), rel, allowlist);
    for (const f of found) results.push({ file: rel, ...f });
  }
  return applyBaselines(results, allowlist.baselines);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = scanRepo();
  if (results.length) {
    console.error(`Referral-copy check failed: ${results.length} match(es)\n`);
    for (const r of results) console.error(`  ${r.file}:${r.line}  [${r.id}]  ${r.text}`);
    console.error('\nSee scripts/check-referral-copy.js for the rules and scripts/referral-copy-allowlist.json for exceptions.');
    process.exit(1);
  }
  console.log(`Referral-copy check passed (${userFacingFiles().length} files scanned).`);
}
