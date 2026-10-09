-- Migration 0019: PTO long-weekend window watches (ROADMAP step 74, Track C of claude_code_pto_fare_calendar_2026-10-09.md).
-- Lets visitors watch a long-weekend window from their origin (email-only, no account required) and get alerted when
-- the lowest fare for those dates drops.

CREATE TABLE IF NOT EXISTS pto_window_watches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  origin_iata TEXT NOT NULL,
  window_start TEXT NOT NULL,   -- YYYY-MM-DD
  window_end TEXT NOT NULL,     -- YYYY-MM-DD
  destination TEXT,             -- NULL = any fitting destination
  last_alert_price INTEGER,
  last_alerted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pto_watch_unique ON pto_window_watches(user_id, origin_iata, window_start, window_end, destination);
CREATE INDEX IF NOT EXISTS idx_pto_watch_window_end ON pto_window_watches(window_end);

-- Rollback: DROP TABLE IF EXISTS pto_window_watches; (no other table references it)
