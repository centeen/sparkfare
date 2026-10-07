# Launch-week runbook (launch: Saturday Oct 17, 2026, 12:01 a.m. PT = 07:01 UTC)

Written 2026-10-07 from the code, the workflows and read-only checks of production. It says what runs when, what to
look at each morning, what to do when something breaks, and which switches exist. It does not contain secrets: the
admin secret (`ADMIN_SECRET`) is a Worker secret that only the owner holds, written below as `$ADMIN_SECRET`.
Things that are not yet confirmed are marked **(unverified)**.

## 1. What runs when (UTC)
| When | What | Where | Notes |
|---|---|---|---|
| 03:17 daily | JFK fetch, rank, commit `sparkfare_ranked_deals.json` | GitHub: `daily-fetch.yml` | Moved from 06:00 on 2026-10-07 because 06:00 landed 5 to 7.5 hours late. First run on the new slot: Oct 8 **(unverified)** |
| :23 every hour | 16-origin fetch, rank, commit hourly files | GitHub: `hourly-multi-origin-fetch.yml` | Runs irregularly in practice (gaps up to about 7.5h) |
| 07:00 daily | Early-access digest | Cloudflare cron `0 7 * * *` | Early Bird referral recipients only |
| 07:10 daily (lands about 12:30 to 16:00) | Other-origins file and the 480+ pSEO pages | GitHub: `daily-compile-other-origins.yml` | Always late; the 08:00 digest runs on the previous compile |
| 08:00 daily | General digest, reconcile bookings, watchlists, stress-valve / briefing / retrospective emails, sunset pruning, **daily health check** | Cloudflare cron `0 8 * * *` | The health check emails hello@sparkfare.com only on a problem |
| 14:17 daily | Bluesky and Mastodon post | GitHub: `daily-social-post.yml` | Posts publicly. First run Oct 7 **(unverified)** |
| Mon 09:00 | Affiliate link health | Cloudflare cron `0 9 * * 1` | Emails only if a link is dead |
| Sun 14:00 | Newsletter | GitHub: `sunday-newsletter.yml` | Top-of-the-hour slot, can run late |

**Launch night:** the Product Hunt launch (07:01 UTC Oct 17) lands one minute after the 07:00 early digest and an hour before the
08:00 digest. Both send whatever data was current at 03:17 (or yesterday's, if the fetch was late).

## 2. Every morning (about 5 minutes)
Silence from the health check means healthy, so first prove the monitor is alive.
1. **Run the health check by hand** (shows the age of every data file and the email guard, even when healthy):
   `curl -s -X POST -H "Authorization: Bearer $ADMIN_SECRET" https://sparkfare.com/api/check-revenue-health`
   Expect `"healthy": true`, `freshness` ages under their limits (JFK and other-origins 36h, hourly 12h), `emailGuard.tripped` false.
2. **Workflows:** `gh run list --limit 15` and look for anything not `success`. Check `daily-fetch` started near 03:17 UTC.
3. **Site:** `curl -s https://sparkfare.com/api/health`, then load the homepage and `/check` once.
4. **Inbox hello@sparkfare.com:** health-check alerts, replies to the auto-responder, anything from Resend, Clerk, Travelpayouts or a partner.
5. **Resend dashboard:** deliveries, bounce rate, complaint rate for the last day.
6. **Events (last 24h):**
   `node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command "SELECT event_type, count(*) n FROM events WHERE ts > datetime('now','-1 day') GROUP BY event_type ORDER BY n DESC"`
   (On this machine use that `node ...wrangler.js` form, not `npx wrangler d1 execute`, which fails on a quoting bug.)
7. **Cloudflare dashboard, Workers:** the request count (see the plan-limit note below) and the error rate.

**Weekly (Mondays):** the standup brief arrives at hello@sparkfare.com after the 09:00 UTC cron: signups, `/check` use, email opens, clicks (bots excluded), pipeline file ages, and a "to look at" list. To preview it any time: `curl -s -X POST -H "Authorization: Bearer $ADMIN_SECRET" "https://sparkfare.com/api/send-weekly-standup?dry=1"` (sends nothing); without `?dry=1` it sends now. Stop it with `ENABLE_WEEKLY_STANDUP` set to `"false"`.

## 3. If something breaks
**The health check emails you ("Sparkfare health check: N issues found").** It names each problem. It repeats daily while the problem persists.
- *A data file is stale or unreadable.* Find the workflow: JFK daily = `daily-fetch`, other-origins = `daily-compile-other-origins`, hourly = `hourly-multi-origin-fetch`. Check `gh run list --workflow <name>`. Safe to re-run by hand:
  `gh workflow run daily-fetch.yml` (no inputs). The compile: `gh workflow run daily-compile-other-origins.yml`. The hourly one needs its gate and origins:
  `gh workflow run hourly-multi-origin-fetch.yml -f origins="JFK,LAX,ORD,ATL,DFW,SFO,MIA,IAD,EWR,SEA,IAH,BOS,DEN,PHX,LAS,TLV" -f confirm_rate_limit=CONFIRMED`
- *"No priced routes at all" or "doubled origin prefix".* The ranking script's history is corrupted; see the history-key notes in `CLAUDE.md` (Phase 11/12 sections) before touching data files.
- *"The email sending guard is tripped".* Bounces or complaints spiked, and **every guarded email is being skipped** (digest, verification, lifecycle). It trips on 10 bounces or 3 complaints in 7 days below 100 sends, or above 5% bounce or 0.3% complaint rate at 100+ sends, and the verdict refreshes every 10 minutes, so it clears itself as the 7-day window improves. Read the numbers in the health-check JSON (`emailGuard`). Find the cause in the Resend dashboard (a bad list segment, a typo domain, a complaint wave) before doing anything; do not bypass the guard. Note the bounce/complaint path has never been exercised by a real event **(unverified)**, and it only works if the Resend webhook is subscribed to bounces and complaints (owner action).
- *"No partner_conversions rows for this month".* A reminder, not a fault: enter last month's partner revenue by hand from each partner's dashboard.
- *"reconcileBookings() failed" / "TRAVELPAYOUTS_TOKEN is not set".* The Travelpayouts call is failing or the secret is gone; revenue tracking is blind until fixed.

**Site returns errors.** `node node_modules/wrangler/bin/wrangler.js tail --format pretty` while reproducing. A Cloudflare error 1101 means the Worker threw: the likely cause is a template referencing an undefined variable (it has happened on `/departing/`, `/embed`), the fix is the code, and the fastest relief is to roll back (below).

**Sign-in is broken.** Clerk production instance (not the old dev one): dashboard, Configure, User & authentication. Known gotchas in `CLAUDE.md`: password minimum, "Email verification code" under both Sign-up and Sign-in, domain records.

**Someone reports a wrong or stale deal.** Check the file's `generated_at` and the route's `basis_text` (the site never shows a % without its basis and timestamp). `/blog/stale-fallback-prices` explains the 7-day fallback.

**Affiliate link dead.** The weekly check emails you. A `url_template` can contain `{IATA}`; the check substitutes `JFK` before probing.

## 4. Switches and rollbacks
- **Feature flags** (in `wrangler.jsonc`; flipping one means editing the file and merging, and **merging auto-deploys in about 1 to 2 minutes**): `ENABLE_DAILY_DIGEST` (true; **the digest kill switch**, see below), `ENABLE_DIGEST_ARCHIVE_WRITE` (true; stores each day's digest editions privately, `/digest` stays dark), `ENABLE_DIGEST_ARCHIVE` (false; setting it true publishes `/digest` and the stored editions, and adds a "View in browser" link to v2 emails), `ENABLE_PRICE_CHECK` (true), `ENABLE_T3_REFERRALS` (true), `ENABLE_EMAIL_CHECKLIST_V2` (true), `ENABLE_PINTEREST` (true, sandbox), and off: `ENABLE_EMAIL_V2`, `ENABLE_DIGEST_ARCHIVE`, `ENABLE_T7B_PUSH`, `ENABLE_T5B_ADS`, `ENABLE_X_BROADCASTER`.
- **Roll back a bad deploy:** revert the PR on GitHub (auto-deploys), or in the Cloudflare dashboard open the Worker's Deployments and roll back to the previous version, or `node node_modules/wrangler/bin/wrangler.js rollback`. D1 migrations are **not** applied automatically and are not rolled back by any of these.
- **Test the social post without posting:** `gh workflow run daily-social-post.yml` is a **dry run by default** (builds the card, prints the text, posts nothing, keeps the image as the `deal-card-dry-run` artifact). To post by hand, publicly: `gh workflow run daily-social-post.yml -f dry_run=false`. The scheduled run always posts.
- **Pause the social post:** `gh workflow disable "Sparkfare Daily Social Post"` (re-enable with `gh workflow enable`). **Pause the daily fetch:** same with "Sparkfare Daily Flight Data Pipeline".
- **Stop the daily digest:** set `"ENABLE_DAILY_DIGEST": "false"` in `wrangler.jsonc` and merge (live in about 1 to 2 minutes; added 2026-10-07, PR #80). Only the exact string `false` stops it; it covers both the 07:00 and 08:00 runs and the sunset pruning inside them, and does not stop the other lifecycle emails (stress-valve, briefing, retrospective, departing-soon), the health check, or the Sunday newsletter. A Cloudflare dashboard variable edit may be faster but is overwritten by the next deploy **(unverified)**. There is still no switch for the other Cloudflare crons; removing their entry from `crons` and merging is the way.
- **Manual trigger routes** (`/api/send-daily-alert`, `/api/reconcile-bookings`, the `send-*` and `check-*` routes) need `Authorization: Bearer $ADMIN_SECRET`. Without it they return 401. `send-daily-alert` really sends mail to the address you give it.
- **Never** run a manual send to a real subscriber's address to "test"; use a `+alias` of your own address.

## 5. Capacity on launch day
- The earlier cron-limit error said "Workers **Free** limit", so the account appears to be on the Workers Free plan **(confirm in the dashboard)**. Free allows 100,000 Worker requests a day. Static pages and JSON files are served as assets and do not count, but these do: `/api/*`, `/check`, `/out/*` and `/go/*`, `/flight/*`, `/hub`, `/departing/*`, `/digest/*`. A strong Product Hunt day could approach that, and past it the Worker routes fail while static pages keep working. Moving to the Paid plan is a few dollars a month and removes the cap; decide before Oct 16.
- D1's free tier allows 100,000 rows written a day; every event is one row.

## 6. Reading the launch numbers (what the analytics baseline contains)
Investigated 2026-10-07, read-only, in the `events` table. **3 users and 11 trips exist, so almost every number so far is test or crawler traffic.**
- **`interstitial_view`: 100 in 7 days, 93 of them on Oct 3 and 4.** Their `sub_id` values are origin codes (`MIA`, `LAX`, `IAH`, ...), not trip ids, so they look like test traffic from the interstitial test pass. Since Oct 5 it is 1 to 4 a day.
- **`outbound_click`: 346 in total, 261 of them `sub_id = 'anon'`.** Steady 11 to 20 a day since Sep 24 at every hour, spread across all 14 partners, with a test spike on Oct 3 (91). The other 86 are trip-tagged, with 18 distinct trip ids against only 11 real trips, so they too look like test traffic.
- **Likely cause of the anonymous clicks: crawlers.** `robots.txt` is `Allow: /` with no `Disallow`; 40 blog posts carry 320 partner links as `/go/<slug>` with `rel="noopener"` only (no `nofollow` or `sponsored`); the route pages' `/out/<slug>` links have no `rel` at all and the Away Mode links have only `noopener`. A crawler following those links hits the redirect and is logged as a click, and is also sent on to the partner. No user agent is stored, so this cannot be proven from the database, but the pattern fits.
- **Fixed 2026-10-07 (PR #80, confirmed on production):** `Disallow: /out/` and `Disallow: /go/` in `robots.txt`, and `rel="sponsored nofollow noopener"` on every partner link (the 320 blog links, the route page, Away Mode, the interstitial; Google asks for `sponsored` on paid links, and affiliate networks dislike bot clicks). **Still not done:** a bot/human flag on the click event, so launch numbers cannot yet exclude bots that ignore `robots.txt`. Past rows are untouched, so expect the anonymous rate to fall only for new traffic; re-check after about a week.
- **Clean-ish counts until that is done:** count only events after the launch moment, and for funnel numbers join to real trips, for example
  `SELECT count(*) FROM events e JOIN trips t ON t.trip_id = e.sub_id WHERE e.event_type='outbound_click' AND e.ts > '2026-10-17 07:00:00'`.
  Treat anonymous `outbound_click` and any `/go/` click as unreliable. Signups, `check_run` and `email_open` are the better launch-week signals.

## 7. Known open items that affect launch week
- The digest archive is storing editions privately; before publishing it decide whether to switch `ENABLE_EMAIL_V2` on too (the archive shows the v2 design, subscribers still get the plain email), and note no weekly edition exists yet.
- Resend webhook may not be subscribed to bounces and complaints (owner, Resend dashboard). DMARC is `p=none`.
- The first run of the daily fetch on the new slot and of the social post are unobserved. The daily compile and the Sunday newsletter still run on slots GitHub delays.
- DEN, PHX and LAS have no deals before about Oct 21 and thin coverage (6 to 10 of 40 routes priced); the homepage says 15 hubs.
- `/terms` is a minimal page and `privacy.html`, `/terms` and the disclosure wording have had no legal review. The Seller of Travel position is a recorded risk acceptance with four reopen triggers (`CLAUDE.md`). The LLC is not formed.
- The live `hello@sparkfare.com` auto-responder text still says "not a travel agency" and should be reworded.

## 8. Where things live
Cloudflare (Worker `sparkfare-app`, D1 `sparkfare-db`, DNS), Resend (sending, bounces, webhook), Clerk (production instance on `clerk.sparkfare.com`), GitHub (`centeen/sparkfare`: code, data files, Actions), Travelpayouts (Aviasales commissions), each partner's own dashboard (revenue for Away Mode partners is entered by hand into `partner_conversions`).
