-- Public web archive of the daily digest (E2). One row per origin per day per kind ('daily' now,
-- 'weekly' for E3's Sunday edition). deals_json holds the slimmed deal records so old editions
-- can be re-rendered at request time with links pointing at live route pages.
-- Additive and idempotent. Rollback: DROP TABLE digest_editions;  (nothing else references it)
CREATE TABLE IF NOT EXISTS digest_editions (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  edition_date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'daily',
  edition_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  html_public TEXT NOT NULL,
  deals_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (origin, edition_date, kind)
);
CREATE INDEX IF NOT EXISTS idx_digest_editions_date ON digest_editions (edition_date DESC, origin);
