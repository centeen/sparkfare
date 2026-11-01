// Guard read 2026-11-01 ~20:30, PR B: "On the ground" heading and bullet rule, vacancy / leaving-home / trip-protection wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const posts = fs.readdirSync(new URL('../blog/', import.meta.url)).filter((f) => f.endsWith('.html'));
const gen = read('../Phase 20 Blog Generator.py');
const UNSOURCED = /\b(entirely|zero|never|eliminat\w*|half|less than|cheaper|cost\w*|price\w*|pricing|markup|rates?|expensive|economically|dollars?|value|money|crowd\w*|congestion|fees?)\b/i;

test('the old heading is gone; any "On the ground" section holds only bullets that pass the rule', () => {
  assert.ok(gen.includes('ON_GROUND_HEADING = "On the ground"') && gen.includes('<h2>{ON_GROUND_HEADING}</h2>'));
  assert.ok(gen.includes('not UNSOURCED_BULLET.search(item)'));
  for (const f of posts) {
    const t = read('../blog/' + f);
    assert.ok(!t.includes('What it actually costs on the ground'), f);
    const i = t.indexOf('<h2>On the ground</h2>');
    if (i >= 0) for (const li of t.slice(i, t.indexOf('</ul>', i)).match(/<li>.*?<\/li>/g) || []) assert.ok(!UNSOURCED.test(li), f + ': ' + li);
  }
});

test('the five rule examples are caught (generator pattern), and a plain descriptive bullet passes', () => {
  const m = gen.match(/UNSOURCED_BULLET = re\.compile\(r"(.*)", re\.I\)/)[1];
  const re = new RegExp(m, 'i');
  for (const bad of ['eliminating summer crowds entirely', 'zero tourist markup', 'costs half what you would pay', 'price drops during February-March lulls', 'maximizing experiences per dollar spent']) assert.ok(re.test(bad), bad);
  assert.ok(!re.test('Tram 28 climbs through Alfama.'));
});

test('trip-protection: no "do not link to any" above a source link', () => {
  const t = read('../blog/trip-protection-has-a-clock.html');
  assert.ok(t.includes('We do not recommend any plan or provider and have no referral links; the source below is cited for the facts only.'));
  assert.ok(!/do not link to any/.test(t));
});

test('vacancy post: education-only line, hedged categories, no unsourced figures, no occupied-by-sitter assertion', () => {
  const t = read('../blog/vacancy-rules-and-homeowners-insurance.html');
  assert.ok(t.includes('We cannot tell you what your policy says'));
  assert.ok(!/almost all cases|55&deg;F|7, 14, or 30|Common thresholds|Most homeowner policies exclude|Carriers often provide|considered <strong>unoccupied/.test(t));
  assert.ok(t.includes('<h2>Background reading</h2>') && t.includes('We have not tied any statement above to a specific page'));
  assert.ok(t.includes('Last reviewed 2026-11-01'));
});

test('leaving-home post: not-advice line, "avoid" not "never", no agency attribution for the temperature rule, no unsourced settings', () => {
  const t = read('../blog/leaving-home-for-30-days.html');
  assert.ok(t.includes('It is not advice, and it does not assess your home'));
  assert.ok(!/four critical home systems|Never turn off|Never leave keys|Disaster preparedness agencies|78&deg;F|120&deg;F|every 7, 14, or 30 days/.test(t));
  assert.ok(t.includes('Avoid turning off the heating system') && t.includes('Avoid leaving keys'));
  assert.ok(t.includes('usps.com/manage/hold-mail.htm'));
});
