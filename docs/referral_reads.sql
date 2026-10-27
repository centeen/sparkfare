-- Two read-only checks on referral data (Hub conditions on the M2 flip, 2026-10-27). Counts only: no email address or user id is selected.
-- Run: wrangler d1 execute sparkfare-db --remote --file=docs/referral_reads.sql

-- 1. How many accounts had at least one CONFIRMED referral before the tier changes of Oct 20 to 22 (which removed the published
--    "1 = extra origin", "3 = Early Bird" and "5 = Early Access" rewards)? A referral is counted when it was confirmed (updated_at),
--    falling back to created_at. Anyone here earned something under the old terms.
SELECT COUNT(*) AS accounts_with_a_confirmed_referral_before_oct_20,
       COALESCE(SUM(n >= 3), 0) AS of_which_three_or_more,
       COALESCE(SUM(n >= 5), 0) AS of_which_five_or_more
FROM (
  SELECT referrer_id, COUNT(*) AS n
  FROM referrals
  WHERE status = 'confirmed' AND COALESCE(updated_at, created_at) < '2026-10-20'
  GROUP BY referrer_id
);

-- 2. Orphaned referral rows: a referrer id that no longer matches any user. This is what the id re-key used to leave behind when an
--    email-only subscriber (placeholder local_* id) signed in. Credit in these rows is not counted for anyone today.
SELECT COUNT(*) AS orphaned_referral_rows,
       COUNT(DISTINCT referrer_id) AS orphaned_referrers,
       COALESCE(SUM(status = 'confirmed'), 0) AS orphaned_confirmed
FROM referrals
WHERE referrer_id NOT IN (SELECT id FROM users);

-- 3. Share links that no longer point at a user.
SELECT COUNT(*) AS orphaned_referral_codes
FROM referral_codes
WHERE user_id NOT IN (SELECT id FROM users);
