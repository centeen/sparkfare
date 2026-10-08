// GitHub delays or drops scheduled workflows at the top of the hour. The daily fetch ran on
// '0 6 * * *' and, for at least 12 days in a row, started between 10:46 and 13:32 UTC, 5 to 7.5 hours
// late, so the 07:10 compile and the 08:00 UTC digest ran on the previous day's JFK data. These tests
// keep the schedules off the congested slots and keep the public social post out of the data workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const wf = (name) => fs.readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
const crons = (name) => [...wf(name).matchAll(/^\s*- cron:\s*'([^']+)'/gm)].map((m) => m[1]);
const parse = (c) => { const [min, hour] = c.split(' '); return { min: Number(min), hour: Number(hour) }; };

test('daily-fetch has one off-peak slot that lands before the 08:00 UTC digest', () => {
  const list = crons('daily-fetch');
  assert.equal(list.length, 1, 'one slot only: a second run the same day would be a second social post or wasted work');
  const { min, hour } = parse(list[0]);
  assert.notEqual(min, 0, 'minute 0 is the congested slot');
  assert.ok(hour <= 5, `fetch hour ${hour} must leave room before the 08:00 UTC digest`);
});

test('no daily or hourly data workflow uses a top-of-the-hour cron', () => {
  for (const name of ['daily-fetch', 'daily-compile-other-origins', 'hourly-multi-origin-fetch', 'daily-social-post']) {
    for (const c of crons(name)) assert.notEqual(parse(c).min, 0, `${name}: ${c}`);
  }
});

test('the social post is not part of the data workflow', () => {
  const text = wf('daily-fetch');
  assert.doesNotMatch(text, /Social Broadcaster/);
  assert.doesNotMatch(text, /BLUESKY|MASTODON|TELEGRAM/);
  assert.doesNotMatch(text, /sparkfare_broadcast_history/);
  assert.doesNotMatch(text, /atproto|Pillow/);
});

test('daily-social-post runs once at a US-daytime hour, posts, and commits only its history file', () => {
  const list = crons('daily-social-post');
  assert.equal(list.length, 1);
  const { hour } = parse(list[0]);
  assert.ok(hour >= 12 && hour <= 17, `post hour ${hour} UTC should be US morning, not the middle of the night`);
  const text = wf('daily-social-post');
  assert.match(text, /python "Phase 3 Social Broadcaster\.py"/);
  for (const secret of ['BLUESKY_HANDLE', 'BLUESKY_PASSWORD', 'MASTODON_API_URL', 'MASTODON_ACCESS_TOKEN']) {
    assert.ok(text.includes(`secrets.${secret}`), secret);
  }
  assert.match(text, /contents: write/);
  const adds = [...text.matchAll(/git add ([^\n]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(adds, ['sparkfare_broadcast_history.json']);
  assert.match(text, /git pull --rebase origin main/, 'retries a rejected push like the other workflows');
  assert.match(text, /workflow_dispatch/);
});

test('daily-social-post: a manual run defaults to a dry run, the scheduled run still posts', () => {
  const text = wf('daily-social-post');
  // the manual trigger has a boolean dry_run input that defaults to true
  assert.match(text, /workflow_dispatch:\s+inputs:\s+dry_run:/);
  assert.match(text, /dry_run:[\s\S]*?type: boolean[\s\S]*?default: true/);
  // the broadcaster only gets --dry-run when the input is exactly 'true'; a schedule has no inputs, so it posts
  assert.match(text, /Social Broadcaster\.py" \$\{\{ github\.event\.inputs\.dry_run == 'true' && '--dry-run' \|\| '' \}\}/);
  // a dry run keeps the generated card as an artifact so it can be looked at
  assert.match(text, /if: \$\{\{ github\.event\.inputs\.dry_run == 'true' \}\}[\s\S]*?upload-artifact@v4[\s\S]*?path: deal_card\.jpg/);
  // the schedule block is unchanged: one slot, no inputs
  assert.equal(crons('daily-social-post').length, 1);
});

test('the broadcaster really has a --dry-run that posts nothing', () => {
  const py = fs.readFileSync(new URL('../Phase 3 Social Broadcaster.py', import.meta.url), 'utf8');
  const dry = py.indexOf('if args.dry_run:');
  assert.ok(dry !== -1, 'a --dry-run branch exists');
  for (const post of ['post_bluesky(', 'post_mastodon(', 'post_telegram(']) {
    assert.ok(py.indexOf(post, py.indexOf('def main')) > dry, `${post} must come after the dry-run return`);
  }
  assert.ok(py.indexOf('Updated {BROADCAST_HISTORY_FILE}') > dry, 'the post history is only written after the dry-run return');
});

// ---- The daily compile is chained to the daily fetch -------------------------------------------------
// GitHub starts both schedules hours late and independently, so a fixed compile time can land before the
// fetch it depends on (the /data/ pages then regenerate from yesterday's JFK file). The compile now runs
// when the fetch finishes; the cron is only a fallback for a day the fetch fails.

const fetchName = () => wf('daily-fetch').match(/^name:\s*(.+)$/m)[1].trim();

test('the compile is triggered by the daily fetch completing, matched on the fetch workflow\'s exact name', () => {
  const text = wf('daily-compile-other-origins');
  const block = text.match(/workflow_run:\s*\n([\s\S]*?)\n  schedule:/);
  assert.ok(block, 'a workflow_run trigger exists');
  assert.ok(block[1].includes(`workflows: ["${fetchName()}"]`), 'must match the fetch workflow name exactly');
  assert.match(block[1], /types: \[completed\]/);
  assert.match(block[1], /branches: \[main\]/);
  assert.match(text, /workflow_dispatch: \{\}/, 'still runnable by hand');
});

test('the compile cron is only a fallback: one off-peak slot, after the fetch slot, never the top of the hour', () => {
  const list = crons('daily-compile-other-origins');
  assert.equal(list.length, 1);
  const c = parse(list[0]);
  assert.notEqual(c.min, 0);
  assert.ok(c.hour > parse(crons('daily-fetch')[0]).hour, 'the fallback must come after the fetch slot');
});

test('the compile job waits for the gate and runs only when the gate says so', () => {
  const text = wf('daily-compile-other-origins');
  assert.match(text, /jobs:\s+gate:/);
  assert.match(text, /compile-and-rank-other-origins:\s+needs: gate\s+if: needs\.gate\.outputs\.run == 'true'/);
  assert.match(text, /actions: read/, 'the gate reads this repo\'s workflow runs');
});

test('compiles never overlap, and a waiting run is kept rather than cancelled', () => {
  const text = wf('daily-compile-other-origins');
  assert.match(text, /concurrency:\s+group: daily-compile-other-origins\s+cancel-in-progress: false/);
});

test('the compile still regenerates the pSEO pages and commits with the push-retry loop', () => {
  const text = wf('daily-compile-other-origins');
  assert.match(text, /python "Phase 17 pSEO Generator \(Step 106\)\.py"/);
  assert.match(text, /git add [^\n]*\bdata\/ sitemap\.xml/);
  assert.match(text, /git pull --rebase origin main/);
});

// Run the gate's real shell script with a stubbed `gh` and check its decision.
const bashOk = (() => { try { execFileSync('bash', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

function gateScript() {
  const text = wf('daily-compile-other-origins');
  const m = text.match(/id: decide[\s\S]*?\n        run: \|\n([\s\S]*?)\n\n  compile-and-rank-other-origins:/);
  assert.ok(m, 'gate script found');
  return m[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
}

function decide({ event, upstream = '', lastSuccessAgoHours = null }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const out = path.join(dir, 'out.txt');
  fs.writeFileSync(out, '');
  fs.writeFileSync(path.join(dir, 'script.sh'), gateScript());
  // a stub `gh` that prints the timestamp the real `gh run list ... --jq` would print (or nothing)
  fs.writeFileSync(path.join(dir, 'gh'), '#!/bin/sh\necho "$FAKE_LAST"\n', { mode: 0o755 });
  const last = lastSuccessAgoHours === null ? '' : new Date(Date.now() - lastSuccessAgoHours * 3600 * 1000).toISOString();
  const toBashPath = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
  execFileSync('bash', [toBashPath(path.join(dir, 'script.sh'))], {
    env: {
      ...process.env,
      PATH: `${toBashPath(dir)}:${process.env.PATH}`,
      GITHUB_OUTPUT: toBashPath(out),
      EVENT: event, UPSTREAM: upstream, FALLBACK_WINDOW_HOURS: '12', FAKE_LAST: last,
    },
    stdio: 'pipe',
  });
  return fs.readFileSync(out, 'utf8').trim();
}

const g = { skip: !bashOk && 'bash not available' };

test('gate: a successful daily fetch triggers the compile', g, () => {
  assert.equal(decide({ event: 'workflow_run', upstream: 'success' }), 'run=true');
});

test('gate: a failed or cancelled daily fetch does not trigger the compile', g, () => {
  assert.equal(decide({ event: 'workflow_run', upstream: 'failure' }), 'run=false');
  assert.equal(decide({ event: 'workflow_run', upstream: 'cancelled' }), 'run=false');
});

test('gate: the fallback schedule skips when a compile succeeded within 12 hours', g, () => {
  assert.equal(decide({ event: 'schedule', lastSuccessAgoHours: 0.5 }), 'run=false');
  assert.equal(decide({ event: 'schedule', lastSuccessAgoHours: 11 }), 'run=false');
});

test('gate: the fallback schedule runs when the last success is old or there is none', g, () => {
  assert.equal(decide({ event: 'schedule', lastSuccessAgoHours: 13 }), 'run=true');
  assert.equal(decide({ event: 'schedule', lastSuccessAgoHours: 40 }), 'run=true');
  assert.equal(decide({ event: 'schedule', lastSuccessAgoHours: null }), 'run=true');
});

test('gate: a manual run always compiles', g, () => {
  assert.equal(decide({ event: 'workflow_dispatch', lastSuccessAgoHours: 0.1 }), 'run=true');
});
