-- N8 (Addendum N, ROADMAP step 155): one row per day on which the daily data alert email (09:30 UTC) was sent, so a breach that
-- persists for days produces one email a day and never two on the same day. src/dataAlerts.js also creates it on first use.
-- Apply to production (additive) and record it in d1_migrations:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0035_data_alert_log.sql
CREATE TABLE IF NOT EXISTS data_alert_log (date TEXT PRIMARY KEY, breaches INTEGER NOT NULL, sent_at TEXT DEFAULT (datetime('now')));
