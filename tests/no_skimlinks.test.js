import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The Skimlinks application was declined (2026-09-21) and the script has no account behind it.
// It was removed from the static pages on 2026-09-25, but the Worker-rendered templates in
// src/index.js and the blog generator still emitted it, so the live /index page kept loading it.
// This scans everything that produces or serves a page so it cannot quietly come back through a
// template or a generator regenerating pages.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEEDLES = ['skimresources', 'skimlinks.js'];

function filesIn(dir, ext) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => path.join(dir, e.name));
}

test('no page, template or generator references Skimlinks', () => {
  const candidates = [
    ...filesIn('src', '.js'),
    ...filesIn('.', '.js'),
    ...filesIn('.', '.py'),   // page generators (blog, pSEO, ...)
    ...filesIn('.', '.html'),
    ...filesIn('blog', '.html'),
    ...filesIn('data', '.html'),
  ];
  assert.ok(candidates.length > 100, 'expected to scan the source, generators and served pages');

  const offenders = candidates.filter((f) => {
    const text = fs.readFileSync(path.join(root, f), 'utf8').toLowerCase();
    return NEEDLES.some((n) => text.includes(n));
  });
  assert.deepEqual(offenders, [], `Skimlinks script found in: ${offenders.join(', ')}`);
});
