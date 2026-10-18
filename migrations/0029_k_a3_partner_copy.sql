-- K-A3 (ROADMAP step 121): two live partner blurbs break the Brand v1 lexicon. The blurb is `commission_note` (GET /api/partners aliases it as `blurb`).
-- Apply to production before the K-A3 PR merges: deploys do not run migrations.
UPDATE partners SET commission_note = 'Compare airport parking before you go and skip the gate-price surprise when you''re heading out.', updated_at = datetime('now') WHERE slug = 'parking-access';
UPDATE partners SET commission_note = 'An eSIM for wherever you''re landing. Data from the moment you land, on a supported network, no local SIM card hunt.', updated_at = datetime('now') WHERE slug = 'yesim';
