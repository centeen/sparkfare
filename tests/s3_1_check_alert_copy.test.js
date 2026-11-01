// S3-1 (Guard reads 2026-11-01, C3/C4): the /check alert card and the route pages describe what the signup does:
// alerts by home airport, a daily digest with deals and featured routes. The form posts no destination.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = read('../check.html');
const gen = read('../Phase 17 pSEO Generator (Step 106).py');
const route = read('../data/jfk-to-prague-czechia.html');
const OLD = ['this route drops', 'Watch this route', 'One email when it drops below its usual price', 'when a fare from your home airport beats its usual price', 'featured routes'];

test('/check: new heading, line, button and accessible name are present once', () => {
  assert.equal(html.split('<h2>Want fare alerts from your home airport?</h2>').length - 1, 1);
  assert.equal(html.split('<p class="sub">At most one fare email a day, with fares from your home airport.</p>').length - 1, 1);
  assert.equal(html.split('aria-label="Get fare alerts by email">Get fare alerts</a>').length - 1, 1);
  assert.ok(html.includes('<button type="submit">Get fare alerts</button>'));
});

test('the old strings are gone from /check, the generator and the generated route pages', () => {
  for (const s of OLD) {
    assert.ok(!html.includes(s), 'check.html: ' + s);
    assert.ok(!gen.includes(s), 'generator: ' + s);
  }
  const bad = fs.readdirSync(new URL('../data/', import.meta.url)).filter((f) => f.endsWith('.html')
    && OLD.some((s) => read('../data/' + f).includes(s)));
  assert.deepEqual(bad, []);
});

test('route pages carry the same sub-line as /check, with their own airport', () => {
  assert.ok(route.includes('At most one fare email a day, with fares from JFK.'));
  assert.ok(gen.includes('At most one fare email a day, with fares from {origin}.'));
  assert.ok(route.includes('>Get alerts</a>') && !route.includes('>Watch</a>'));
});

test('the form still posts no destination', () => {
  const i = html.indexOf("fetch('/api/signup'");
  const post = html.slice(i, i + 900);
  assert.ok(post.includes("source: 'check'") && post.includes('origin_iata'));
  assert.ok(!/dest(ination)?\s*:/.test(post), 'no destination field in the signup body');
});
