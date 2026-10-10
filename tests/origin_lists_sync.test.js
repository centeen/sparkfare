// The origin list is written out by hand in about twenty places (workflows, the Worker, the HTML dropdowns and
// client checks, the Python generators). Adding an origin has repeatedly missed some of them (check.html, leave.html
// and the Pinterest route's `.slice(0, 15)` were not in the first list of touchpoints for step 76). This test reads
// every one of them and fails if any disagrees with the fetch workflow's list, which is the canonical one: what
// is fetched is what exists.
//
// Two shapes, on purpose: the full list (US origins plus TLV, the unmarketed design-partner origin) is used where a
// signed-in or alert path must accept TLV; the US-only list is used by the public acquisition surfaces (pSEO pages,
// PTO planner, widget, digest archive), which deliberately exclude TLV.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const codesIn = (s) => [...String(s).matchAll(/\b[A-Z]{3}\b/g)].map((m) => m[0]);
const grab = (file, re, what) => {
  const m = read(file).match(re);
  assert.ok(m, `${file}: could not find ${what}`);
  return m[1];
};
const sorted = (a) => [...new Set(a)].sort();

const FULL = codesIn(grab('.github/workflows/hourly-multi-origin-fetch.yml', /'schedule' && '([^']+)'/, 'the scheduled SPARKFARE_ORIGINS list'));
const US = FULL.filter((o) => o !== 'TLV');

test('canonical list: JFK first, TLV last and unmarketed, no duplicates', () => {
  assert.equal(FULL[0], 'JFK');
  assert.equal(FULL[FULL.length - 1], 'TLV');
  assert.equal(new Set(FULL).size, FULL.length);
  assert.ok(US.length >= 15);
});

const FULL_SETS = [
  ['src/index.js VALID_ORIGINS', 'src/index.js', /const VALID_ORIGINS = new Set\(\[([\s\S]*?)\]\)/],
  ['index.html client VALID_ORIGINS', 'index.html', /const VALID_ORIGINS = new Set\(\[([^\]]*)\]\)/],
  ['account.html client VALID_ORIGINS', 'account.html', /const VALID_ORIGINS = new Set\(\[([^\]]*)\]\)/],
  ['watchlists.html client VALID_ORIGINS', 'watchlists.html', /const VALID_ORIGINS = new Set\(\[([^\]]*)\]\)/],
  ['Newsletter generator VALID_ORIGINS', 'Phase 19 Newsletter Generator.py', /VALID_ORIGINS = \[([^\]]*)\]/],
];
const US_SETS = [
  ['widget.html client VALID_ORIGINS', 'widget.html', /const VALID_ORIGINS = new Set\(\[([^\]]*)\]\)/],
  ['src/ptoPages.js PTO_ORIGINS', 'src/ptoPages.js', /export const PTO_ORIGINS = \[([^\]]*)\]/],
  ['src/digestArchive.js ARCHIVE_ORIGINS', 'src/digestArchive.js', /export const ARCHIVE_ORIGINS = \[([^\]]*)\]/],
  ['PTO window fetch US_ORIGINS', 'Phase 22 PTO Window Fetch (Step 73).py', /US_ORIGINS = \[([^\]]*)\]/],
  ['Social Broadcaster PTO_ORIGINS', 'Phase 3 Social Broadcaster.py', /PTO_ORIGINS = \[([^\]]*)\]/],
];

for (const [label, file, re] of FULL_SETS) {
  test(`${label} matches the fetched origins (US + TLV)`, () => {
    assert.deepEqual(sorted(codesIn(grab(file, re, label))), sorted(FULL));
  });
}
for (const [label, file, re] of US_SETS) {
  test(`${label} matches the US origins (no TLV)`, () => {
    assert.deepEqual(sorted(codesIn(grab(file, re, label))), sorted(US));
  });
}

test('pSEO generator ORIGINS matches the US origins', () => {
  const body = grab('Phase 17 pSEO Generator (Step 106).py', /\nORIGINS = \[([\s\S]*?)\n\]/, 'ORIGINS');
  const codes = [...body.matchAll(/\("([A-Z]{3})",/g)].map((m) => m[1]);
  assert.deepEqual(sorted(codes), sorted(US));
});

test('daily compile SPARKFARE_FREE_ORIGINS is every fetched origin except JFK', () => {
  const listed = codesIn(grab('.github/workflows/daily-compile-other-origins.yml', /SPARKFARE_FREE_ORIGINS:\s*"([^"]+)"/, 'SPARKFARE_FREE_ORIGINS'));
  assert.deepEqual(sorted(listed), sorted(FULL.filter((o) => o !== 'JFK')));
});

test('ORIGIN_CITIES has a city name for every fetched origin', () => {
  const body = grab('src/emailTemplates/helpers.js', /const ORIGIN_CITIES = \{([\s\S]*?)\};/, 'ORIGIN_CITIES');
  const keys = [...body.matchAll(/\b([A-Z]{3}):/g)].map((m) => m[1]);
  assert.deepEqual(sorted(keys), sorted(FULL));
});

// Every origin <select> in a page lists the same origins. The dropdowns that sit behind a signed-in or alert path
// carry TLV; the public ones do not.
const DROPDOWN_FILES = [
  ['index.html', FULL], ['account.html', FULL], ['watchlists.html', FULL],
  ['widget.html', US], ['check.html', US], ['leave.html', US], ['src/embed.html', US],
];
for (const [file, expected] of DROPDOWN_FILES) {
  test(`${file}: every origin dropdown lists exactly the expected origins`, () => {
    const selects = [...read(file).matchAll(/<select[^>]*>([\s\S]*?)<\/select>/g)].map((m) => m[1]);
    const origin = selects
      .map((body) => [...body.matchAll(/<option(?:\s+value="([A-Z]{3})")?[^>]*>([^<]*)</g)]
        .map((m) => m[1] || (/^[A-Z]{3}$/.test(m[2].trim()) ? m[2].trim() : null)).filter(Boolean))
      .filter((opts) => opts.includes('JFK') && opts.includes('LAX'));
    assert.ok(origin.length >= 1, `${file}: no origin dropdown found`);
    for (const opts of origin) assert.deepEqual(sorted(opts), sorted(expected), `${file}: dropdown differs`);
  });
}

test('Pinterest PTO pin route does not truncate the origin list', () => {
  assert.doesNotMatch(read('src/index.js'), /PTO_ORIGINS\.slice\(\s*0\s*,\s*\d+\s*\)/);
});

test('hard-coded origin and route counts match the list', () => {
  const dests = Object.keys(JSON.parse(read('sparkfare_destinations.json'))).length;
  const line = read('index.html').match(/<p class="trust-signal"[^>]*>([^<]*)<\/p>/)?.[1] || '';
  assert.ok(line.includes(`${US.length * dests} routes from ${US.length} major hubs`), `homepage trust line: ${line}`);
  assert.ok(read('content/pto_press_2027.md').includes(`${US.length} major US origin hubs`), 'content/pto_press_2027.md hub count');
});
