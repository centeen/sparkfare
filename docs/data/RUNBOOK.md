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
