// K-C2 (ROADMAP step 136): "You're set" (peak 2) and the keeper register, built dark. Nothing here may be reachable before the
// Wave 1 flags are switched on (D-016: not before Nov 9).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { youreSetHeadline } from '../src/email.js';
import { renderCardHtml } from '../src/homeCard.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

test('the Wave 1 flags stay off', () => {
  const w = read('wrangler.jsonc');
  for (const flag of ['ENABLE_LEAVE_BY_PLAN', 'ENABLE_PLAN_REMINDERS', 'ENABLE_HOME_CARD', 'ENABLE_PASSPORT_CHECK']) {
    assert.match(w, new RegExp('"' + flag + '":\\s*"false"'), flag + ' must stay "false" until the owner flips it');
  }
});

test("the You're set headline says only what is true", () => {
  assert.equal(youreSetHeadline(5, 0), "You're set.");
  assert.equal(youreSetHeadline(0, 0), "You're set.", 'an empty plan has nothing open');
  assert.equal(youreSetHeadline(2, 3), '2 of 5 done.', 'a count, never a percentage');
  assert.doesNotMatch(youreSetHeadline(2, 3), /%|set/i, 'not "set" while something is open');
});

test('the email leads with the headline and keeps the subject and the first-item rule', () => {
  const e = read('src/email.js');
  assert.match(e, /const headline = youreSetHeadline\(doneItems\.length, openItems\.length\)/);
  assert.ok(e.indexOf('${headlineHtml}') < e.indexOf("paragraphHtml(\"Here's where your plan for \" + escapeHtml(destination)"));
  assert.match(e, /return 'Your plan for ' \+ destination \+ ": what's done and what's open";/);
});

test('the keeper card: plain card, 20 px text, small mark, no offers, nothing but the brand stylesheets', () => {
  const html = renderCardHtml({ leaveDate: '2026-12-20', backDate: '2027-01-02', tasks: [{ text: 'Feed the cat', when: 'daily' }], notes: [] });
  assert.match(html, /<main class="card">/);
  assert.match(html, /font-size:var\(--text-lg\)/);
  assert.match(html, /class="mark"/);
  assert.match(html, /@media print/);
  assert.doesNotMatch(html, /<a\b|\/out\/|sign ?up|subscribe|sponsored/i);
  assert.deepEqual([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]), ['/brand/tokens.css', '/brand/fonts.css']);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/, 'colours come from the tokens');
});

test('/plan: the You\'re set panel needs every listed item ticked and carries no offer', () => {
  const p = read('plan.html');
  assert.match(p, /shownItemCount > 0 && doneNow\.size >= shownItemCount/);
  const panel = p.slice(p.indexOf('id="youre-set"'), p.indexOf('</section>', p.indexOf('id="youre-set"')));
  assert.doesNotMatch(panel, /\/out\/|sponsored|partner|sign ?up/i);
  assert.match(panel, /Make a Home card/, 'the one share');
  assert.match(p, /\.youre-set \{[^}]*display: grid/);
  assert.doesNotMatch(p.slice(p.indexOf('.youre-set {'), p.indexOf('</style>')), /animation|transition|@keyframes/, 'no motion');
});
