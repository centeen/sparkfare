-- B3 (2026-09-25): passenger_count and partner_id are read/written throughout src/index.js
-- (/api/signup, /api/preferences, every Away Mode email trigger point) but were never covered by
-- any migration -- both were originally added to production as one-off manual ALTER TABLE runs
-- (Workplan Steps 89 and the passenger_count/pet_owner audit), same gap as 0004's early_access/
-- referred_by. Doesn't block any other migration (nothing else in this set references either
-- column), so this is its own file rather than folded into an earlier one.
ALTER TABLE users ADD COLUMN partner_id TEXT;
ALTER TABLE users ADD COLUMN passenger_count INTEGER DEFAULT 1;
