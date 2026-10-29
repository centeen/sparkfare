-- Q8: a row means the guardrails paused that email stream (complaints or hard bounces over the limit). The Worker also creates the table on first use.
CREATE TABLE IF NOT EXISTS stream_pauses (
  stream TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  paused_at TEXT DEFAULT (datetime('now'))
);
