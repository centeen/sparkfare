// S3-1 follow-up (Guard read 2026-11-01 ~18:20, C-a/C-b/C-pto): the other signup surfaces carry sub-line A, not the retired
// "beats its usual price" line, and the "Get deal alerts" labels became "Get fare alerts". Signup posts only the home airport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const A = 'At most one fare email a day, with fares from your home airport.';
const RETIRED = ['beats its usual price', 'when a fare from your home airport', 'when a fare from there'];

test('homepage, widget and the planner template carry sub-line A once; /leave carries its own lead-in form', () => {
  for (const f of ['../index.html', '../widget.html', '../src/ptoPages.js']) assert.equal(read(f).split(A).length - 1, 1, f);
  const leave = read('../leave.html');
  assert.equal(leave.split('Pick your home airport. At most one fare email a day, with fares from there. We will ask you to confirm your email.').length - 1, 1);
});

test('the retired line is gone from every one of these surfaces and from the other signup templates', () => {
  for (const f of ['../index.html', '../widget.html', '../leave.html', '../check.html', '../src/ptoPages.js', '../src/digestArchive.js']) {
    for (const s of RETIRED) assert.ok(!read(f).includes(s), `${f}: ${s}`);
  }
});

test('no "Get deal alerts" label is left on the widget, /leave or the planner, and the widget title matches', () => {
  for (const f of ['../widget.html', '../leave.html', '../src/ptoPages.js']) assert.ok(!read(f).includes('Get deal alerts'), f);
  const w = read('../widget.html');
  assert.ok(w.includes('<title>Sparkfare fare alerts</title>') && w.includes('<h1 class="widget-headline">Get fare alerts</h1>') && w.includes('<button type="submit">Get fare alerts</button>'));
  assert.ok(read('../leave.html').includes('<button type="submit">Get fare alerts</button>'));
});

test('the homepage fare-card link says Get alerts, and its accessible name contains the visible text', () => {
  const h = read('../index.html');
  assert.ok(h.includes(`aria-label="Get alerts from your home airport by email">Get alerts</a>`));
  assert.ok(!/>Watch<\/a>/.test(h));
});

test('the digest archive signup is unchanged and makes no usual-price claim', () => {
  const a = read('../src/digestArchive.js');
  assert.ok(a.includes('Get this in your inbox every morning'));
  assert.ok(!/usual price/.test(a.slice(a.indexOf('archive-signup-card'), a.indexOf('archive-signup-card') + 3000)));
});

test('these signups post only the home airport (no destination field)', () => {
  for (const f of ['../index.html', '../widget.html', '../leave.html']) {
    const t = read(f); const i = t.indexOf("fetch('/api/signup'");
    if (i < 0) continue;
    assert.ok(!/\bdest(ination)?\s*:/.test(t.slice(i, i + 900)), f);
  }
});
