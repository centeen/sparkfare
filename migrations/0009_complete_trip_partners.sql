-- N1: "Complete the trip" module. Four new post-flight itinerary partners: activities/tickets
-- (Tiqets), a multi-attraction city pass (GoCity), car rental (QEEQ), and private airport
-- transfers (Welcome Pickups) -- distinct from the existing Away Mode checklist (which covers
-- leaving-home logistics: insurance, mail, bags, connectivity), this covers what a traveler
-- still needs once they've actually landed.
--
-- Seeded as 'pending', NOT 'live': this session has no access to the real, Coby-specific
-- affiliate tracking links for any of these four, and this project's own established, repeatedly
-- reinforced discipline (see the Aviasales/Airalo/NordVPN "YOUR_PID" lessons in CLAUDE.md) is to
-- never fabricate a placeholder tracking URL -- a guessed link would silently misattribute or
-- break commission tracking with no visible symptom. url_template is left as an empty string
-- (NOT NULL is satisfied, but /api/partners' `WHERE status = 'live'` filter and /out/:slug's own
-- `if (partner.status !== 'live') return 403` guard both keep these fully unreachable until a
-- real link is supplied and status is flipped to 'live').
--
-- Hotel (Trivago) is deliberately NOT seeded here at all, per Coby's explicit instruction -- that
-- slot waits on Trivago's own affiliate approval, tracked separately as A1. Do not add a Trivago
-- row, even as 'pending', until that approval actually comes through with a real link.
INSERT INTO partners (slug, name, category, url_template, commission_note, status, status_reason) VALUES
  ('tiqets', 'Tiqets', 'Activities & Tickets', '', '', 'pending', 'Awaiting real tracking link from Coby (N1)'),
  ('gocity', 'GoCity', 'City Pass', '', '', 'pending', 'Awaiting real tracking link from Coby (N1)'),
  ('qeeq', 'QEEQ', 'Car Rental', '', '', 'pending', 'Awaiting real tracking link from Coby (N1)'),
  ('welcome-pickups', 'Welcome Pickups', 'Airport Transfer', '', '', 'pending', 'Awaiting real tracking link from Coby (N1)');
