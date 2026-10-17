// Addendum D item 2 (option A): the counts quoted in older blog posts match the repo. When the origin list or the live
// partner list changes, these fail so the posts are updated with it instead of going stale again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const wf = read('.github/workflows/hourly-multi-origin-fetch.yml');
const originList = wf.match(/github\.event_name == 'schedule' && '([A-Z,]+)'/)[1].split(',');
const FETCHED = originList.length; // US hubs plus TLV
const US = originList.filter((o) => o !== 'TLV').length;
const text = (p) => read(p).replace(/<[^>]*>/g, ' ');

test('the workflow fetches 23 origins, 22 of them US hubs (the figures the posts use)', () => {
  assert.equal(FETCHED, 23);
  assert.equal(US, 22);
});

test('origin counts in the methodology and TLV posts match the workflow', () => {
  assert.match(text('blog/multi-origin-baselines.html'), new RegExp(`tracks ${FETCHED} home airports`));
  assert.match(text('blog/multi-origin-baselines.html'), new RegExp(`other ${US} origins`));
  assert.match(text('blog/why-the-hourly-pipeline-exists.html'), new RegExp(`other ${US} origins`));
  assert.match(text('blog/why-the-hourly-pipeline-exists.html'), new RegExp(`all ${FETCHED} origins`));
  assert.match(text('blog/why-tlv-is-on-the-list.html'), new RegExp(`after ${US} US airports`));
  assert.match(text('blog/why-tlv-is-on-the-list.html'), new RegExp(`The ${US} US origins`));
});

test('the rate-limit post does its arithmetic with the current origin count', () => {
  const t = text('blog/avoiding-the-rate-limit.html');
  const perHour = FETCHED * 40;
  assert.match(t, new RegExp(`${FETCHED} origins times 40 destinations is ${perHour} requests per hour`));
  assert.ok(perHour / 60 < 16 && perHour / 60 > 15, 'the per-minute average quoted as "under 16" must hold');
  assert.match(t, /under 16 per minute/);
  assert.ok(perHour / 60 < 300);
});

test('partner counts: the posts say thirteen, and thirteen partner rows are live after every migration', () => {
  const migrations = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
  const live = makeSqliteD1(migrations).raw.prepare("SELECT count(*) AS n FROM partners WHERE status = 'live'").get().n;
  assert.equal(live, 13);
  assert.match(text('blog/away-mode-checklist.html'), /exactly 13 live partners/);
  assert.equal((read('blog/away-mode-checklist.html').match(/<p class="partner-name">/g) || []).length, live, 'one card per live partner');
  assert.match(text('blog/how-we-pick-away-mode-partners.html'), /Thirteen real, live, working partners/);
  assert.match(text('blog/index.html'), /Thirteen real, live partners today/);
});

test('no stale "3-partner", "three real", or old origin counts remain anywhere in blog/', () => {
  const stale = /13 origins|13 home airports|12 origins|other 12 origins|all 13 origins|the 13th|12 US|[Tt]hree real|3-[Pp]artner|520 requests|ten logos|ten guessed/;
  const bad = fs.readdirSync(new URL('../blog', import.meta.url)).filter((f) => f.endsWith('.html') && stale.test(read(`blog/${f}`)));
  assert.deepEqual(bad, []);
});
