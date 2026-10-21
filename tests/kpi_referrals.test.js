// The KPI dashboard's referral numbers (2026-10-20). The old "Early-access users" card counted users.early_access, which stopped
// growing when the early send was retired, so it now reads the referrals table. Run against real SQLite, because the mock
// databases in the older suites cannot execute a grouped subquery.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { computeKPIs } from '../src/index.js';

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, verified_email INTEGER DEFAULT 0, is_subscribed INTEGER DEFAULT 1,
      early_access INTEGER DEFAULT 0, referred_by TEXT, partner_id TEXT);
    CREATE TABLE referrals (id TEXT PRIMARY KEY, referrer_id TEXT, referred_id TEXT, status TEXT);`);
  const stmt = (sql, p) => ({
    run: async () => { const r = db.prepare(sql).run(...p); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...p) }),
  });
  return { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}
const ref = (d1, id, referrer, status) => d1._db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, status) VALUES (?, ?, ?, ?)').run(id, referrer, `f_${id}`, status);

test('confirmed referrals and the watchlist-tier count come from the referrals table', async () => {
  const d1 = makeD1();
  for (let i = 0; i < 3; i++) ref(d1, `a${i}`, 'user_a', 'confirmed');   // user_a: 3 confirmed -> at the tier
  for (let i = 0; i < 2; i++) ref(d1, `b${i}`, 'user_b', 'confirmed');   // user_b: 2 confirmed -> not yet
  ref(d1, 'b2', 'user_b', 'pending');                                    // pending never counts
  for (let i = 0; i < 4; i++) ref(d1, `c${i}`, 'user_c', 'confirmed');   // user_c: 4 -> at the tier
  const kpi = await computeKPIs({ DB: d1 });
  assert.equal(kpi.viral.confirmed_referrals, 9);
  assert.equal(kpi.viral.watchlist_tier_users, 2);
});

test('the old early-access count is gone, and a stale early_access column does not move the new numbers', async () => {
  const d1 = makeD1();
  d1._db.exec("INSERT INTO users (id, email, early_access) VALUES ('u1', 'u1@example.com', 1), ('u2', 'u2@example.com', 1)");
  const kpi = await computeKPIs({ DB: d1 });
  assert.equal('early_access_users' in kpi.viral, false);
  assert.equal(kpi.viral.confirmed_referrals, 0);
  assert.equal(kpi.viral.watchlist_tier_users, 0);
});

test('a missing referrals table reads as zero instead of failing the dashboard', async () => {
  const d1 = makeD1();
  d1._db.exec('DROP TABLE referrals');
  const kpi = await computeKPIs({ DB: d1 });
  assert.equal(kpi.viral.confirmed_referrals, 0);
  assert.equal(kpi.viral.watchlist_tier_users, 0);
});
