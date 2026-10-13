# Sparkfare metrics (state_METRICS.md)

Created 2026-10-13 under D-010. **Every value below comes from a read-only query of production D1 (`sparkfare-db`) run on
2026-10-13 at about 11:35 UTC, and is labelled with its as-of time and sample size.** Where there is no data the cell says
"not available". Nothing is estimated. This file is a point-in-time snapshot, not a tracker: re-run the queries and add a dated block
rather than editing a value in place.

## How to read this
- **The audience is tiny.** There are 3 user rows, all created on 2026-09-04, two of them with placeholder `local_` ids. Almost every
  event below is the owner, test traffic or a crawler, so none of these numbers describes real demand yet.
- **"Human" is a User-Agent heuristic** (`src/botClass.js`), not a person count. A click from the owner's own browser is "human".
- **A click is never revenue.** There are no partner payouts entered (`partner_payouts` has 0 rows), so no revenue figure exists.
- **Tracked era:** `outbound_click` events carry `meta.ua_class` from **2026-10-07 15:27:56 UTC**. Earlier rows are `unclassified` and are
  shown separately, never folded into "human" (`task_d_first_readout_2026-10-13.md`, D8).
- **F0 meter enrichment** (`meta.meter`, `trip_length_bucket`, ...) began with `ENABLE_METER_TRACKING` on **2026-10-13 10:47 UTC**.

## Audience and accounts

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| Users (all) | rows in `users` | `SELECT count(*) FROM users` | 3 | 2026-10-13 11:35 UTC | n = 3 | two have `local_` placeholder ids (pre-Clerk signups) |
| Verified users | `verified_email = 1` | `users` | 1 | 2026-10-13 11:35 UTC | n = 3 | only 1 of 3; the daily digest goes to verified users only |
| Subscribed users | `is_subscribed = 1` | `users` | 3 | 2026-10-13 11:35 UTC | n = 3 | 45-day sunset policy has not pruned anyone (oldest account is 39 days old) |
| Unsubscribed users | `unsubscribed_at IS NOT NULL` | `users` | 0 | 2026-10-13 11:35 UTC | n = 3 | |
| Early-access users | `early_access = 1` (referral loop) | `users` | 0 | 2026-10-13 11:35 UTC | n = 3 | no referral has completed |
| Users attributed to a partner/channel | `partner_id` set | `users` | 0 | 2026-10-13 11:35 UTC | n = 3 | |
| Newest account created | `max(created_at)` | `users` | 2026-09-04 18:06:17 UTC | 2026-10-13 11:35 UTC | n = 3 | no signup has landed since 2026-09-04 |
| Signup events in the tracked era | `events` with type signup, pseo_signup, check_signup or pto_signup | `events` | 0 | 2026-10-13 11:35 UTC | n = 0 events | the signup funnel has no observed signups yet; it cannot be called "converting" or "not converting" |
| Plus waitlist (verified) | `plus_waitlist.verified_at` set | `plus_waitlist` | 0 (0 total rows) | 2026-10-13 11:35 UTC | n = 0 | `/pricing` has had 24 `pricing_view` events (2026-10-10 to 2026-10-11) |
| Watchlists | rows in `watchlists` | `watchlists` | 0 | 2026-10-13 11:35 UTC | n = 0 | |

## Trips

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| Tracked trip clicks | rows in `trips` (a signed-in "View fare" click) | `trips` | 16 | 2026-10-13 11:35 UTC | n = 16 | first 2026-09-05, last 2026-10-10; from 3 users, so mostly test clicks |
| Trips reconciled as booked | `status = 'booked'` | `trips` | 0 | 2026-10-13 11:35 UTC | n = 16 | no paid booking has been matched; the reconciliation filter (`campaign_id` 100) is unverified against a real conversion |

## Outbound clicks (all partners and fares)

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| Outbound clicks, all time | `event_type = 'outbound_click'` | `events` | 455 | 2026-10-13 11:35 UTC | n = 455 | includes 9 SafetyWing test probes and 1 F0 verification click by Claude on 2026-10-13 |
| Unclassified (before the bot class existed) | no `meta.ua_class` | `events` | 347 | 2026-10-13 11:35 UTC | n = 347 | 2026-09-24 to 2026-10-07; reliability unknown; shown separately on purpose |
| Bot-classed | `ua_class = 'bot'` (tracked era) | `events` | 20 | 2026-10-13 11:35 UTC | n = 20 | includes Claude's own curl probes |
| **Human clicks, tracked era** | `ua_class = 'human'` | `events` | **88** | 2026-10-13 11:35 UTC | n = 88, 2026-10-07 15:45 to 2026-10-13 10:04 UTC | UA heuristic; 84 of 88 are `anon` and only 5 distinct `sub_id` values appear, so this is mostly the owner and testers, not demand |
| Human clicks, by partner (top 8) | tracked era, `ua_class = 'human'` | `events` | nordvpn 12, bounce 12, airhelp 12, wise 11, yesim 9, tiqets 6, welcome-pickups 5, aviasales 4 | 2026-10-13 11:35 UTC | n = 71 of 88 | the remaining 17 are spread over other partners |
| Human clicks with F0 meter enrichment | `ua_class = 'human'` and `ts >= 2026-10-13 10:47` | `events` | 0 | 2026-10-13 11:35 UTC | n = 0 | the flag has been on for under an hour; Task D's window opens 2026-10-27 10:47 UTC |
| SafetyWing human clicks, tracked era | `partner = 'safetywing'`, human, before 2026-10-13 11:19 | `events` | 1 (3 bot, 38 unclassified) | 2026-10-13 11:35 UTC | n = 42 | link removed under D-002; no earnings or subscriber figure is visible anywhere in D1 |

## Email

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| Digests sent, last 7 days | `alert_email_sent` events | `events` | 5 | 2026-10-13 11:35 UTC | 7 days | one verified subscriber; also 2 `digest_skipped_unchanged` events |
| Email opens, last 7 days | `email_open` events | `events` | 42 | 2026-10-13 11:35 UTC | 7 days | opens are image-pixel fetches: Apple Mail privacy and scanners inflate them; there are 3 recipients, so an open rate is not meaningful |
| Suppressed addresses | rows in `email_suppressions` | `email_suppressions` | 0 | 2026-10-13 11:35 UTC | n = 0 | no real bounce or complaint has occurred, so the suppression path is test-covered only |
| Digest editions stored | rows in `digest_editions` | `digest_editions` | 84 | 2026-10-13 11:35 UTC | n = 84 | private; the archive is not published |

## Product usage events (all time, since each event began)

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| `/check` runs | `check_run` | `events` | 8 | 2026-10-13 11:35 UTC | 2026-10-07 to 2026-10-10 | owner testing is not separable |
| `/check` shares | `check_share` | `events` | 1 | 2026-10-13 11:35 UTC | n = 1 | |
| `/time-off` views | `pto_view` | `events` | 54 | 2026-10-13 11:35 UTC | 2026-10-09 to 2026-10-13 | crawlers are skipped by the logger |
| `/leave` views | `leave_view` | `events` | 15 | 2026-10-13 11:35 UTC | 2026-10-10 to 2026-10-13 | |
| Deal shares | `share_click` | `events` | 8 | 2026-10-13 11:35 UTC | n = 8 | |

## Revenue and the long-leave branch

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| Partner revenue (confirmed) | `partner_payouts.amount_usd` | `partner_payouts` | not available | 2026-10-13 11:35 UTC | n = 0 rows | the table is empty; payouts are entered by hand through `POST /admin/payouts` |
| Flight booking revenue | `trips.price_eur` where booked | `trips` | not available | 2026-10-13 11:35 UTC | n = 0 booked trips | |
| Away Mode ARPU | revenue / engaged subscribers | none | not available | 2026-10-13 11:35 UTC | n/a | needs partner payouts and a defined "engaged" denominator; with 1 verified user it would not be meaningful |
| Long Leave (G1) impressions, completions | `leave_long_branch_shown`, `leave_completed` | `events` | not available | 2026-10-13 11:35 UTC | n/a | `ENABLE_LONG_LEAVE` is off; no such event can exist |
| Visitors, sessions, bounce rate | page analytics | none | not available | 2026-10-13 11:35 UTC | n/a | there is no analytics tool; Cloudflare's request log is the only traffic source and was not queried |

## Queries used (read-only)
```sql
SELECT count(*) total, sum(verified_email) verified, sum(CASE WHEN is_subscribed=1 THEN 1 ELSE 0 END) subscribed,
       sum(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) unsub, sum(CASE WHEN early_access=1 THEN 1 ELSE 0 END) early,
       min(created_at), max(created_at) FROM users;
SELECT count(*) total, sum(CASE WHEN status='booked' THEN 1 ELSE 0 END) booked FROM trips;
SELECT event_type, count(*) n, min(ts), max(ts) FROM events GROUP BY event_type ORDER BY n DESC;
SELECT COALESCE(json_extract(meta,'$.ua_class'),'unclassified') cls, count(*) n FROM events
 WHERE event_type='outbound_click' GROUP BY 1;
SELECT partner, count(*) n FROM events WHERE event_type='outbound_click' AND json_extract(meta,'$.ua_class')='human' GROUP BY 1 ORDER BY n DESC;
SELECT count(*) FROM email_suppressions;
SELECT count(*) FROM partner_payouts;
```
Run with `node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command "<one statement>"`
(one statement per call; on this machine use that `node` form, and retry on Cloudflare error 7403).
