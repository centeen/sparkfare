// S3-1 (Guard read 2026-11-01, C3): the /check alert card must not say "this route"; the form saves only the home airport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the new heading and button strings are present once', () => {
  assert.equal(html.split('<h2>Want a heads-up when fares from your home airport drop?</h2>').length - 1, 1);
  assert.equal(html.split('aria-label="Get fare alerts by email">Get fare alerts</a>').length - 1, 1);
});

test('the old route-specific strings are gone', () => {
  assert.ok(!html.includes('Want a heads-up when this route drops?'));
  assert.ok(!html.includes('Watch this route'));
});

test('the form still posts no destination', () => {
  const post = html.slice(html.indexOf("fetch('/api/signup'"), html.indexOf("fetch('/api/signup'") + 900);
  assert.ok(post.includes("source: 'check'") && post.includes('origin_iata'));
  assert.ok(!/dest(ination)?\s*:/.test(post), 'no destination field in the signup body');
});
