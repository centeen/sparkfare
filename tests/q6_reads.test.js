// Q6's production read file runs on the migrated schema and counts what it says. Counts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const files = () => fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const statements = () => fs.readFileSync(new URL('../docs/q6_production_reads.sql', import.meta.url), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);

test('every query in docs/q6_production_reads.sql runs on the migrated schema (empty database), and none selects an address', () => {
  const db = makeSqliteD1(files()).raw;
  const all = statements();
  assert.equal(all.length, 5);
  for (const sql of all) { assert.doesNotThrow(() => db.prepare(sql).all(), sql.slice(0, 60)); assert.doesNotMatch(JSON.stringify(db.prepare(sql).all()), /@/); }
});

test('the old and new rule counts differ exactly for accounts between 45 and 90 days old', () => {
  const db = makeSqliteD1(files()).raw;
  const add = (id, created, opened, clicked) => db.prepare('INSERT INTO users (id, email, verified_email, is_subscribed, created_at, last_opened_at, last_clicked_at) VALUES (?, ?, 1, 1, datetime(\'now\', ?), ?, ?)')
    .run(id, `${id}@example.com`, created, opened ? `${opened}` : null, clicked ? `${clicked}` : null);
  add('young', '-20 days', null, null);        // too new for either rule
  add('mid', '-60 days', null, null);          // old rule only
  add('old', '-120 days', null, null);         // both rules
  add('old_opener', '-120 days', new Date(Date.now() - 5 * 86400000).toISOString().replace('T', ' ').slice(0, 19), null); // opened recently: neither
  add('old_clicker', '-120 days', null, new Date(Date.now() - 10 * 86400000).toISOString().replace('T', ' ').slice(0, 19)); // clicked recently: not the full new rule
  const one = { ...db.prepare(statements()[0]).get() };
  assert.deepEqual([one.old_rule_would_pause, one.new_rule_would_pause, one.subscribed], [3, 2, 5]); // old rule: mid, old, old_clicker | new rule, open-only half: old, old_clicker | all five subscribed
  const full = { ...db.prepare(statements()[4]).get() };
  assert.deepEqual([full.ever_clicked, full.new_rule_would_pause], [1, 1]); // the full rule pauses only 'old': old_clicker clicked recently, old_opener opened recently, mid is under 90 days
});
