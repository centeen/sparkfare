// Cloudflare numbers days of the week 1 = Sunday, so '0 9 * * 1' fired on Sundays (observed 2026-10-11, a Sunday).
// The weekly link check and standup are meant for Monday, which is 2 in Cloudflare's numbering.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('the weekly trigger is Monday in Cloudflare numbering (2), in wrangler.jsonc and in the Worker', () => {
  const crons = JSON.parse(wrangler.match(/"crons":\s*(\[[^\]]*\])/)[1]);
  const weekly = crons.filter((c) => c.split(' ')[4] !== '*');
  assert.deepEqual(weekly, ['0 9 * * 2']);
  assert.match(src, /const WEEKLY_LINK_HEALTH_CRON = '0 9 \* \* 2';/);
});

test('every cron string in the Worker that names a weekday is also registered in wrangler.jsonc', () => {
  const dayCrons = [...src.matchAll(/'(\d+ \d+ \* \* [1-7])'/g)].map((m) => m[1]);
  for (const c of dayCrons) assert.ok(wrangler.includes(`"${c}"`), `${c} is registered`);
});
