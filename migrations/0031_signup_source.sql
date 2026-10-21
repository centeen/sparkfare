-- 0031: Addendum M, M1 (ROADMAP step 140, owner decision 2026-10-21): first-touch signup source on the user row.
-- Until now the source lived only in the `signup` event's meta, so growth reports had to join events. This column holds the
-- sanitized value the signup form sent (home, check, leave, pto, widget, pseo, referral, ...; 'direct' when none).
-- Additive and nullable; existing rows stay NULL (signups made before this shipped have no recorded source).
-- Apply to production BEFORE the M1 code merges (deploys do not run migrations):
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0031_signup_source.sql
-- and record it in d1_migrations. Rollback: ALTER TABLE users DROP COLUMN signup_source;
ALTER TABLE users ADD COLUMN signup_source TEXT;
