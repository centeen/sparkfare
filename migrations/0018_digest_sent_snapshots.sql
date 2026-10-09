-- E3 skip-if-unchanged (ROADMAP step 21). What the daily digest contained for each origin on each day it was sent,
-- slimmed to {display_name, price}. The next day's deals are compared with the latest earlier row to decide NEW /
-- PRICE DROP / STILL AVAILABLE and whether anything changed. The Worker also creates this table inline on first use,
-- so this file only keeps a fresh database in step. Additive and idempotent. Rollback: DROP TABLE digest_sent_snapshots;
CREATE TABLE IF NOT EXISTS digest_sent_snapshots (
  origin TEXT NOT NULL,
  sent_on TEXT NOT NULL,
  deals_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (origin, sent_on)
);
