-- 2026-10-14 (referral-copy scope, step 3): the Tiqets and Welcome Pickups blurbs said "booked" in Sparkfare's own voice.
-- Same text as AWAY_MODE_PARTNERS in src/email.js and blog/away-mode-checklist.html. Not applied automatically by deploy:
-- apply with `wrangler d1 execute sparkfare-db --remote --file=migrations/0024_partner_blurb_wording.sql` and record it in d1_migrations.
UPDATE partners SET commission_note = 'Skip-the-line tickets and tours at your destination, sorted before you land.', updated_at = datetime('now') WHERE slug = 'tiqets';
UPDATE partners SET commission_note = 'A driver waiting at arrivals with your name on a sign — set up ahead, fixed price.', updated_at = datetime('now') WHERE slug = 'welcome-pickups';
