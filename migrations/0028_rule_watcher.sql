-- 0028: rule watcher (Addendum G, task G2; ROADMAP step 88).
-- The Worker also creates these tables inline (CREATE TABLE IF NOT EXISTS) the first time the watcher runs, so applying
-- this file is optional bookkeeping. NOT applied automatically by deploy. To apply:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0028_rule_watcher.sql
-- and record it in d1_migrations. Rollback: DROP TABLE rule_watch_urls; DROP TABLE rule_status_overrides;
CREATE TABLE IF NOT EXISTS rule_watch_urls (
  url TEXT PRIMARY KEY,
  hash TEXT,
  last_checked TEXT,
  last_changed TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS rule_status_overrides (
  rule_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  reason TEXT,
  url TEXT,
  held_at TEXT,
  as_of TEXT,
  note TEXT,
  updated_at TEXT
);
