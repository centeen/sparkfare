// F1 (Addendum J, ROADMAP step 109): the public destinations file carries no urgency wording, no unsourced
// percentages or prices, and no "premium"/"arbitrage" style claims. The page and the blog generator filter
// these with the same pattern, but the file itself is served publicly, so it has to be clean at the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BARRED = /(\d\s*[–-]?\s*\d*\s*%|[$€£]\s?\d|\b(hurry|last chance|act now|steal|insane|guaranteed|prices will rise|lowest ever|hack|instantly|limited time|move fast|vanish\w*|premium|arbitrage|only \d+ left)\b|the moment)/i;
const data = JSON.parse(fs.readFileSync(new URL('../sparkfare_destinations.json', import.meta.url), 'utf8'));

function strings() {
  const out = [];
  for (const [name, entry] of Object.entries(data)) {
    const c = entry.copywriting || {};
    if (c.the_hook) out.push([name, 'the_hook', c.the_hook]);
    for (const t of c.on_ground_reality || []) out.push([name, 'on_ground_reality', t]);
    if (c.away_mode_transition) out.push([name, 'away_mode_transition', c.away_mode_transition]);
  }
  return out;
}

test('no destination string trips the barred-copy pattern', () => {
  const bad = strings().filter(([, , t]) => BARRED.test(t)).map(([n, f, t]) => `${n} / ${f}: ${t.slice(0, 60)}`);
  assert.deepEqual(bad, []);
});

test('the pattern still catches the wording it exists for', () => {
  for (const t of ['60% less than Thailand', 'villas from $40 a night', 'act now', 'a premium stay', 'currency arbitrage', 'the moment you land']) {
    assert.ok(BARRED.test(t), t);
  }
});

test('all 40 destinations and every field name are still present', () => {
  assert.equal(Object.keys(data).length, 40);
  for (const entry of Object.values(data)) {
    assert.ok(entry.copywriting && 'the_hook' in entry.copywriting && Array.isArray(entry.copywriting.on_ground_reality) && 'away_mode_transition' in entry.copywriting);
  }
});
