CREATE TABLE consent_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  source TEXT,
  wording_version TEXT,
  ip_hash TEXT
);

CREATE TABLE email_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL, -- 'bounce', 'complaint', 'unsubscribed'
  created_at TEXT DEFAULT (datetime('now'))
);
