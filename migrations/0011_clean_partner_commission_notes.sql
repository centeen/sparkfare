-- Coby asked to remove specific text from the Away Mode list. `partners.commission_note` is
-- what GET /api/partners aliases as `blurb` (`SELECT ... commission_note as blurb ...`), and
-- that's exactly the text away-mode.html renders under each partner's name -- so this is a
-- visible-content fix, not just internal bookkeeping. Matches the empty-string convention already
-- used for every other partner row with no commission note (rover, pet-gear, holafly,
-- parking-access, airhelp, yesim, etc. in migrations/0002_partners.sql).
UPDATE partners SET commission_note = '', updated_at = datetime('now') WHERE slug = 'safetywing';
UPDATE partners SET commission_note = '', updated_at = datetime('now') WHERE slug = 'timekettle';
