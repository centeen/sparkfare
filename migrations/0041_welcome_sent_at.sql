-- Q5: W1 welcome email is sent once per address; this records when. The Worker also adds the column on first use.
ALTER TABLE users ADD COLUMN welcome_sent_at TEXT;
