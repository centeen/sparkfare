-- N5 (Addendum N, ROADMAP step 153): channel attribution and the landing counter.
--   users.signup_channel / signup_campaign / signup_referrer_class: first touch, set once (src/attribution.js).
--   signup_source keeps meaning the surface (home, check, pto ...); it is not changed.
--   landings_daily: one row per day, channel, campaign and kind of page, with a count. No IP address, user agent or identifier.
-- Apply to production BEFORE merging code that writes to it:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0032_channel_attribution.sql
-- and record it in d1_migrations. Rollback: ALTER TABLE users DROP COLUMN signup_channel; (and the other two); DROP TABLE landings_daily;
ALTER TABLE users ADD COLUMN signup_channel TEXT;
ALTER TABLE users ADD COLUMN signup_campaign TEXT;
ALTER TABLE users ADD COLUMN signup_referrer_class TEXT;

CREATE TABLE IF NOT EXISTS landings_daily (
  date TEXT NOT NULL,
  channel TEXT NOT NULL,
  campaign TEXT NOT NULL DEFAULT '',
  page_class TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, channel, campaign, page_class)
);
CREATE INDEX IF NOT EXISTS idx_landings_daily_date ON landings_daily(date);
