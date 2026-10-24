-- N4 (Addendum N, ROADMAP step 152; framework DR-26): indexes for the queries that scan the biggest tables.
-- Only indexes are added (nothing is changed or removed), so it is safe to run more than once.
--   events(ts), events(event_type, ts): the Monday standup, the growth report, the revenue report and the health check all
--     filter events by type and a time window; until now every one of them read the whole table.
--   users(verified_email, is_subscribed): the daily digest's recipient query; users(created_at): signups per week.
--   trips(user_id): idx_trips_user already exists in production (it was created at runtime); IF NOT EXISTS keeps this a no-op there.
-- Apply to production before the code that relies on it:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0033_capacity_indexes.sql
-- and record it in d1_migrations. Rollback: DROP INDEX for each name below.
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event_type, ts);
CREATE INDEX IF NOT EXISTS idx_users_verified_subscribed ON users(verified_email, is_subscribed);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
