-- 0025: Petcube (pet cameras), staged dark. Design Council D-013 (2026-10-15), Addendum C task C2.
-- Approved by Awin (merchant 33889), 10% of order value, 60-day cookie (owner-reported). The row is HIDDEN: status 'pending'
-- means /api/partners, the route pages, the emails and /away-mode never list it, and /out/petcube redirects to /away-mode
-- and logs nothing (RETIRED_PARTNER_SLUGS in src/index.js). No link is stored on purpose: the owner supplies the final
-- camera-page link from Awin's link builder at the flip PR (C3). Do not build a deep link by hand.
-- NOT applied automatically by deploy: apply with
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0025_petcube_hidden_partner.sql
-- and record it in d1_migrations. Rollback: DELETE FROM partners WHERE slug = 'petcube';
INSERT OR IGNORE INTO partners (slug, name, category, url_template, commission_note, status, status_reason, meter, category_slug, attribution)
VALUES (
  'petcube',
  'Petcube',
  'Pet Care',
  '',
  'Check in on a pet you leave at home. See them, talk to them and play through the app while you are away.',
  'pending',
  'Staged dark: D-013, Awin approved 2026-10-15, awaiting owner flip PR (C3)',
  'leave',
  'pet_care',
  'none'
);
