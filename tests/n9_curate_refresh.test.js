// N9 (Addendum N, ROADMAP step 156): the daily refresh of the curated store. The merge itself is tested in tests/python/test_curate.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sinceDate, recentSnapshots, stageRefresh, FEED_FILES, SNAPSHOT_DIR } from '../scripts/data/curate-refresh.mjs';

test('sinceDate counts the days back including today, across month and year ends', () => {
  assert.equal(sinceDate('2026-10-25', 3), '2026-10-23');
  assert.equal(sinceDate('2026-10-25', 1), '2026-10-25');
  assert.equal(sinceDate('2026-11-01', 3), '2026-10-30');
  assert.equal(sinceDate('2027-01-01', 2), '2026-12-31');
  assert.throws(() => sinceDate('not-a-date', 3));
});

test('recentSnapshots keeps only snapshots from the window, by the date in the file name', () => {
  const names = ['flight_prices_2026-10-22T235959.000000Z.json', 'flight_prices_2026-10-23T000001.000000Z.json', 'flight_prices_2026-10-25T114516.970466Z.json', 'notes.txt'];
  assert.deepEqual(recentSnapshots(names, '2026-10-23'), names.slice(1, 3));
});

test('stageRefresh lays the inputs out the way curate.py reads them, skips missing files and old snapshots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'n9r-root-'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n9r-stage-'));
  fs.mkdirSync(path.join(root, SNAPSHOT_DIR));
  fs.writeFileSync(path.join(root, SNAPSHOT_DIR, 'flight_prices_2026-10-20T080000.000000Z.json'), '{}');
  fs.writeFileSync(path.join(root, SNAPSHOT_DIR, 'flight_prices_2026-10-24T080000.000000Z.json'), '{}');
  fs.writeFileSync(path.join(root, FEED_FILES[0]), '{}');
  fs.writeFileSync(path.join(root, 'sparkfare_price_history.json'), '{}');
  const counts = stageRefresh(root, dir, '2026-10-23');
  assert.deepEqual(counts, { feeds: 2, history: 1, snapshots: 1 });
  assert.deepEqual(fs.readdirSync(path.join(dir, 'feeds')).sort(), [`current-${FEED_FILES[0]}`, 'snapshot-flight_prices_2026-10-24T080000.000000Z.json']);
  // curate.py treats only a file named sparkfare_price_history.json as the JFK daily history (bare keys are JFK there)
  assert.deepEqual(fs.readdirSync(path.join(dir, 'history')), ['sparkfare_price_history.json__now.json']);
});

test('the daily workflow is a dry run by hand, live on a schedule, and runs after the daily fetch', () => {
  const y = fs.readFileSync(new URL('../.github/workflows/curate-fares-daily.yml', import.meta.url), 'utf8');
  assert.match(y, /workflow_run:\s*\n\s*workflows: \['Sparkfare Daily Flight Data Pipeline'\]/);
  assert.match(y, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(y, /DRY_RUN: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.dry_run != 'false' \}\}/);
  assert.match(y, /cron: '\d+ \d+ \* \* \*'/);
  assert.doesNotMatch(y, /cron: '\d+ \d+ \* \* \*'[\s\S]*cron:/); // one schedule only
});

test('no workflow step name holds a colon and a space (invalid YAML: the cause of the broken curate-fares.yml)', () => {
  const dir = new URL('../.github/workflows/', import.meta.url);
  const bad = [];
  for (const f of fs.readdirSync(dir)) {
    for (const l of fs.readFileSync(new URL(f, dir), 'utf8').split('\n')) {
      const m = /^\s*- name: (.*)$/.exec(l);
      if (m && /: /.test(m[1]) && !/^['"]/.test(m[1])) bad.push(`${f}: ${l.trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});
