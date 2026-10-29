-- Addendum Q, Q6: read-only queries to run on production D1 before and after the click-based pause rule ships. Counts only: no email address or user id is selected.
-- Run: npx wrangler d1 execute sparkfare-db --remote --file=docs/q6_production_reads.sql
-- Written against the migrated schema (tests/q6_reads.test.js). Block 5 needs migration 0040; the others run before or after it.

-- 1. Who would the pause rule pause today? OLD rule: account older than 45 days and no open in 45 days. NEW rule (open-only half, since no click is recorded
--    yet): account older than 90 days and no open in 45 days. The new rule can only pause fewer people than the old one.
SELECT
  SUM(created_at <= datetime('now', '-45 days') AND (last_opened_at IS NULL OR last_opened_at <= datetime('now', '-45 days'))) AS old_rule_would_pause,
  SUM(created_at <= datetime('now', '-90 days') AND (last_opened_at IS NULL OR last_opened_at <= datetime('now', '-45 days'))) AS new_rule_would_pause,
  COUNT(*) AS subscribed
FROM users WHERE COALESCE(is_subscribed, 1) = 1 AND verified_email = 1 AND unsubscribed_at IS NULL;

-- 2. How many subscribers have ever had an open recorded, by age of the account. Opens only started being recorded on 2026-09-26 (webhook fix).
SELECT CASE WHEN created_at <= datetime('now', '-90 days') THEN 'over 90 days'
            WHEN created_at <= datetime('now', '-45 days') THEN '45 to 90 days' ELSE 'under 45 days' END AS account_age,
       COUNT(*) AS subscribers, SUM(last_opened_at IS NOT NULL) AS ever_opened,
       SUM(last_opened_at >= datetime('now', '-45 days')) AS opened_last_45_days
FROM users WHERE COALESCE(is_subscribed, 1) = 1 AND verified_email = 1 AND unsubscribed_at IS NULL GROUP BY 1 ORDER BY 1;

-- 3. Are webhook events arriving? Daily counts for the last 14 days. email_delivered and email_click are zero until the Resend webhook is subscribed to them
--    (and clicks stay zero while click tracking is off).
SELECT date(ts) AS day,
       SUM(event_type = 'email_open') AS opens, SUM(event_type = 'email_click') AS clicks, SUM(event_type = 'email_delivered') AS delivered,
       SUM(event_type = 'email_bounce') AS bounces, SUM(event_type = 'email_complaint') AS complaints
FROM events WHERE event_type IN ('email_open','email_click','email_delivered','email_bounce','email_complaint') AND ts >= datetime('now', '-14 days')
GROUP BY 1 ORDER BY 1 DESC;

-- 4. Clicks that look like link scanners (same email, three or more clicks within the same minute), last 30 days. Only meaningful once click events arrive.
SELECT COUNT(*) AS emails_with_burst_clicks FROM (
  SELECT json_extract(meta, '$.email_id') AS email_id, strftime('%Y-%m-%d %H:%M', ts) AS minute, COUNT(*) AS n
  FROM events WHERE event_type = 'email_click' AND ts >= datetime('now', '-30 days') GROUP BY 1, 2 HAVING n >= 3);

-- 5. (After migration 0040.) Subscribers with a recorded click, and the NEW rule in full: no click in 90 days AND no open in 45 days AND older than 90 days.
SELECT SUM(last_clicked_at IS NOT NULL) AS ever_clicked,
       SUM(created_at <= datetime('now', '-90 days')
           AND (last_clicked_at IS NULL OR last_clicked_at <= datetime('now', '-90 days'))
           AND (last_opened_at IS NULL OR last_opened_at <= datetime('now', '-45 days'))) AS new_rule_would_pause
FROM users WHERE COALESCE(is_subscribed, 1) = 1 AND verified_email = 1 AND unsubscribed_at IS NULL;
