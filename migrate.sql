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
CREATE TABLE events (
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
