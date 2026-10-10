-- Migration 0021: Sparkfare Plus waitlist (ROADMAP step 22e). An interest signal only: nothing is sold.
-- An address is on the list only once verified_at is set (double opt-in). The Worker also creates this table inline
-- on first use, so this file only keeps a fresh database in step. Additive and idempotent.
CREATE TABLE IF NOT EXISTS plus_waitlist (
  email TEXT PRIMARY KEY,
  source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_sent_at TEXT,
  verified_at TEXT
);

-- Rollback: DROP TABLE IF EXISTS plus_waitlist; (nothing else references it)
