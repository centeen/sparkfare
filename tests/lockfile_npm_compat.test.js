// Cloudflare's Workers Builds runs `npm ci`. From 2026-10-16 it failed on every build ("Missing: utf-8-validate@5.0.10 from lock file")
// because the lock was written by npm 11 and the build uses npm 10: five nested ws@7 packages declare an optional peer
// utf-8-validate ^5.0.2, while the lock held 6.0.6. An override pins one version that both npm 10 and npm 11 accept.
// The real check is `npx npm@10 ci --ignore-scripts` plus `npm ci --dry-run` in a scratch copy; this test pins the facts that make it pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

test('package.json pins utf-8-validate with an override', () => {
  assert.equal(pkg.overrides && pkg.overrides['utf-8-validate'], '5.0.10');
});

test('the lock holds exactly the pinned utf-8-validate, which satisfies every ^5 optional peer that asks for it', () => {
  const entry = lock.packages['node_modules/utf-8-validate'];
  assert.ok(entry, 'the root entry is present (npm 11 requires it)');
  assert.equal(entry.version, '5.0.10');
  for (const [name, v] of Object.entries(lock.packages)) {
    const want = v.peerDependencies && v.peerDependencies['utf-8-validate'];
    if (want && want.startsWith('^5')) assert.ok(entry.version.startsWith('5.'), `${name} wants ${want}`);
  }
});

test('the lock is the format both npm 10 and npm 11 read', () => {
  assert.equal(lock.lockfileVersion, 3);
});
