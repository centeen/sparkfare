-- 0026: Petcube goes live (Design Council D-013, owner approval 2026-10-16, Addendum C task C3).
-- Awin merchant 33889. The link is exactly the one the owner supplied from Awin's link builder, stored as given: it is
-- reached only through /out/petcube?src=away_mode, which logs the click with a fixed source tag and carries no traveler data
-- (no dates, email, trip or user id are ever appended). Placement is limited to the Away Mode partner list by
-- PLACEMENT_BY_CATEGORY (pet_care -> away_mode in src/meters.js): never route pages, never the generic emails.
-- NOT applied automatically by deploy, and not applied until the owner confirms after the council's review:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0026_petcube_live.sql
-- and record it in d1_migrations. Rollback: UPDATE partners SET status = 'pending', url_template = '' WHERE slug = 'petcube';
UPDATE partners
   SET url_template = 'https://www.awin1.com/cread.php?awinmid=33889&awinaffid=3086775&ued=https%3A%2F%2Fpetcube.com%2Fstore%2Fcategory%2Fcameras%2F',
       status = 'live',
       status_reason = NULL,
       updated_at = datetime('now')
 WHERE slug = 'petcube';
