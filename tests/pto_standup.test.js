// The Monday brief carries a "Time-off planner" line (ROADMAP step 72): counts only, zero when nothing happened,
// and a missing events table never breaks it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { computeWeeklyStandup, renderWeeklyStandup } from '../src/weeklyStandup.js';

const NOW = new Date('2026-10-12T09:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

function db() {
  const d = makeSqliteD1(['migrations/0000_base_schema.sql', 'migrations/0013_events.sql']);
  const ev = d.raw.prepare('INSERT INTO events (id, event_type, origin, source, ts) VALUES (?, ?, ?, ?, ?)');
  let n = 0;
  const add = (type, daysAgo) => ev.run(`p${++n}`, type, 'DEN', 'pto', ago(daysAgo));
  for (const day of [1, 1, 2, 3, 4]) add('pto_view', day);
  add('pto_view', 10); // the week before
  add('pto_ics_download', 2); add('pto_ics_download', 3);
  add('pto_share', 2);
  add('pto_signup', 1);
  return d;
}

test('the standup counts planner views, .ics downloads, shares and signups for the week and the week before', async () => {
  const m = await computeWeeklyStandup({ DB: db() }, { now: NOW });
  assert.deepEqual([m.ptoViews.week, m.ptoViews.prev], [5, 1]);
  assert.equal(m.ptoIcs.week, 2);
  assert.equal(m.ptoShares.week, 1);
  assert.equal(m.ptoSignups.week, 1);
  const text = renderWeeklyStandup(m).text;
  assert.match(text, /time-off planner \(\/time-off\)/i);
  assert.match(text, /Views: 5/);
  assert.match(text, /\.ics downloads: 2; shares: 1; signups from it: 1/);
});

test('with no planner activity the line reads zero, and no personal data appears', async () => {
  const empty = makeSqliteD1(['migrations/0000_base_schema.sql', 'migrations/0013_events.sql']);
  const m = await computeWeeklyStandup({ DB: empty }, { now: NOW });
  const text = renderWeeklyStandup(m).text;
  assert.match(text, /Views: 0.*\.ics downloads: 0; shares: 0; signups from it: 0/);
  assert.doesNotMatch(text, /@/);
});
