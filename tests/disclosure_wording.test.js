// 2026-10-14: the email commission disclosures and the two Away Mode blurbs no longer say "book"/"booked" in Sparkfare's voice.
// Each disclosure must still say what it is for: that Sparkfare may earn a commission, and at no extra cost to the reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOLLOW_UP_DISCLOSURE_TEXT } from '../src/email.js';
import { DISCLOSURE_TEXT } from '../src/emailTemplates/dailyDigest.js';
import { V2_DISCLOSURE_TEXT } from '../src/postClickEmail.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('the three standard email disclosures say "buy", still state the commission and no extra cost', () => {
  for (const [name, text] of [['follow-up', FOLLOW_UP_DISCLOSURE_TEXT], ['digest', DISCLOSURE_TEXT], ['post-click v2', V2_DISCLOSURE_TEXT]]) {
    assert.match(text, /may earn a commission/, name);
    assert.match(text, /at no extra cost to you/, name);
    assert.match(text, /if you buy through/, name);
    assert.ok(!/\bbook(?:ed|ing)?\b/i.test(text.replace("doesn't sell or book travel", '').replace('which handles booking and payment', '')), name + ' still says book');
  }
  assert.ok(V2_DISCLOSURE_TEXT.includes("Sparkfare doesn't sell or book travel."));
});

test('no email template still carries the old "flights booked through links" sentence', () => {
  for (const f of ['src/email.js', 'src/emailTemplates/dailyDigest.js', 'src/postClickEmail.js']) {
    assert.ok(!/flights booked through links|if you book or buy through|if you book through the button/.test(read(f)), f);
  }
});

test('the parking and airport-transfer blurbs in code no longer say book', () => {
  assert.ok(!/Book airport parking ahead/.test(read('src/email.js')));
  assert.ok(read('src/email.js').includes('Compare airport parking before you go'));
  assert.ok(!/sign, booked ahead/.test(read('src/postClickEmail.js')));
  assert.ok(read('src/postClickEmail.js').includes('with your name on a sign, set up ahead.'));
});
