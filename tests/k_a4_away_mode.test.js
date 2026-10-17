// K-A4 (ROADMAP step 122, D-032): Away Mode governance. No partner is called a match before the visitor answers a question; the reason
// is a neutral chip in the visitor's own words; Petcube is hidden everywhere; the partner checkboxes are labelled "Done".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const page = read('away-mode.html');

test('the old amber "Matches your trip" badge is gone, replaced by a neutral reason chip', () => {
  assert.ok(!/Matches your trip/.test(page));
  assert.ok(!/match-tag/.test(page));
  const css = page.match(/\.reason-chip \{[^}]*\}/)[0];
  assert.match(css, /color:\s*var\(--ink-2\)/);
  assert.match(css, /background:\s*var\(--card\)/);
  assert.doesNotMatch(css, /amber|spark|gold|#E8B930/i);
});

test('a chip is only added after the visitor has answered a question, and only for a partner whose question was answered yes', () => {
  assert.match(page, /const answered = Object\.values\(currentNeeds\)\.some\(v => v === true \|\| v === false\);/);
  assert.match(page, /if \(answered && slug === mappedSlug && currentNeeds\[key\] === true\)/);
  assert.match(page, /if \(reason\) titleEl\.insertAdjacentHTML\('beforeend', '<span class="reason-chip">'/);
});

test('every question that maps to a partner has a plain reason, and no reason claims a result or a deal', () => {
  const keyMap = [...page.match(/const KEY_MAP = \{([\s\S]*?)\};/)[1].matchAll(/'([a-z_]+)':\s*'/g)].map((m) => m[1]);
  const reasons = Object.fromEntries([...page.match(/const REASONS = \{([\s\S]*?)\};/)[1].matchAll(/([a-z_]+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  assert.ok(keyMap.length >= 13);
  for (const k of keyMap) assert.ok(reasons[k], `reason for ${k}`);
  for (const text of Object.values(reasons)) {
    assert.match(text, /^Because you /);
    assert.doesNotMatch(text, /\b(best|cheap|save|deal|match|perfect|recommended|book|secure)\w*/i, text);
  }
});

test('Petcube is not in the page, the disclosure, the about page or the Away Mode checklist post', () => {
  for (const f of ['away-mode.html', 'disclosure.html', 'about.html', 'blog/away-mode-checklist.html']) assert.ok(!/petcube|pet camera/i.test(read(f)), f);
  assert.match(read('disclosure.html'), /QEEQ \(car rental\), and Welcome Pickups \(airport transfers\)\./);
});

test('migration 0030 hides Petcube: pending, link kept, and 13 partners are live afterwards', () => {
  const files = fs.readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
  const DB = makeSqliteD1(files);
  const row = DB.raw.prepare("SELECT status, status_reason, url_template FROM partners WHERE slug = 'petcube'").get();
  assert.equal(row.status, 'pending');
  assert.match(row.status_reason, /D-032/);
  assert.ok(row.url_template.startsWith('https://www.awin1.com/'));
  assert.equal(DB.raw.prepare("SELECT count(*) AS n FROM partners WHERE status = 'live'").get().n, 13);
  assert.match(read('migrations/0030_petcube_hidden_again.sql'), /BEFORE the K-A4 PR merges/);
});

test('the partner checkboxes carry a visible "Done" label and a name, and the choice is kept in this browser only', () => {
  assert.match(page, /aria-label="Done: \$\{p\.name\}"/);
  assert.match(page, /<span class="partner-done-text">Done<\/span>/);
  assert.match(page, /localStorage\.setItem\('sparkfare_away_done'/);
  assert.match(page, /bindDoneBoxes\(\);\s*loadLocalState\(\);/);
});
