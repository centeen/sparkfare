// Q0's production read file runs on the real schema and returns what it says. Counts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const files = () => fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const statements = () => fs.readFileSync(new URL('../docs/q0_production_reads.sql', import.meta.url), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);

test('every query in docs/q0_production_reads.sql runs on the migrated schema (empty database)', () => {
  const db = makeSqliteD1(files()).raw;
  const all = statements();
  assert.equal(all.length, 7);
  for (const sql of all) assert.doesNotThrow(() => db.prepare(sql).all(), sql.slice(0, 60));
});

test('the per-recipient-per-day count finds two emails to one address on one day, and nothing identifying is selected', () => {
  const db = makeSqliteD1(files()).raw;
  const today = new Date().toISOString().slice(0, 10);
  db.exec(`INSERT INTO daily_alert_deliveries (delivery_key, email, delivered_on, status) VALUES ('k1', 'a@example.com', '${today}', 'sent'), ('k2', 'b@example.com', '${today}', 'sent')`);
  db.exec(`INSERT INTO departing_soon_deliveries (trip_id, email, status, created_at) VALUES ('t1', 'a@example.com', 'sent', datetime('now'))`);
  const rows = statements().slice(1, 2).map((q) => db.prepare(q).all().map((r) => ({ ...r })))[0];
  assert.deepEqual(rows, [{ emails_that_day: '1', recipient_days: 1 }, { emails_that_day: '2', recipient_days: 1 }]);
  const kinds = db.prepare(statements()[2]).all().map((r) => ({ ...r }));
  assert.deepEqual(kinds, [{ kinds: 'departing_soon + digest', recipient_days: 1 }]);
  for (const sql of statements()) for (const r of db.prepare(sql).all()) assert.doesNotMatch(JSON.stringify(r), /@/);
});

test('frequency and scanner queries count what they should', () => {
  const db = makeSqliteD1(files()).raw;
  db.exec(`INSERT INTO users (id, email, verified_email, frequency) VALUES ('u1','a@example.com',1,'daily'), ('u2','b@example.com',1,'instant'), ('u3','c@example.com',0,NULL)`);
  const freq = db.prepare(statements()[0]).all().map((r) => ({ ...r }));
  assert.deepEqual(freq.map((r) => [r.frequency, r.users]).sort(), [['NULL', 1], ['daily', 1], ['instant', 1]]);
  db.exec(`INSERT INTO events (event_type, meta, ts) VALUES
    ('email_click', '{"email_id":"e1","link":"https://x/a"}', '2026-10-20 10:00:00'),
    ('email_click', '{"email_id":"e1","link":"https://x/b"}', '2026-10-20 10:00:02'),
    ('email_click', '{"email_id":"e1","link":"https://x/c"}', '2026-10-20 10:00:03'),
    ('email_click', '{"email_id":"e2","link":"https://x/a"}', '2026-10-20 11:00:00')`);
  const scan = { ...db.prepare(statements()[6]).get() };
  assert.deepEqual(scan, { emails_with_clicks: 2, with_3_or_more_distinct_links: 1, with_3_or_more_clicks_within_10_seconds: 1, clicks_total: 4 });
});
