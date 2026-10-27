-- N11 (Addendum N, ROADMAP step 158): the metrics layer's daily store. One row per day, KPI and dimension, written by src/metrics/daily.js
-- (09:30 UTC, inside the existing data-alert cron: no new trigger). `value` is the day's measure, `n` the sample behind it (the denominator for a
-- share, the count itself for a count); ratios are never stored, they are derived from stored sums when read. Counts only: no email, no user id.
-- Apply to production (additive) and record it in d1_migrations:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0037_metrics_daily.sql
CREATE TABLE IF NOT EXISTS metrics_daily (
  date TEXT NOT NULL,                 -- UTC calendar date, YYYY-MM-DD
  metric_id TEXT NOT NULL,            -- an id from src/metrics/definitions.js (KPI_CATALOG[].stored)
  dimension TEXT NOT NULL DEFAULT '', -- '' when the KPI has none
  value REAL NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, metric_id, dimension)
);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_metric ON metrics_daily (metric_id, date);
