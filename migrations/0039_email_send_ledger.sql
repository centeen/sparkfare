-- Q1 (Addendum Q, ROADMAP step 172, D-049): the one-envelope send budget. One row per recipient per local day per kind of email; the Worker also creates this
-- inline on first use, so this file is bookkeeping and the table is additive. Rows are kept 90 days (D-042) and purged by the daily run.
-- Apply to production and record it in d1_migrations (auto-deploy does not run migrations):
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0039_email_send_ledger.sql
CREATE TABLE IF NOT EXISTS email_send_ledger (
  email TEXT NOT NULL,
  local_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  stream TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed',
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (email, local_date, kind)
);
CREATE INDEX IF NOT EXISTS idx_email_send_ledger_date ON email_send_ledger (local_date);
CREATE TABLE IF NOT EXISTS purchase_email_queue (
  trip_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  destination TEXT,
  partner_id TEXT,
  trip_length TEXT,
  passenger_count INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
