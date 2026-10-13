// 2026-10-12: two scheduled runs of pto-window-fetch fired 19 seconds apart. The second waited in the
// concurrency group, checked out the commit that was main when it was triggered, and its push then
// conflicted with the first run's commit. These checks pin the two fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const yml = readFileSync(new URL('../.github/workflows/pto-window-fetch.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function step(name) {
  const start = yml.indexOf(`- name: ${name}`);
  assert.ok(start >= 0, `step "${name}" exists`);
  const next = yml.indexOf('\n      - name:', start + 1);
  return yml.slice(start, next === -1 ? undefined : next);
}

test('pto-window-fetch checks out main, not the commit the run was triggered at', () => {
  assert.match(step('Checkout repo'), /ref:\s*main/);
});

test('pto-window-fetch skips a scheduled run when today\'s prices are already on main', () => {
  const skip = step('Skip if already priced today');
  assert.match(skip, /github\.event_name == 'schedule'/);
  assert.match(skip, /generated_at/);
  assert.match(skip, /GITHUB_OUTPUT/);
  for (const name of ['Pick the windows to price', 'Price the windows (live)', 'Commit the window prices']) {
    assert.match(step(name), /steps\.fresh\.outputs\.skip != 'true'/, `${name} is gated on the skip`);
  }
});

test('the skip check itself: today is skipped, another day and a broken file are not', () => {
  const script = yml.match(/skip=\$\(node -e "\n([\s\S]*?)\n\s*"\)/)[1];
  const run = (content) => {
    const dir = execFileSync(process.execPath, ['-e', `
      const fs=require('fs'),os=require('os'),p=require('path');
      const d=fs.mkdtempSync(p.join(os.tmpdir(),'ptoskip-'));
      fs.writeFileSync(p.join(d,'sparkfare_pto_window_prices.json'),${JSON.stringify(content)});
      process.stdout.write(d);`]).toString();
    return execFileSync(process.execPath, ['-e', script], { cwd: dir }).toString().trim();
  };
  const today = new Date().toISOString();
  assert.equal(run(JSON.stringify({ generated_at: today })), 'true');
  assert.equal(run(JSON.stringify({ generated_at: '2020-01-01T00:00:00+00:00' })), 'false');
  assert.equal(run('not json'), 'false');
  assert.equal(run(JSON.stringify({})), 'false');
});
