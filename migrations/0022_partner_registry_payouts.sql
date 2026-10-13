-- 0022: F0 revenue per departure (branch feat/f0-revenue-per-departure).
-- 1. Each partner gets a revenue meter, a short category slug and an attribution mode. The partners.category column
--    stays the display label (it is shown on route pages and returned by /api/partners); category_slug is the stable name.
--    The Worker's source of truth is PARTNER_REGISTRY in src/meters.js and does not read these columns at runtime, so the
--    Worker works before and after this migration; tests/f0_registry.test.js fails if this file and the registry differ.
-- 2. partner_payouts: one row per month, partner and source, entered by the owner (or reported by an API). Re-posting a key
--    overwrites it. partner_conversions (0002) is left in place and is no longer written.
-- Additive and backward compatible. Not applied to production: do not run this against production without the owner
-- (see migrations_README.md on duplicate-column errors).
-- Rollback:
--   DROP TABLE partner_payouts;
--   ALTER TABLE partners DROP COLUMN meter; ALTER TABLE partners DROP COLUMN category_slug; ALTER TABLE partners DROP COLUMN attribution;

ALTER TABLE partners ADD COLUMN meter TEXT;
ALTER TABLE partners ADD COLUMN category_slug TEXT;
ALTER TABLE partners ADD COLUMN attribution TEXT;

UPDATE partners SET meter = 'leave', category_slug = 'mail', attribution = 'none' WHERE slug = 'us-global-mail';
UPDATE partners SET meter = 'leave', category_slug = 'luggage_storage', attribution = 'none' WHERE slug = 'bounce';
UPDATE partners SET meter = 'leave', category_slug = 'flight_compensation', attribution = 'none' WHERE slug = 'airhelp';
UPDATE partners SET meter = 'leave', category_slug = 'esim', attribution = 'none' WHERE slug = 'yesim';
UPDATE partners SET meter = 'leave', category_slug = 'esim', attribution = 'none' WHERE slug = 'holafly';
UPDATE partners SET meter = 'leave', category_slug = 'currency', attribution = 'none' WHERE slug = 'wise';
UPDATE partners SET meter = 'leave', category_slug = 'vpn', attribution = 'none' WHERE slug = 'nordvpn';
UPDATE partners SET meter = 'leave', category_slug = 'language', attribution = 'none' WHERE slug = 'rocket-languages';
UPDATE partners SET meter = 'leave', category_slug = 'activities', attribution = 'none' WHERE slug = 'tiqets';
UPDATE partners SET meter = 'leave', category_slug = 'city_pass', attribution = 'none' WHERE slug = 'gocity';
UPDATE partners SET meter = 'leave', category_slug = 'car_rental', attribution = 'none' WHERE slug = 'qeeq';
UPDATE partners SET meter = 'leave', category_slug = 'transfers', attribution = 'none' WHERE slug = 'welcome-pickups';
UPDATE partners SET meter = 'leave', category_slug = 'travel_gear', attribution = 'none' WHERE slug = 'timekettle';
UPDATE partners SET meter = 'leave', category_slug = 'parking', attribution = 'none' WHERE slug = 'parking-access';
UPDATE partners SET meter = 'leave', category_slug = 'pet_care', attribution = 'none' WHERE slug = 'rover';
UPDATE partners SET meter = 'leave', category_slug = 'pet_supplies', attribution = 'none' WHERE slug = 'pet-gear';
UPDATE partners SET meter = 'leave', category_slug = 'insurance', attribution = 'none' WHERE slug = 'safetywing';

CREATE TABLE IF NOT EXISTS partner_payouts (
  month TEXT NOT NULL,            -- 'YYYY-MM'
  partner_id TEXT NOT NULL,       -- a partners.slug, or 'aviasales'
  amount_usd REAL NOT NULL,
  conversions INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,           -- 'travelpayouts_api' | 'partner_dashboard' | 'manual'
  note TEXT,
  entered_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (month, partner_id, source)
);
