-- 0030: K-A4 (ROADMAP step 122, owner decision D-032, 2026-10-17): Petcube is hidden again. The row stays, status 'pending', so
-- /api/partners, /away-mode and every email stop listing it and /out/petcube answers 403. G62 (whether it comes back) stays open.
-- Apply to production BEFORE the K-A4 PR merges (deploys do not run migrations):
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0030_petcube_hidden_again.sql
-- and record it in d1_migrations. Rollback: UPDATE partners SET status = 'live', status_reason = NULL WHERE slug = 'petcube';
UPDATE partners
   SET status = 'pending',
       status_reason = 'Hidden by owner decision D-032 (2026-10-17); G62 open',
       updated_at = datetime('now')
 WHERE slug = 'petcube';
