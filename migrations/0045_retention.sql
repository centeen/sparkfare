-- N13 (retention and deletion jobs, dark): the monthly roll-up of old events, and the three markers the personal-data rule needs.
CREATE TABLE IF NOT EXISTS events_monthly_agg (
  month TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ua_class TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL,
  PRIMARY KEY (month, event_type, ua_class)
);
ALTER TABLE users ADD COLUMN sunset_at TEXT;
ALTER TABLE users ADD COLUMN deletion_requested_at TEXT;
ALTER TABLE users ADD COLUMN anonymized_at TEXT;
