#!/usr/bin/env node
// K-A3 (ROADMAP step 121): the approved copy replacements, as an exact before/after list. Text only; no markup, link, style or script
// changes. Idempotent (a replaced line no longer matches). Run over pages, blog, data, generators and templates:
//   git ls-files -z '*.html' '*.js' '*.py' | xargs -0 -n 300 node scripts/apply-ka3-copy.mjs
// Proposed lines come from the Site Scan's copy table; each one needs the Hub's Guard read before it merges.
import fs from 'node:fs';

const SIGNUP = 'At most one fare email a day when a fare from your home airport beats its usual price.';
const ROUTE_CTA = 'Watch this route. One email when it drops below its usual price.';
const BLOG_LINE = 'how to watch this route and hear when it drops below its usual price';

// [before, after]. Strings are exact; `re` entries are regular expressions for text with a variable part (a destination, a price).
export const REPLACEMENTS = [
  // Home and widget signup (H-6)
  ["Save your home airport and we'll email you the moment a fare there is genuinely worth a look.", SIGNUP],
  ["Save your home airport and we'll email you when a fare there is genuinely worth a look.", SIGNUP],
  ['Pick your home airport and we will email you when a fare is genuinely worth a look. We will ask you to confirm your email.', 'Pick your home airport. At most one fare email a day when a fare from there beats its usual price. We will ask you to confirm your email.'],
  // Watchlists: the alert runs once a day, so "the moment" overclaims
  ['Sparkfare will monitor fares and email you the moment they drop below your target.', 'Sparkfare will monitor fares and email you when they drop below your target.'],
  ["We'll email you the moment a fare drops to or below it.", "We'll email you when a fare drops to or below it."],
  // Route pages (R-3, R-4)
  ['Join Sparkfare for free to track this exact route and get notified instantly when airlines slash the fare.', ROUTE_CTA],
  [/\n\s*<p style="margin-top: 12px; font-size: 0\.9rem;"><a href="\/sign-in\?redirect_to=\/watchlists">Want to track this exact route\? Create a free account and a watchlist<\/a><\/p>/g, ''],
  ["Check back soon, or create an alert below and we'll email you the moment there's something worth seeing.", "Check back soon, or watch this route below and we'll email you when there is a fare to compare."],
  ["or create an alert below and we'll email you \"\n            \"the moment there's something worth seeing.", "or watch this route below and we'll email you \"\n            \"when there is a fare to compare."],
  [/Get a real alert the moment a fare is genuinely worth a look -- no guesswork, no fake urgency\./g, 'One email when it drops below its usual price.'],
  [/Track this route and get alerted the moment it's genuinely worth a look\./g, 'Track this route and get one email when it drops below its usual price.'],
  // Blog (index excerpts, meta, generator)
  [/how to catch this route the moment it's genuinely worth a look/g, BLOG_LINE],
  [/how to catch this route when it's genuinely worth a look/g, BLOG_LINE],
  // The ground-cost lists carried unsourced figures and are no longer published, so the pages no longer promise prices
  [/Real on-the-ground prices for a proper/g, 'On-the-ground notes for a proper'],
  [/Real on-the-ground prices for/g, 'On-the-ground notes for'],
  // Away Mode (A-3)
  // Editorial posts: "the moment" as a time phrase, and one "guaranteed"
  ['back-to-back the moment the hourly job starts', 'back-to-back as soon as the hourly job starts'],
  ['fires the moment you click a fare', 'fires when you click a fare'],
  ['useful in the moment, easy to forget', 'useful right then, easy to forget'],
  ['flagged for early access the moment your friend actually opens', 'flagged for early access when your friend actually opens'],
  ['why the moment exists at all', 'why this step exists at all'],
  ["either true or false the moment it's made", "either true or false as soon as it's made"],
  ['the one guaranteed, always-on source of truth', 'the one dependable, always-on source of truth'],
  ['live on the checklist — data the moment you land, no local SIM card hunt', 'live on the checklist — data from the moment you land, on a supported network, no local SIM card hunt'],
  // The eSIM blurb: sentence case after the full stop, not after a dash
  ['landing — Data from the moment you land', 'landing. Data from the moment you land'],
  ["landing \u2014 Data from the moment you land", "landing. Data from the moment you land"],
  // Emails
  ['pick the moment each job gets done', 'pick when each job gets done'],
  ["Pick the moment you'll do it", "Pick when you'll do it"],
  ["data the moment you touch down, no local SIM card hunt.", 'Data from the moment you land, on a supported network, no local SIM card hunt.'],
  ["An eSIM for wherever you're landing — data the moment you touch down.", "An eSIM for wherever you're landing. Data from the moment you land, on a supported network."],
  ["An eSIM for wherever you\\'re landing — data the moment you touch down, no local SIM card hunt.", "An eSIM for wherever you\\'re landing. Data from the moment you land, on a supported network, no local SIM card hunt."],
  ["Sort out airport parking ahead and skip the gate-price surprise when you\\'re heading out.", "Compare airport parking before you go and skip the gate-price surprise when you\\'re heading out."],
  ['<strong>Start packing instantly.</strong> Sign in to sync your checklist across all your devices.', '<strong>Keep your checklist.</strong> Sign in to sync it across all your devices.'],
];

export function applyCopy(src) {
  let s = src;
  for (const [before, after] of REPLACEMENTS) s = typeof before === 'string' ? s.split(before).join(after) : s.replace(before, after);
  return s;
}

if (process.argv[1]?.endsWith('apply-ka3-copy.mjs')) {
  let changed = 0;
  for (const file of process.argv.slice(2)) {
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    const before = raw.replace(/\r\n/g, '\n');
    const after = applyCopy(before);
    if (after !== before) { fs.writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after); changed += 1; }
  }
  console.log(`rewrote ${changed} of ${process.argv.length - 2} files`);
}
