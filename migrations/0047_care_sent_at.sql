-- C1.5: the care email is sent at most once per address.
ALTER TABLE users ADD COLUMN care_sent_at TEXT;
