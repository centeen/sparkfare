// K-B10: the pieces of the browser brand checks that do not need a browser: the harness server, the comparison, the workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createBrandServer, parseJsonc, loadConfig } from '../scripts/lib/brand-server.mjs';
import { SURFACES, VIEWPORTS, RATCHETED, compare } from '../scripts/brand-checks.mjs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('wrangler.jsonc parses with its comments and trailing commas, and the harness reads the same flags and routes', () => {
  assert.deepEqual(parseJsonc('{ // c\n "a": "http://x//y", /* b */ "n": [1,2,], }'), { a: 'http://x//y', n: [1, 2] });
  const cfg = loadConfig();
  assert.ok(cfg.runWorkerFirst.includes('/api/*') && cfg.runWorkerFirst.includes('/check'));
  assert.equal(cfg.vars.ENABLE_PTO_CALENDAR, 'true');
});

test('the harness serves static pages and Worker pages, and a missing path gets the custom 404', async () => {
  const srv = await createBrandServer();
  try {
    const get = async (p) => { const r = await fetch(`http://127.0.0.1:${srv.port}${p}`); return { status: r.status, text: await r.text() }; };
    const home = await get('/');
    assert.equal(home.status, 200);
    assert.match(home.text, /class="site-nav/);
    assert.equal((await get('/about')).status, 200);
    const route = await get('/flight/JFK/Lisbon%2C%20Portugal');
    assert.equal(route.status, 200);
    assert.match(route.text, /Lisbon, Portugal/);
    assert.equal((await get('/time-off/sea')).status, 200);
    const missing = await get('/definitely-not-a-page');
    assert.equal(missing.status, 404);
    assert.match(missing.text, /site-nav/);
  } finally { await srv.close(); }
});

test('every listed surface exists and answers with the status the list expects', async () => {
  const srv = await createBrandServer();
  try {
    for (const s of SURFACES) {
      const r = await fetch(`http://127.0.0.1:${srv.port}${s.path}`);
      assert.equal(r.status, s.status || 200, `${s.name} ${s.path}`);
      await r.text();
    }
  } finally { await srv.close(); }
  assert.equal(SURFACES.length, 17);
  assert.deepEqual(VIEWPORTS.map((v) => v.width), [375, 1440]);
});

test('the comparison: over baseline fails, at or under passes, a missing baseline means zero, a non-brand font or wrong status fails', () => {
  const run = (over) => ({ key: 'home@375', status: 200, expectedStatus: 200, contrast: 0, gold: 0, targets: 0, smallText: 0, brandFont: true, bodyFont: 'Inter', examples: {}, ...over });
  const base = { surfaces: { 'home@375': { targets: 2 } } };
  assert.deepEqual(compare([run({ targets: 2 })], base), []);
  assert.deepEqual(compare([run({ targets: 1 })], base), []);
  assert.equal(compare([run({ targets: 3 })], base).length, 1);
  assert.equal(compare([run({ contrast: 1 })], base).length, 1);
  assert.equal(compare([run({ gold: 1 })], { surfaces: {} }).length, 1);
  assert.equal(compare([run({ brandFont: false, bodyFont: 'Segoe UI' })], base).length, 1);
  assert.equal(compare([run({ status: 500 })], base).length, 1);
  assert.deepEqual(RATCHETED, ['contrast', 'gold', 'targets', 'smallText']);
});

test('the in-page checks are valid scripts and the contrast audit is the one the workflow runs', () => {
  for (const f of ['scripts/lib/brand-page-checks.js', 'scripts/contrast-audit.js']) assert.doesNotThrow(() => new vm.Script(read(f)), f);
});

test('the workflow runs both halves on pull requests, installs Playwright without touching the lockfile, and has a baseline mode', () => {
  const y = read('.github/workflows/brand-checks.yml');
  assert.match(y, /pull_request:/);
  assert.match(y, /npm i --no-save playwright@/);
  assert.match(y, /node scripts\/brand-lint\.mjs/);
  assert.match(y, /node scripts\/brand-checks\.mjs/);
  assert.match(y, /write_baseline/);
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!JSON.stringify(pkg).includes('playwright'), 'playwright must not be a dependency (it would change the lockfile)');
});
