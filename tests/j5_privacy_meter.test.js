import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// J5 / D-022: the privacy page must describe the click fields ENABLE_METER_TRACKING records (src/meters.js clickContext).
const p = fs.readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
const m = fs.readFileSync(new URL('../src/meters.js', import.meta.url), 'utf8');

test('privacy page names every traveler field the click log can hold', () => {
  for (const phrase of ['home airport', 'number of travelers', 'which part of the site the link was on', "trip's internal ID", 'looks automated']) {
    assert.ok(p.includes(phrase), `privacy.html should mention: ${phrase}`);
  }
});

test('the fields clickContext records are still the ones the page describes', () => {
  for (const f of ['origin', 'party_size', 'src', 'slot', 'trip_id', 'user_known']) assert.ok(m.includes(`    ${f}:`), `src/meters.js clickContext should still record ${f}`);
});

test('it does not claim a date or an email address is stored with a click', () => {
  const para = p.match(/Outbound clicks are logged[\s\S]*?(?=<\/p>)/)[0];
  assert.doesNotMatch(para, /email address is (stored|recorded)/i);
});
