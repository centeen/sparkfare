-- Real bug found 2026-09-25: `partners.commission_note` (what GET /api/partners aliases as
-- `blurb`, and what away-mode.html / the /flight/:origin/:destination route pages both render
-- under each partner's name) has been an empty string for every single live partner since
-- 0002_partners.sql seeded the table -- 0011_clean_partner_commission_notes.sql then zeroed out
-- the only two rows that ever had any text (safetywing, timekettle), leaving the column
-- unconditionally empty for all 14 live partners.
--
-- Meanwhile `getAwayModePartners()` (src/email.js) already has real, good, need-led blurb copy
-- for every one of these same 14 partners in its AWAY_MODE_PARTNERS array -- but that array is
-- only ever used as the OFFLINE FALLBACK when env.DB is unavailable (see getAwayModePartners's
-- own `if (env?.DB) { ...query D1...} return AWAY_MODE_PARTNERS`). Since env.DB is always
-- configured in production, every real render of away-mode.html and every real /flight/* page
-- has been showing an empty blurb line for every partner, while the actual well-written copy
-- sat unreachable in the fallback path. This migration copies that existing, already-written
-- copy (verbatim, nothing new authored here) into the D1 column that's actually read live --
-- closing the wiring gap, not writing new marketing copy.
UPDATE partners SET commission_note = 'Translator earbuds for real conversations abroad, from ordering dinner to asking directions.', updated_at = datetime('now') WHERE slug = 'timekettle';
UPDATE partners SET commission_note = 'Book airport parking ahead and skip the gate-price surprise when you''re heading out.', updated_at = datetime('now') WHERE slug = 'parking-access';
UPDATE partners SET commission_note = 'Travel medical insurance built for people leaving home for a while.', updated_at = datetime('now') WHERE slug = 'safetywing';
UPDATE partners SET commission_note = 'Flight delay, cancellation, and overbooking compensation — they handle the airline claim so you don''t have to.', updated_at = datetime('now') WHERE slug = 'airhelp';
UPDATE partners SET commission_note = 'An eSIM for wherever you''re landing — data the moment you touch down, no local SIM card hunt.', updated_at = datetime('now') WHERE slug = 'yesim';
UPDATE partners SET commission_note = 'Hold and spend in local currencies with no foreign transaction fees — real exchange rates wherever you travel.', updated_at = datetime('now') WHERE slug = 'wise';
UPDATE partners SET commission_note = 'A virtual mailbox that opens, scans, and forwards your physical mail — so nothing piles up at home while you''re away.', updated_at = datetime('now') WHERE slug = 'us-global-mail';
UPDATE partners SET commission_note = 'Keep your data off public airport and hotel Wi-Fi — set it up before you leave, not once you''re already connected.', updated_at = datetime('now') WHERE slug = 'nordvpn';
UPDATE partners SET commission_note = 'Luggage storage by the hour, wherever you land — no need to kill time dragging a bag around.', updated_at = datetime('now') WHERE slug = 'bounce';
UPDATE partners SET commission_note = 'Learn the language before you land — interactive courses built for real conversation, not just vocabulary lists.', updated_at = datetime('now') WHERE slug = 'rocket-languages';
UPDATE partners SET commission_note = 'Skip-the-line tickets and tours at your destination, booked before you land.', updated_at = datetime('now') WHERE slug = 'tiqets';
UPDATE partners SET commission_note = 'One pass, several attractions — worth it if you''re packing a lot into one city.', updated_at = datetime('now') WHERE slug = 'gocity';
UPDATE partners SET commission_note = 'Car rental comparison at your destination, so you''re not negotiating at the counter.', updated_at = datetime('now') WHERE slug = 'qeeq';
UPDATE partners SET commission_note = 'A driver waiting at arrivals with your name on a sign — booked ahead, fixed price.', updated_at = datetime('now') WHERE slug = 'welcome-pickups';
