-- Analytics/guard event log. Defined in migrate.sql but never applied to production; the email
-- sending guard and logEvent() both depend on it. Additive and idempotent.
-- Rollback: DROP TABLE events;  (safe: nothing else references it)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  ts TEXT DEFAULT (datetime('now')),
  event_type TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  anon_id TEXT,
  origin TEXT,
  route TEXT,
  partner TEXT,
  sub_id TEXT,
  source TEXT,
  meta TEXT
);
