-- N1 follow-up: Coby supplied the real Travelpayouts (tpo.lu) tracking links for all four
-- "Complete the trip" partners seeded as 'pending' in 0009_complete_trip_partners.sql. Flips each
-- row to 'live' with its real url_template -- from this point on, /api/partners will serve these
-- four and /out/:slug will redirect real clicks instead of 403ing.
UPDATE partners SET url_template = 'https://tiqets.tpo.lu/p0pwNloI', status = 'live', status_reason = NULL, updated_at = datetime('now') WHERE slug = 'tiqets';
UPDATE partners SET url_template = 'https://gocity.tpo.lu/n8KrVAZY', status = 'live', status_reason = NULL, updated_at = datetime('now') WHERE slug = 'gocity';
UPDATE partners SET url_template = 'https://qeeq.tpo.lu/UjZTOlwU', status = 'live', status_reason = NULL, updated_at = datetime('now') WHERE slug = 'qeeq';
UPDATE partners SET url_template = 'https://tpo.lu/kuJ7K9NS', status = 'live', status_reason = NULL, updated_at = datetime('now') WHERE slug = 'welcome-pickups';
