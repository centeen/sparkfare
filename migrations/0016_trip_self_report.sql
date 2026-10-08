-- 0016: Away Move 2 (ROADMAP step 70): one-tap trip self-report.
-- A traveler can tell us whether a tracked trip happened: booked, not yet, or not going. The answer is stored in
-- its OWN columns and is never written to trips.status: reconcileBookings() only flips rows still 'clicked' to
-- 'booked' (and sends the booked-confirmation email from that update), so a self-report must not hide a row from it.
-- Nothing reads these columns until the code PR ships behind ENABLE_TRIP_SELF_REPORT (default off).
--
-- `trips` was only ever created inline by POST /api/trips (src/index.js), never by a migration, so a fresh database
-- has no such table and the ALTERs below would fail. The CREATE below matches the live table, is a no-op in
-- production, and lets a fresh database take this file.
--
-- Backward compatible: two nullable columns, existing rows untouched (both stay NULL).
-- Rollback: leaving the columns in place is harmless (nothing reads them with the flag off). To remove them:
--   ALTER TABLE trips DROP COLUMN self_reported_at;
--   ALTER TABLE trips DROP COLUMN booking_self_report;
-- Do not run this against production without the owner (see migrations_README.md on duplicate-column errors).
CREATE TABLE IF NOT EXISTS trips (
  trip_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  origin_iata TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  return_at TEXT,
  price_at_click INTEGER NOT NULL,
  clicked_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'clicked',
  price_eur REAL,
  hotel_name TEXT,
  tour_name TEXT,
  event_name TEXT,
  is_open INTEGER DEFAULT 0
);

ALTER TABLE trips ADD COLUMN booking_self_report TEXT CHECK (booking_self_report IN ('booked', 'not_yet', 'not_going'));
ALTER TABLE trips ADD COLUMN self_reported_at TEXT;
