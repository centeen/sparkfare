// GitHub delays or drops scheduled workflows at the top of the hour. The daily fetch ran on
// '0 6 * * *' and, for at least 12 days in a row, started between 10:46 and 13:32 UTC, 5 to 7.5 hours
// late, so the 07:10 compile and the 08:00 UTC digest ran on the previous day's JFK data. These tests
// keep the schedules off the congested slots and keep the public social post out of the data workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wf = (name) => fs.readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
const crons = (name) => [...wf(name).matchAll(/^\s*- cron:\s*'([^']+)'/gm)].map((m) => m[1]);
const parse = (c) => { const [min, hour] = c.split(' '); return { min: Number(min), hour: Number(hour) }; };

test('daily-fetch has one off-peak slot that lands before the 07:10 compile and the 08:00 UTC digest', () => {
  const list = crons('daily-fetch');
  assert.equal(list.length, 1, 'one slot only: a second run the same day would be a second social post or wasted work');
  const { min, hour } = parse(list[0]);
  assert.notEqual(min, 0, 'minute 0 is the congested slot');
  assert.ok(hour <= 5, `fetch hour ${hour} must leave room before the 07:10 UTC compile and 08:00 UTC digest`);
  assert.deepEqual(parse(crons('daily-compile-other-origins')[0]), { min: 10, hour: 7 }, 'the compile slot this was timed against');
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
