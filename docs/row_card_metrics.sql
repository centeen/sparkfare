-- G107 (end-of-row alert card): how often the card is shown and how often it turns into a confirmed signup. Read-only. Counts only.
-- Run: wrangler d1 execute sparkfare-db --remote --file=docs/row_card_metrics.sql   (set :from by editing the date below)
-- Bots are left out. A row_card_view is one page view that showed the card (once per page view, flag on only).
-- What this can and cannot say: it gives signups from the card per 100 card views. It cannot give "per 100 desktop visits without the
-- card", because landings_daily has no device split; compare the card's rate with the hero form's (source = 'home') instead.
WITH views AS (
  SELECT date(ts) AS day, origin, COUNT(*) AS n
  FROM events
  WHERE event_type = 'row_card_view' AND date(ts) >= '2026-11-01'
    AND COALESCE(json_extract(meta, '$.ua_class'), 'none') != 'bot'
  GROUP BY 1, 2
), signups AS (
  SELECT date(created_at) AS day, origin_iata AS origin,
         SUM(signup_source = 'home_row') AS card_signups,
         SUM(signup_source = 'home_row' AND verified_email = 1) AS card_confirmed
  FROM users
  WHERE date(created_at) >= '2026-11-01'
  GROUP BY 1, 2
)
SELECT v.day, v.origin, v.n AS card_views,
       COALESCE(s.card_signups, 0) AS card_signups,
       COALESCE(s.card_confirmed, 0) AS card_confirmed,
       ROUND(100.0 * COALESCE(s.card_signups, 0) / v.n, 1) AS signups_per_100_views
FROM views v LEFT JOIN signups s ON s.day = v.day AND s.origin = v.origin
ORDER BY v.day DESC, v.n DESC;
