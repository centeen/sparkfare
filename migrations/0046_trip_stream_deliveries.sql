-- C1.2/C1.3: one row per trip per stage of the trip stream (d21, d7, d1, or d30, d14, d7, and return).
CREATE TABLE IF NOT EXISTS trip_stream_deliveries (
  trip_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  via TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (trip_id, stage)
);
