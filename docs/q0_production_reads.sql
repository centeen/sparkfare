-- Addendum Q, Q0: the read-only queries that need production D1 (items 2, 3, 6 and 9). Counts only: no email address or user id is selected.
-- Run: npx wrangler d1 execute sparkfare-db --remote --file=docs/q0_production_reads.sql
-- Run each block's result back to Claude Code. Written against the real schema (tested on the migrations in tests/q0_reads.test.js).

-- 6. Users by frequency (item 6). Only `daily` and `weekly` are honest after Q3; `instant` is treated like `daily` by the send code.
SELECT COALESCE(frequency, 'NULL') AS frequency, COUNT(*) AS users,
       SUM(verified_email = 1 AND unsubscribed_at IS NULL AND COALESCE(is_subscribed, 1) = 1) AS active_verified
FROM users GROUP BY 1 ORDER BY 2 DESC;

-- 2a. Emails per recipient per UTC day, last 30 days (item 2). Built from every table that keeps one row per send. It is a LOWER BOUND:
--     nothing records the verification email, the sunset email, the confirmation emails, the support auto-reply or the Sunday newsletter per
--     recipient, and `watchlists.notified_at` and `pto_window_watches.last_alerted_at` hold only the latest alert. Q1's ledger is the first
--     complete record. Output: how many recipient-days had 1, 2, 3 or more of these emails.
WITH sends AS (
  SELECT email, delivered_on AS day, 'digest' AS kind FROM daily_alert_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'stress_valve' FROM stress_valve_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'departure_briefing' FROM departure_briefing_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'departing_soon' FROM departing_soon_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'route_retrospective' FROM route_retrospective_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'pre_departure_' || stage FROM pre_departure_sequence_deliveries WHERE status = 'sent'
  UNION ALL SELECT p.email, date(r.sent_at), 'plan_reminder' FROM away_plan_reminders r JOIN away_plans p ON p.id = r.plan_id WHERE r.status = 'sent'
  UNION ALL SELECT p.email, date(p.set_sent_at), 'youre_set' FROM away_plans p WHERE p.set_sent_at IS NOT NULL
  UNION ALL SELECT u.email, date(w.notified_at), 'target_reached' FROM watchlists w JOIN users u ON u.id = w.user_id WHERE w.notified_at IS NOT NULL
  UNION ALL SELECT u.email, date(m.last_alerted_at), 'long_weekend_watch' FROM pto_window_watches m JOIN users u ON u.id = m.user_id WHERE m.last_alerted_at IS NOT NULL
), per_day AS (
  SELECT email, day, COUNT(*) AS n FROM sends WHERE day >= date('now', '-30 days') GROUP BY email, day
)
SELECT CASE WHEN n >= 3 THEN '3+' ELSE CAST(n AS TEXT) END AS emails_that_day, COUNT(*) AS recipient_days FROM per_day GROUP BY 1 ORDER BY 1;

-- 2b. Which kinds sit together on the days with two or more (counts only).
WITH sends AS (
  SELECT email, delivered_on AS day, 'digest' AS kind FROM daily_alert_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'stress_valve' FROM stress_valve_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'departure_briefing' FROM departure_briefing_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'departing_soon' FROM departing_soon_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'route_retrospective' FROM route_retrospective_deliveries WHERE status = 'sent'
  UNION ALL SELECT email, date(created_at), 'pre_departure' FROM pre_departure_sequence_deliveries WHERE status = 'sent'
  UNION ALL SELECT p.email, date(r.sent_at), 'plan_reminder' FROM away_plan_reminders r JOIN away_plans p ON p.id = r.plan_id WHERE r.status = 'sent'
  UNION ALL SELECT u.email, date(w.notified_at), 'target_reached' FROM watchlists w JOIN users u ON u.id = w.user_id WHERE w.notified_at IS NOT NULL
), multi AS (
  SELECT email, day, GROUP_CONCAT(kind, ' + ') AS kinds FROM (SELECT * FROM sends WHERE day >= date('now', '-30 days') ORDER BY kind) GROUP BY email, day HAVING COUNT(*) >= 2
)
SELECT kinds, COUNT(*) AS recipient_days FROM multi GROUP BY kinds ORDER BY 2 DESC;

-- 2c. Sundays (item 2): digests sent on each of the last Sundays, and today's audience of the Sunday newsletter. The newsletter has no per-recipient
--     log; its audience query (`/api/admin/trigger-newsletter`) is verified, subscribed, not unsubscribed, not paused, with NO frequency filter, so
--     every active reader who got a digest that Sunday is also in the newsletter audience.
SELECT delivered_on AS sunday, COUNT(*) AS digests_sent FROM daily_alert_deliveries
WHERE status = 'sent' AND strftime('%w', delivered_on) = '0' AND delivered_on >= date('now', '-30 days') GROUP BY 1 ORDER BY 1 DESC;
SELECT COUNT(*) AS newsletter_audience_now FROM users
WHERE verified_email = 1 AND COALESCE(is_subscribed, 1) = 1 AND unsubscribed_at IS NULL AND (paused_until IS NULL OR datetime(paused_until) < datetime('now'));

-- 3. Has `email.clicked` ever reached us (item 3)? The webhook handler logs an `email_click` event; the event keeps the Resend email_id and the link, no recipient.
SELECT event_type, COUNT(*) AS events, MIN(ts) AS first_seen, MAX(ts) AS last_seen
FROM events WHERE event_type IN ('email_click', 'email_open', 'email_bounce', 'email_complaint') GROUP BY 1;

-- 9. Signs of link-scanner clicks in `email_click` events (item 9). The webhook does not store `email.delivered`, so delivery-to-click time cannot be
--    computed; the signs available are: several distinct links clicked in one email, and clicks bunched within a few seconds.
WITH per_email AS (
  SELECT json_extract(meta, '$.email_id') AS email_id, COUNT(*) AS clicks, COUNT(DISTINCT json_extract(meta, '$.link')) AS distinct_links,
         CAST((julianday(MAX(ts)) - julianday(MIN(ts))) * 86400 AS INTEGER) AS span_seconds
  FROM events WHERE event_type = 'email_click' GROUP BY 1
)
SELECT COUNT(*) AS emails_with_clicks, COALESCE(SUM(distinct_links >= 3), 0) AS with_3_or_more_distinct_links,
       COALESCE(SUM(clicks >= 3 AND span_seconds <= 10), 0) AS with_3_or_more_clicks_within_10_seconds, COALESCE(SUM(clicks), 0) AS clicks_total
FROM per_email;
