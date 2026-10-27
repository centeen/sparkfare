import test from 'node:test';
import assert from 'node:assert/strict';
import { readShadowDiff } from '../src/shadowDiff.js';

const raw = (files) => ({ async get(k) { return k in files ? { text: async () => JSON.stringify(files[k]) } : null; } });
const NOW = new Date('2026-10-27T12:00:00Z');
const f = (o = {}) => ({ clean: false, served: 40, shadow: 40, missing: 0, added: 0, status_changes: 2, price_diffs: 0, ...o });
const KEY = 'serving-shadow/diff-latest.json';

test('no binding or no diff yet reports no problems', async () => {
  assert.deepEqual(await readShadowDiff({}, NOW), { details: [], problems: [] });
  const r = await readShadowDiff({ RAW: raw({}) }, NOW);
  assert.deepEqual(r.problems, []);
  assert.match(r.details[0].line, /none recorded yet/);
});

test('verdict changes are reported as lines, not problems', async () => {
  const r = await readShadowDiff({ RAW: raw({ [KEY]: { date: '2026-10-27', files: { hourly: f() } } }) }, NOW);
  assert.deepEqual(r.problems, []);
  assert.match(r.details[0].line, /hourly: 2 verdict change\(s\), 0 price difference\(s\), 0 missing, 0 added/);
});

test('missing or added records are a problem', async () => {
  const r = await readShadowDiff({ RAW: raw({ [KEY]: { date: '2026-10-27', files: { daily_jfk: f({ missing: 3 }) } } }) }, NOW);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /3 record\(s\) missing/);
});

test('a diff older than two days is a problem; an unreadable one does not throw', async () => {
  const stale = await readShadowDiff({ RAW: raw({ [KEY]: { date: '2026-10-23', files: {} } }) }, NOW);
  assert.match(stale.problems[0], /has stopped/);
  const bad = await readShadowDiff({ RAW: { get: async () => { throw new Error('boom'); } } }, NOW);
  assert.match(bad.problems[0], /could not be read/);
});
