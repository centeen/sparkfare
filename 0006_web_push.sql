ALTER TABLE users ADD COLUMN notify_email INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_push INTEGER DEFAULT 0;

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
