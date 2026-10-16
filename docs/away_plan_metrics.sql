-- Away Mode plan: the money comparison (Addendum G, task G6; plan section 7, "Money").
--
-- Partner clicks per 100 plan completions, by trip-length bucket, next to /away-mode clicks per 100 views.
-- Read-only. Run it against production D1 with a start date, for example:
--   wrangler d1 execute sparkfare-db --remote --command "<this query with :from replaced by '2026-11-09'>"
-- (replace every :from).
--
-- What each number is
--   completions        plan_complete events: a visitor finished a plan (country, bucket and item count only; never a date).
--   plan_clicks        outbound_click events with source 'away-plan': a partner link clicked from a plan, with the bucket of that plan.
--   away_mode_views    away_mode_view events: a visit to /away-mode (counted only while the plan is on).
--   away_mode_clicks   outbound_click events with source 'away_mode': a partner link clicked on /away-mode.
--
-- Limits to know
--   * /away-mode links carry no trip, so its clicks and views have no bucket: the comparison column is one all-visitors number
--     repeated on each row, not a per-bucket figure.
--   * Events flagged as bots (ua_class = 'bot') are left out everywhere. Older rows with no class still count.
--   * The plan runs in the visitor's browser and only counts finished plans, so "completions" understates people who looked and left.
--   * The kill line in the plan: at or below today's /away-mode rate after the minimum sample (30 completions per bucket).
WITH done AS (
  SELECT json_extract(meta, '$.trip_length_bucket') AS bucket, COUNT(*) AS n
  FROM events
  WHERE event_type = 'plan_complete'
    AND COALESCE(json_extract(meta, '$.ua_class'), '') != 'bot'
    AND ts >= :from
  GROUP BY 1
),
plan_clicks AS (
  SELECT json_extract(meta, '$.trip_length_bucket') AS bucket, COUNT(*) AS n
  FROM events
  WHERE event_type = 'outbound_click'
    AND source = 'away-plan'
    AND COALESCE(json_extract(meta, '$.ua_class'), '') != 'bot'
    AND ts >= :from
  GROUP BY 1
),
away AS (
  SELECT
    (SELECT COUNT(*) FROM events
      WHERE event_type = 'away_mode_view' AND COALESCE(json_extract(meta, '$.ua_class'), '') != 'bot' AND ts >= :from) AS views,
    (SELECT COUNT(*) FROM events
      WHERE event_type = 'outbound_click' AND source = 'away_mode' AND COALESCE(json_extract(meta, '$.ua_class'), '') != 'bot' AND ts >= :from) AS clicks
)
SELECT
  d.bucket,
  d.n AS completions,
  COALESCE(pc.n, 0) AS plan_clicks,
  ROUND(100.0 * COALESCE(pc.n, 0) / d.n, 1) AS plan_clicks_per_100_completions,
  away.views AS away_mode_views,
  away.clicks AS away_mode_clicks,
  ROUND(100.0 * away.clicks / NULLIF(away.views, 0), 1) AS away_clicks_per_100_views
FROM done d
LEFT JOIN plan_clicks pc ON pc.bucket IS d.bucket
CROSS JOIN away
ORDER BY d.bucket;
