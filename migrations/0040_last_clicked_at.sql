-- Q6 (Addendum Q, ROADMAP step 173, D-049, G115): clicks, not opens. users.last_clicked_at is set by the Resend email.clicked webhook (not for a
-- scanner-speed click) and when a person presses the reactivation button; email_delivery_times remembers when each email reached the inbox so a click
-- within 60 seconds of delivery can be recognised as a link scanner. The Worker also creates the table and adds the column on first use, so this file
-- is bookkeeping. Apply to production and record it in d1_migrations (auto-deploy does not run migrations):
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0040_last_clicked_at.sql
ALTER TABLE users ADD COLUMN last_clicked_at TEXT;
CREATE TABLE IF NOT EXISTS email_delivery_times (
  email_id TEXT PRIMARY KEY,
  delivered_at TEXT NOT NULL
);
