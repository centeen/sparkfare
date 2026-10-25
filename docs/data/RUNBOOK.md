# Data runbook

One section per thing that can go wrong with Sparkfare's data. Written for the owner at 11 p.m. with one hand free: what it means, the first command to run, and how to fall back. N8 adds the alert sections; N3 starts the file with the database restore.

Windows note: if a plain `npx wrangler ...` fails, run wrangler through node: `node node_modules/wrangler/bin/wrangler.js ...` (see `CLAUDE.md`).

## Restore D1

**When:** the production database `sparkfare-db` was damaged, wiped or wrongly changed (a bad migration, a bad script, a deleted table). Users, consent records and the suppression list live only here, so restore carefully and tell nobody else to change anything until you are done.

**Recovery targets (framework 5.8):** lose at most 24 hours of audience data; be restored within 4 hours.

**What exists:**

| Source | Covers | Kept |
| --- | --- | --- |
| Time Travel (Cloudflare, point in time) | the last 30 days, to the minute (Workers Paid; it was 7 days on Free) | 30 days |
| Daily export `d1/daily/YYYY-MM-DD.sql.gz` in the private bucket `sparkfare-backups` | whole database at about 02:10 UTC | 14 days |
| Monthly export `d1/monthly/YYYY-MM.sql.gz` | whole database on the 1st | 12 months |

**Try Time Travel first** (fastest, loses the least):

1. Pick the moment just before the damage, in UTC. Look up the bookmark for it:
   `npx wrangler d1 time-travel info sparkfare-db --timestamp=2026-10-24T12:00:00Z`
   It prints a bookmark. Write it down. This lookup changes nothing.
2. Restore to it (this overwrites the live database; Cloudflare also prints the bookmark to undo it, keep that too):
   `npx wrangler d1 time-travel restore sparkfare-db --timestamp=2026-10-24T12:00:00Z`
3. Check the site: `https://sparkfare.com/api/health`, then sign in, and open `/admin/growth` to see counts look right.

**If Time Travel cannot help** (the damage is older than 30 days, or Time Travel itself is unavailable), restore from an export:

1. Download the backup you want. The file name is the date: `npx wrangler r2 object get sparkfare-backups/d1/daily/2026-10-24.sql.gz --remote --file restore.sql.gz` and unzip it (`gunzip restore.sql.gz`).
2. **Do not import into production directly while it still has tables**: the export recreates them and will fail or double up. Either restore into a new empty database and point the Worker at it, or drop the damaged tables first. The safe rehearsal is the monthly drill (below), which does exactly this into the scratch database.
3. Import: `npx wrangler d1 execute sparkfare-db --remote --file restore.sql`
4. Re-run the check in step 3 above.

**The restore drill proves this works.** On the 2nd of every month the `D1 backup and restore drill` workflow restores the newest backup into the scratch database `sparkfare-restore-drill` and compares row counts per table. Results are in `docs/data/restore_drills.md`. A failed drill fails the workflow, so GitHub emails you; treat that as a real warning that the backups cannot be trusted until fixed.

**Check that backups are happening:** the health check (daily email) says so when the newest backup is more than about 26 hours old. By hand: `npx wrangler r2 object get sparkfare-raw/state/d1_backup/latest.json --remote --pipe`.

**Not confirmed:** whether `wrangler d1 export` blocks the database while it runs. Cloudflare's wrangler page does not say. The backup runs at 02:10 UTC, a quiet hour, and the database is small; if writes ever fail around that time, check the backup workflow's run time first.

**Backups contain personal data.** The bucket `sparkfare-backups` must stay private (no public bucket URL, no custom domain). The scripts print table names and counts only, never rows. A deletion request is honoured in backups by roll-off (14 daily, 12 monthly), as the privacy page should say.

## The daily data alert (what the email means)

A check runs every day at 09:30 UTC, after the 08:00 digest (`src/dataAlerts.js`). If everything is fine you get **no email**. If anything is wrong you get **one** email, subject `Sparkfare data alert: <the worst item> (+N more)`, listing every item with its **Now** value, its **Limit** and the section below to open. At most one a day, even if the same item persists for days. **Critical** means act today; **Warning** means look today, it can wait for tomorrow.

To see what the check sees right now without sending anything (needs the admin secret):

```bash
curl -s -X POST -H "Authorization: Bearer $ADMIN_SECRET" "https://sparkfare.com/api/check-data-alerts?dry=1"
```

(In PowerShell, `curl` is not curl: use `Invoke-WebRequest -Method POST -Headers @{Authorization="Bearer ..."} -Uri ...`.)

## Served data is stale or missing

**Means:** a file the board, the emails or `/check` read (`sparkfare_ranked_deals.json`, `..._other_origins.json`, `sparkfare_hourly_ranked_deals.json`) is old, unreadable, has no priced routes, or has doubled origin prefixes. Limits: the two daily files warn at 30 h and are critical at 48 h; the hourly multi-origin file warns at 10 h and is critical at 14 h (the owner's decision of 2026-10-24; the feed lands 4 to 7 times a day with gaps of about 6 h).

**First look:** GitHub, Actions tab, the workflow named in the item ("Sparkfare Daily Flight Data Pipeline", "Sparkfare Hourly Multi-Origin Feed", "Sparkfare Daily Free-Tier View"). Has it run? Did it fail? `gh run list --workflow daily-fetch.yml --limit 5`.

**Fall back:** nothing breaks for visitors; the site keeps serving the last good file and the freshness note on each card says how old it is. To start a run by hand: Actions tab, pick the workflow, "Run workflow". If a run keeps failing, read its log; the usual causes are the Travelpayouts token, the rate limit, or a push collision (it retries five times).

## A fetch run was blocked or has stopped

**Means:** the validation gate refused to publish a run (a check named in the item failed: schema, too few priced routes, too many failed API calls, too many bad records, a doubled origin prefix, a duplicate route), or no run has recorded a result for longer than the limit (daily fetch: 36 h warn, 48 h critical; multi-origin: 10 h warn, 14 h critical). When a run is blocked the site keeps serving yesterday's file and nothing is committed.

**First look:** the failed run's log in Actions: step "Validate the run" prints each check and why. The result is also stored: `npx wrangler r2 object get sparkfare-raw/state/multi_origin/latest.json --remote --pipe` (or `daily_jfk`).

**Fall back:** a blocked run needs no action to keep the site safe. If the cause is bad upstream data it usually clears by the next run. If it persists, the thresholds are in `config/data_quality.json`; change a number there only after reading why the check failed, never to make an alert go away.

## The D1 backup is old or the restore drill failed

**Means:** the nightly export (02:10 UTC) is more than 26 hours old, or the last monthly restore drill failed or is more than 45 days old. A failed drill means the backups cannot be trusted until fixed.

**First look:** Actions tab, "D1 backup and restore drill". Then the section "Restore D1" above. Check the newest backup exists: `npx wrangler r2 object get sparkfare-raw/state/d1_backup/latest.json --remote --pipe`.

**Fall back:** Time Travel (30 days, to the minute) is independent of these backups, so recovery is still possible while this is fixed. Run the workflow by hand with "run_drill" set to true to test a restore today.

## D1 or Workers usage

**Means:** the database is above 70% of its size limit (warning) or 90% (critical); the limit is 10 GB on Workers Paid (500 MB on Free), overridable with the `D1_SIZE_LIMIT_BYTES` variable.

**Not checked automatically:** D1 rows read and written per day, and Workers requests per day. A Worker cannot read those. Look in the Cloudflare dashboard: Workers & Pages, `sparkfare-app`, Metrics; D1, `sparkfare-db`, Metrics. Cloudflare's limits (read 2026-10-24): 1,000 D1 queries per Worker invocation and 10,000 subrequests (Workers Paid).

**First look:** which table grew? `npx wrangler d1 execute sparkfare-db --remote --command "SELECT name, COUNT(*) FROM events GROUP BY 1"` is too heavy for a big table; ask for row counts per table one at a time. The event log is the usual cause and N13 (retention) is the long-term fix.

**Fall back:** raise the plan limit (Workers Paid is already 10 GB) or delete old event rows after a backup: restore from the nightly export if a delete goes wrong.

## This morning's digest did not go out

**Means:** the 08:00 UTC digest left some recipients as `failed` in `daily_alert_deliveries`, or there are verified subscribers but no delivery rows at all (the run did not happen).

**First look:** the reason is stored per recipient: `npx wrangler d1 execute sparkfare-db --remote --command "SELECT status, error, COUNT(*) FROM daily_alert_deliveries WHERE delivered_on = date('now') GROUP BY 1, 2"`. Common causes: the sending guard (next section), a Resend outage, or an invalid address (that one fails alone).

**Fall back:** failed rows are retried by the next day's run automatically. To send now: `POST /api/send-daily-alert` is for one address only; there is no bulk resend button by design (it could double-send). If the whole run did not happen, check `wrangler tail` around 08:00 UTC and the Cloudflare Workers cron status.

## The email sending guard is tripped

**Means:** too many bounces or complaints in the last 7 days (10 bounces or 3 complaints under 100 sends; 5% bounces or 0.3% complaints at 100 sends or more). While tripped, every guarded email (digest, verification, lifecycle emails) is skipped. It clears by itself as the window improves, and the verdict is cached for ten minutes.

**First look:** Resend dashboard, the bounce and complaint list. Are they real addresses that stopped working, a typo'd signup domain, or a spam complaint? Suppression rows are in `email_suppressions`.

**Fall back:** nothing to switch off: removing the cause is the fix. Do not raise the thresholds to make the email stop; a high bounce rate damages the sending domain. If it is a one-off cluster of test addresses, deleting those test events is a decision for the owner.

## The curated fare store (`fare_daily`, N9)

One row per route and UTC day: the cheapest fare seen that day by any pipeline (Step 65), with its airline and dates when a fetch saw them. Route key is `<ORIGIN>:<destination>` for every origin, JFK included. Built from the raw archive by `scripts/data/curate.py`; **nothing reads it yet** (the shadow ranking, N10, will). Migration `0036`.

**Rebuild or refill it:** Actions, "Curate fares (backfill)", Run workflow. Leave "dry_run" on `true` first: it reads the raw archive, checks every object against the repo copy, builds the SQL and prints counts (rows, routes, first and last date, days per route). Run it with `false` to write. It is safe to run again: the SQL can only lower a stored price and raise `n_obs`, so a second run changes nothing. If it stops with "could not be read", an object is missing from `sparkfare-raw` or differs from the repo; nothing was written.

**Look at it:** `npx wrangler d1 execute sparkfare-db --remote --command "SELECT COUNT(*), COUNT(DISTINCT route_key), MIN(obs_date), MAX(obs_date) FROM fare_daily"`.

**Known limits.** History before the raw fetches began (Sep 3 to 5 for JFK, and any day a fetch never saw) comes from old versions of the three history files, which hold a price and a time but no airline or dates; those rows have `airline` NULL and `n_obs` 1. The curated store is **not refreshed daily yet**; today it holds what the backfill loaded. Ongoing daily curation is a follow-up before N10 depends on it.
