ALTER TABLE users ADD COLUMN has_pet BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN last_opened_at TEXT;
ALTER TABLE users ADD COLUMN is_subscribed BOOLEAN DEFAULT 1;
ALTER TABLE users ADD COLUMN away_needs TEXT;

CREATE TABLE watchlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  origin_iata TEXT NOT NULL,
  destination TEXT NOT NULL,
  target_price INTEGER NOT NULL,
  notified_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
