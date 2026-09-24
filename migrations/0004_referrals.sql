-- B3 (2026-09-25): this file's own backfill queries below reference users.referred_by and
-- users.early_access, but no earlier migration ever creates them -- confirmed via
-- `wrangler d1 migrations apply --local` against a fresh database, which failed here with
-- "no such column: referred_by" before this fix. These were originally added to production
-- as one-off manual ALTER TABLE runs (Workplan Step 93), never captured as a migration until now.
ALTER TABLE users ADD COLUMN early_access INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN referred_by TEXT;

CREATE TABLE referral_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Backfill from existing users
-- Anyone who has `early_access=1` and a `referred_by` is considered 'confirmed'
INSERT INTO referrals (id, referrer_id, referred_id, status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), referred_by, id, 'confirmed', datetime('now'), datetime('now')
FROM users
WHERE referred_by IS NOT NULL AND early_access = 1;

-- Backfill pending ones just in case
INSERT INTO referrals (id, referrer_id, referred_id, status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), referred_by, id, 'pending', datetime('now'), datetime('now')
FROM users
WHERE referred_by IS NOT NULL AND early_access = 0;
