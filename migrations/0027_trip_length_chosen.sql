-- 0027: Trip length chosen vs defaulted (Design Council D-015, Addendum F Task F1.3).
-- Adds a boolean flag `trip_length_chosen` (0 = accepted default '7-10', 1 = explicitly selected by user).
-- PROPOSED ONLY: Do not apply to production until approved by the owner.
-- To apply:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0027_trip_length_chosen.sql
-- Rollback note:
--   SQLite / Cloudflare D1 does not support dropping a column directly via ALTER TABLE DROP COLUMN in all engines.
--   Because the column is nullable with DEFAULT 0, rolling back in practice simply means application code stops reading
--   and writing the field (it remains harmlessly ignored in the schema).
ALTER TABLE users ADD COLUMN trip_length_chosen INTEGER DEFAULT 0;
