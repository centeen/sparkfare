// Guard read #511 (C1 to C4): every destination guide's meta and og description is the Hub-cleared string for its group, and the
// removed-section wording "On-the-ground notes" is gone from them. The featured list is read from the data, not typed in twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const dest = JSON.parse(readFileSync(new URL('../sparkfare_destinations.json', import.meta.url), 'utf8'));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TEN = ['Antigua, Guatemala', 'Baku, Azerbaijan', 'Cappadocia, Turkey', 'Cusco, Peru', 'Luxor, Egypt', 'Marrakech, Morocco', 'Muscat, Oman', 'Oaxaca, Mexico', 'Petra, Jordan', 'Tbilisi, Georgia'];
const A = (city) => `What to sort out before you go to ${city}, plus why this route is always featured on the board regardless of price.`;
const B = (city) => `What to sort out before you go to ${city}, plus why routes like this one need a genuine dip before Sparkfare calls it a deal.`;

test('C1: the featured group in the data is exactly the ten the Hub read', () => {
  const featured = Object.entries(dest).filter(([, v]) => v.group === 'featured').map(([k]) => k).sort();
  assert.deepEqual(featured, [...TEN].sort());
  assert.equal(Object.keys(dest).length, 40);
});

test('C2 to C4: all 40 guides carry string A (featured) or B (the rest) in both meta and og, and never "On-the-ground notes"', () => {
  let checked = 0;
  for (const [name, v] of Object.entries(dest)) {
    const file = new URL(`../blog/${slug(name)}.html`, import.meta.url);
    assert.ok(existsSync(file), `${slug(name)}.html exists`);
    const html = readFileSync(file, 'utf8');
    const city = name.split(',')[0];
    const want = v.group === 'featured' ? A(city) : B(city);
    const meta = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
    const og = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1];
    assert.equal(meta, want, `${name}: meta description`);
    assert.equal(og, want, `${name}: og:description`);
    assert.ok(!/On-the-ground notes/i.test(`${meta} ${og}`), `${name}: removed-section wording`);
    if (v.group === 'featured') assert.ok(!/genuine dip/.test(`${meta} ${og}`), `${name}: a featured guide never carries the deal-dip line`);
    checked += 1;
  }
  assert.equal(checked, 40);
});

test('the generator writes the same two strings', () => {
  const py = readFileSync(new URL('../Phase 20 Blog Generator.py', import.meta.url), 'utf8');
  assert.ok(py.includes('plus why routes like this one need a genuine dip before Sparkfare calls it a deal.'));
  assert.ok(py.includes('plus why this route is always featured on the board regardless of price.'));
  assert.ok(!/On-the-ground notes for \{city/.test(py));
});
