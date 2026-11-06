// Nov 5 fix-only day (C): llms.txt must not point at the Holiday Fare Report while ENABLE_REPORTS is off,
// because /reports/holiday-2026 answers 404 until the flag flips.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('llms.txt does not list the Holiday Fare Report while ENABLE_REPORTS is not "true"', () => {
  const on = /"ENABLE_REPORTS"\s*:\s*"true"/.test(read('wrangler.jsonc'));
  if (on) return;
  assert.ok(!/holiday[- ](flight|fare) report|reports\/holiday-2026/i.test(read('llms.txt')));
});
