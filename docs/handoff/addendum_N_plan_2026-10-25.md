# Addendum N, N0: read-only plan (2026-10-24)

Written by Claude Code, 2026-10-24 evening (one day ahead of the Oct 25 target). Read-only: no data, schema, flag, secret or workflow was changed. Production was touched only by (a) one `SELECT` against `sqlite_master` and `d1_migrations` through `wrangler d1 execute --remote`, and (b) seven unauthenticated `GET` requests to `sparkfare.com` (status code and size only; no body saved). Raw outputs are in `scratch/n0/` (git-ignored by `.assetsignore`, not committed). Vendor facts are quoted from the vendors' pages fetched today; where a page did not say something, this file says so.

Framework: `docs/data/DATA_FRAMEWORK.md` (committed unchanged, PR #368). Rules: `docs/handoff/ADDENDUM_N.md`.

## Summary for the owner

1. **Raw fares are publicly downloadable today (item 3).** One snapshot (194 KB), the three full history files (1.7 MB, 1.4 MB, 152 KB) and the three raw fetch files return HTTP 200 from `sparkfare.com`. N6 fixes this and should go first, ahead of or together with N1. Nothing here needs R2.
2. **Production schema is clean in one direction only (item 1).** Every migration is tracked and applied (32 of 32), `npm run migrate` would be a no-op, and no migrated column is missing from production. But production has **8 tables that no migration creates** (all made at runtime by `CREATE TABLE IF NOT EXISTS` in `src/`). N7 has real work, but it is a smaller job than the framework's F5 implied: 8 tables, 0 column differences.
3. **The daily fetch runs about 4.5 to 5.5 hours late (item 5).** Scheduled 03:17 UTC, it actually started 07:44 to 08:47 UTC in the last 8 days. The 08:00 UTC digest therefore normally sends on the **previous** day's JFK data. Not caused by N and not part of N, but it affects the "freshness" SLOs N2 and N8 will set.
4. **Every push to `main`, including the bot's data commits, appears to deploy (item 4).** About 8 bot data commits and 13 other commits landed on Oct 24 alone. This means a data-only freeze is not possible without changing the workflows (N14b), and R2 serving (N14) is what would end the deploy-per-data-commit pattern.
5. **History depth (item 6) is shallower than the framework assumes.** 564 of 920 route keys have ever had a price. Median recoverable distinct days per route is 25, max 49 (Sep 6 start). 13 of 23 origins start Sep 6; the last 11 start between Sep 12 and Oct 10. Backfill will not create more history than that.
6. **The load check (item 8) says N fits only if the hard gates stay first.** Recommended deferrals are listed in section 8.

## 1. Production schema versus migrations

Method: dumped `sqlite_master` and `d1_migrations` from `sparkfare-db` (`--remote`, read-only). Built a scratch SQLite from the dump, and a second one by applying all 32 files in `migrations/` in order (`node:sqlite`), then compared tables and columns.

| Check | Result |
|---|---|
| Migration files / tracked in `d1_migrations` | 32 / 32, no untracked file, no tracked file missing from the repo |
| All 32 files apply cleanly to a fresh database | Yes, no error |
| Tables in production / produced by migrations | 29 / 21 |
| Tables in migrations but not in production | 0 |
| Column differences on the 21 shared tables | 0 |
| Indexes in production | 6 (`idx_digest_editions_date`, `idx_pre_dep_seq_email`, `idx_pto_watch_unique`, `idx_pto_watch_window_end`, `idx_trips_user`, `idx_widget_rate_limits_window`) |

**Production-only tables (8):** `away_mode_clicks`, `away_mode_email_log`, `daily_alert_deliveries`, `departing_soon_deliveries`, `departure_briefing_deliveries`, `early_bird_snapshots`, `route_retrospective_deliveries`, `stress_valve_deliveries`. All are created at runtime by `src/` (`src/index.js`, `src/email.js`).

**Runtime `CREATE TABLE IF NOT EXISTS` in `src/`** (table, file): `away_mode_email_log` (email.js), `away_plan_done`, `away_plan_reminders`, `away_plans` (planReminders.js), `consent_log` (index.js), `daily_alert_deliveries`, `departing_soon_deliveries`, `departure_briefing_deliveries` (index.js), `digest_sent_snapshots` (digestChange.js), `email_suppressions` (email.js and index.js, 5 statements), `events` (email.js and index.js, 5 statements), `guard` (email.js and index.js, 5 matches of my pattern; probably a comment or helper string rather than a table, N7 should check), `home_cards` (homeCard.js), `partner_payouts` (meters.js), `plus_waitlist` (plusWaitlist.js), `pre_departure_sequence_deliveries`, `route_retrospective_deliveries`, `stress_valve_deliveries`, `trips`, `watchlists` x2 (index.js), `rule_status_overrides`, `rule_watch_urls` (ruleWatcher.js). Several of these also have migrations (so the runtime statement is a duplicate definition); the 8 above do not.

**Would `npm run migrate` fail today?** No: with all 32 files tracked, wrangler has nothing to apply. The risk the framework names (F5) is real only for a *new* migration that touches a column already added by hand. Caveat from `CLAUDE.md`: `wrangler d1 migrations apply --remote` has returned a Cloudflare 7403/403 intermittently on this account; `d1 execute --remote` works. N7 should plan on the `d1 execute --file` path.

**Implication for N7:** the reconcile migration needs `CREATE TABLE IF NOT EXISTS` for the 8 tables, a bookkeeping row, and no column work. The snapshot file should be generated from production's dump, then compared to the migrated result in CI.

## 2. Data consumers

Method: `git grep` of each file name across scripts, workflows, Worker and HTML (tests, generated `data/` and `blog/` excluded). Confirms the Hub's reading and adds three files.

| File | Written by | Read by |
|---|---|---|
| `sparkfare_ranked_deals.json` | `daily-fetch.yml` (ranking script) | `index.html`, **Worker** (`src/index.js`, 6 references: board API, route pages, digest, newsletter, `/check`, share card), pSEO, newsletter, social, PTO fetch, report and preview scripts |
| `sparkfare_ranked_deals_other_origins.json` | `daily-compile-other-origins.yml` | `index.html`, **Worker** (6 references), pSEO, newsletter, PTO fetch, report scripts |
| `sparkfare_hourly_ranked_deals.json` | `hourly-multi-origin-fetch.yml` | **Worker** (`src/index.js`, 1 reference: the data-freshness monitor), PTO fetch (destination ordering) |
| `sparkfare_pto_window_prices.json` | `pto-window-fetch.yml` | **Worker** (`src/index.js`, `ptoPages.js`, `ptoWatch.js`) |
| `sparkfare_destinations.json` | hand-edited | `index.html`, `check.html`, **Worker**, pSEO, blog generator, leave-by rules |
| `sparkfare_images.json` | hand-edited | `index.html`, **Worker**, pSEO, blog generator, social |
| `sparkfare_flight_prices.json` (JFK raw fetch) | `daily-fetch.yml` | ranking script, free-tier compile script, workflow only. **No page or Worker.** |
| `sparkfare_hourly_flight_prices.json` | `hourly-multi-origin-fetch.yml` | workflow only |
| `sparkfare_flight_prices_other_origins.json` | `daily-compile-other-origins.yml` | workflows only |
| `sparkfare_price_history.json` (JFK) | `daily-fetch.yml` | ranking script and `daily-fetch.yml` only |
| `sparkfare_hourly_price_history.json` | `hourly-multi-origin-fetch.yml` | same workflow only |
| `sparkfare_price_history_other_origins.json` | `daily-compile-other-origins.yml` | workflows only |
| `sparkfare_hourly_snapshots/` (249 files, 62 MB) | `hourly-multi-origin-fetch.yml` | `daily-compile-other-origins.yml` and the free-tier compile script only |
| `sparkfare_seo_cache.json` | pSEO generator (via `daily-compile-other-origins.yml`) | pSEO generator only |
| `sparkfare_broadcast_history.json` | social post workflow | `Phase 3 Social Broadcaster.py` only |
| `dummy_ranked_hourly.json`, `dummy_ranked_other.json` | none found | **none** (no reference in code, scripts, workflows or tests) |

The Worker also bundles `content/destinations.json`, `content/fare_tips.json` and `content/pto_destination_fit.json`.

**Worker-through-`env.ASSETS` readers (item 121 of the Hub):** the digest, newsletter, `/check`, route pages, board API, share card and PTO pages all read through the six public files above plus `sparkfare_pto_window_prices.json`. The social broadcaster, newsletter generator and report scripts run in GitHub Actions against the checked-out repo, so `.assetsignore` cannot affect them.

**N6 candidates, confirmed (nothing public reads them):** the snapshot folder, the three `*_price_history*.json` files, the three `*_flight_prices*.json` files, `dummy_*.json`. **Two more the handoff did not list, with the same property:** `sparkfare_seo_cache.json` and `sparkfare_broadcast_history.json`. Recommend adding both; the owner decides.

## 3. Public exposure (status codes only)

| URL | Status | Size |
|---|---|---|
| `/sparkfare_hourly_price_history.json` | 200 | 1,707,640 |
| `/sparkfare_price_history.json` | 200 | 151,777 |
| `/sparkfare_price_history_other_origins.json` | 200 | 1,367,899 |
| `/sparkfare_flight_prices.json` | 200 | 19,659 |
| `/sparkfare_hourly_flight_prices.json` | 200 | 335,730 |
| `/sparkfare_hourly_snapshots/flight_prices_2026-09-06T180853.396844+0000.json` (first request) | 307, redirect to the percent-encoded name | 0 |
| same, encoded `%2B0000` form, followed | 200 | 194,543 |

`.assetsignore` (read) has no entry for any of these. The framework's F3 is confirmed. Note the 307: Cloudflare redirects the raw `+` to `%2B`, so a simple status check without following redirects would have wrongly suggested a block.

## 4. Deploys

- Cloudflare Workers Builds deploys on push to `main`. Evidence: bot commit "Hourly multi-origin flight data update" at 15:11 UTC on Oct 24 and a production deployment created 15:12:43 UTC; PR #368's merge ran a Workers Build check ("pass") as part of its checks. `wrangler deployments list` shows only the latest 10 deployments (all Oct 24 between 11:16 and 15:38 UTC), so a per-day count cannot be derived from it.
- Commits to `main` on Oct 24 so far: 8 by `sparkfare-bot` (hourly feed, daily fetch, compile), 13 by `t` (the Antigravity author) and 5 by `centeen`.
- **Oct 17 auto-deploy failure: fixed.** PR #283 (lockfile `utf-8-validate` override) merged and Cloudflare deployed version `e5154c7e` on Oct 17; builds since then pass (this PR's check also passed).
- **During the Nov 6 18:00 ET to Nov 8 freeze**, bot data commits will keep deploying (about 8 a day) unless the workflows are paused. The freeze is a code-merge freeze, not a deploy freeze. The owner should decide whether that is acceptable; the framework's answer is N14 (data served from R2, deploys never carry data).
- Not confirmed from here: whether the Workers Build is path-filtered. Check Cloudflare dashboard, Workers & Pages, `sparkfare-app`, Settings, Builds, "Build watch paths". One look settles it.

## 5. Run reality (last 8 days, Oct 17 to Oct 24, GitHub Actions)

| Workflow | Runs | Failures | Duration (min / avg / max) | Per day | Scheduled | Actual start (UTC) |
|---|---|---|---|---|---|---|
| Daily Flight Data Pipeline | 8 | 0 | 2 / 2 / 2 | 1 | 03:17 | 07:44 to 08:47 |
| Hourly Multi-Origin Feed | 43 | 0 | 33 / 34 / 47 | 4 to 7 | hourly (`23 * * * *`) | irregular, gaps of 3 to 6 h |
| Daily Free-Tier View (other origins) | 16 (8 schedule, 8 chained) | 0 | 0 / 2 / 4 | 2 | 07:10 | 14:24 to 17:46 |
| PTO Window Fares | 8 | 0 | 28 / 28 / 29 | 1 | 04:47 | 08:49 to 10:18 |
| Daily Social Post | 7 | 0 | 0 / 0 / 1 | 1 | 14:17 | 17:15 to 19:58 |
| Sunday Newsletter | 1 | 0 | 0 / 0 / 0 | weekly | Sun 14:00 | 17:06 (Oct 18) |

- **The Hub's arithmetic is confirmed:** a multi-origin run takes at least 31 minutes (observed 33 to 47) and the feed lands 4 to 7 times a day, not 24.
- **No failures in 8 days across 83 runs.**
- **Late starts are the finding.** Every scheduled workflow starts hours after its slot. For `daily-fetch` the late start puts the finished JFK file at about 08:00 to 09:00 UTC, **after** the 08:00 UTC digest cron. The digest therefore normally runs on the previous day's JFK data, and non-JFK data on the previous compile (the compile finishes 14:30 to 18:00 UTC). The framework's "served file at most 30 h old on 99% of days" still holds with these start times, but only just for JFK (a 5 h slip on a 24 h cadence leaves about 5 h of margin); N8's thresholds should be set from these observed times, not the cron strings.
- Implication for N2/N8: use the 30 h limit as written (it holds), not 12 h for the daily file. The multi-origin 12 h limit (handoff N8) is **too tight**: the longest observed gap between hourly runs is about 6 h and a 47 minute run is possible, so 12 h leaves little margin. Suggest 10 h alert, 14 h hard.

## 6. History depth recoverable

(a) **Snapshots:** 249 files (the handoff said 248), 62 MB, 2026-09-06 to 2026-10-24. Scanned all of them for non-empty results per route key.

- 564 of the 920 route keys (23 origins x 40 destinations) have ever had a price. 356 have never had one.
- Distinct days with a price, per route: min 1, median 25, max 49.
- Oldest first-seen: 257 routes on Sep 6; the other 307 start between Sep 7 and Oct 24. 210 routes first appear after Sep 20.
- By origin, first snapshot day: JFK, LAX, ORD, ATL, DFW, SFO, MIA, IAD, EWR, SEA, IAH, BOS on **Sep 6**; TLV Sep 12; DEN, PHX, LAS Oct 7; PHL, MSP, CLT, DTW, FLL, BWI, AUS Oct 10.

(b) **Git history of the three history files** (full clone, not shallow): `sparkfare_price_history.json` (JFK) first committed **2026-09-03** (56 commits); `sparkfare_hourly_price_history.json` 2026-09-06 (250 commits); `sparkfare_price_history_other_origins.json` 2026-09-11 (108 commits). Each committed version holds only a 30 day window, so older versions give the **Sep 3 to Sep 5 JFK days** that snapshots lack, and nothing older than the first commits.

**N9's backfill start:** Sep 3 for JFK (from git), Sep 6 for the other 11 early origins, then each origin's own first date. This is all the history that exists. Raw is only as old as the first fetch; nothing before Sep 3 exists anywhere in this repo.

## 7. Vendor documentation (quoted, fetched 2026-10-24)

- **`wrangler d1 export`** (developers.cloudflare.com/d1/wrangler-commands). Flags: `--remote` "Export from a remote D1 database"; `--output` "Path to the SQL file for your export"; `--table` "Specify which tables to include in export"; `--no-schema` "Only output table contents, not the DB schema"; `--no-data` "Only output table schema, not the contents of the DBs themselves"; also `--skip-confirmation`. **The page makes no statement about the database being blocked or unavailable during export**, so that is unconfirmed; N3 should say "unconfirmed" in the runbook and time the first real export against a quiet hour. `d1 execute --file`: "A .sql file to ingest." (no size note on the page).
- **R2 from Actions.** `wrangler r2 object put` is documented at developers.cloudflare.com/r2/reference/wrangler-commands: "Create an object in an R2 bucket"; flags `--file` "The path of the file to upload", `--content-type`, `--remote` "Interact with remote storage", `--local`. No upload size limit is stated on the page. (The examples page URL `r2/examples/wrangler/` returned 404.) Wrangler needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets N0 asks the owner for. An S3-compatible path with R2-specific keys also exists but was not read today; wrangler is enough for these volumes. **Write-once is not a wrangler flag:** N1 must check with `r2 object get` or use unique run keys (it uses timestamped keys, so a collision is only possible on a rerun of the same second).
- **Resend batch** (resend.com/docs/api-reference/emails/send-batch-emails). "send up to 100 emails in a single API call." "The `attachments` field is not supported yet." Idempotency: header `Idempotency-Key`, "should be unique per API request", keys "expire after 24 hours". The page states no rate limit. The page did not name `scheduled_at` as unsupported but I could not confirm it works in batch; Sparkfare does not use it.
- **Workers Paid** (developers.cloudflare.com/workers/platform/pricing): "10 million included per month" requests; "Max of 5 minutes of CPU time per invocation (default: 30 seconds)"; "minimum charge of $5 USD per month for an account". **Limits page:** subrequests per invocation Free "50", Paid "10,000 (up to 10M)"; **Cron Triggers per account Free "5", Paid "250"**; CPU per cron invocation Paid "30 seconds (< 1 hour interval)" and "15 min (>= 1 hour interval)".
- **D1 limits** (developers.cloudflare.com/d1/platform/limits): maximum bound parameters per query "100"; database size "10 GB (Workers Paid) / 500 MB (Free)"; queries per invocation "1000 (Workers Paid) / 50 (Free)"; Time Travel "30 days (Workers Paid) / 7 days (Free)". These match what N4 and N3 assume. **Workers Paid status itself is not verifiable from here;** the owner reports it done on Oct 24 and `CLAUDE.md` records Paid since 2026-10-13. The 1,000 queries per invocation is the number to watch for N4's batching.

## 8. Load: does N fit before Nov 4?

Open before N, per `ROADMAP.md` and `BUILD_STATE.md`: the D-036 hard gates and Hub items 117 to 121; K-B and K-C (the K plan is the largest remaining block); the Away Mode and PTO items that already have PRs. N adds 15 packages in 11 days (Oct 25 to Nov 4).

My honest read: **N0, N1, N6, N2, N3, N5 fit** if they are small and K-B does not slip. **N4, N7, N8 fit only if the first six land by Oct 30.** **N9 to N14 do not fit** beside K-B and K-C without risking a D-036 gate; they are built dark but are still reviewed, tested and merged one at a time (each merge waits for its deploy), and a data-affecting PR with a shadow-diff acceptance cannot be rushed.

Recommended deferral, following the handoff's own cut order: **N13, N12, N11, N14 first, then N10 and N9** to the Nov 21 to Dec 10 window. If Checkpoint 2 (Oct 31) is behind, defer N9 and N10 at that point rather than earlier, because N9 only needs N1 and N7.

**Two N-specific risks beyond capacity:**
- N1 and N2 change what the fetch workflows do on every run (an upload step, a validation step that can fail the job). The first scheduled runs after merge are the live test; they land at irregular hours (item 5), so a failure may not show for several hours. The owner should expect GitHub failure emails from workflows that previously never failed (83 of 83 passed).
- N5 touches signup attribution, which M1 (a hard gate) depends on. Keep it a separate PR from any N package and re-run the M1 acceptance in the PR.

## 9. Owner prerequisites, as clicks

Nothing below is done by a tool. Do 1 and 2 before N1/N3 are built; N6 needs none of them.

1. **Confirm Workers Paid.** dash.cloudflare.com, Workers & Pages, Plans. It should say Workers Paid. If not, choose the $5 plan.
2. **Enable R2 and create two private buckets.**
   - Left menu, Storage & databases, R2 object storage. Click "Get started" or "Purchase R2 plan" if it asks. **R2 may ask for a payment method even for the free tier; the framework could not confirm this, so report back what it asks.**
   - Create bucket, name `sparkfare-raw`, location "Automatic", default storage class. Do not enable a public bucket URL (Settings, Public access, leave "Disabled") and do not connect a custom domain.
   - Repeat for `sparkfare-backups`.
3. **Create the API token for GitHub Actions** (dash.cloudflare.com, top-right profile, My Profile, API Tokens, Create Token, "Create Custom Token").
   - Permissions: "Account" / "D1" / "Edit"; "Account" / "Workers R2 Storage" / "Edit". Nothing else.
   - Account resources: "Include" / the Sparkfare account only. No zone resources.
   - Add a client IP filter only if you are comfortable with GitHub's rotating ranges (recommended: leave empty).
   - Create, copy the token once.
4. **Save the secrets in GitHub.** github.com/centeen/sparkfare, Settings, Secrets and variables, Actions, "New repository secret": `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare dashboard, Workers & Pages overview, right side "Account ID"). Paste yourself; do not send either to a chat.
5. **R2 lifecycle on `sparkfare-backups`** (optional now; N3 can prune from a workflow step instead): bucket, Settings, Object lifecycle rules, "Add rule", prefix `d1/daily/`, delete objects after 14 days.
6. **Later, not now:** approve N5's privacy line after the Hub's Guard read; use the N5 UTM table on every launch link.

**Not owner tasks, but this plan asks for decisions:**
- Add `sparkfare_seo_cache.json` and `sparkfare_broadcast_history.json` to N6's block list? (recommended: yes.)
- Accept that bot data commits keep deploying during the freeze, or pause the workflows for Nov 6 18:00 ET to Nov 8? (item 4)
- Accept the 10 h / 14 h freshness thresholds for the multi-origin feed instead of 12 h? (item 5)

## PR order with M, K and J (proposed)

Oct 25: this plan (PR) · Oct 26: **N6** (no prerequisites needed; fastest exposure fix), then **N1** once the token exists · Oct 27: N2 (adds the pytest step to `pr-tests.yml`) · Oct 28: N3 · Oct 29 to 30: N5 (own PR, re-run M1 acceptance), N4, N7 · Oct 31: N8, then the Checkpoint 2 decision on N9/N10 · K-B and K-C and the hard gates keep their own order; N never takes a hard-gate slot.

## Appendix: facts that differ from the handoff

- Snapshots: 249 files, not 248 (one added since).
- Cron triggers on the Worker: three, not four (`30 3 * * *`, `0 8 * * *`, `0 9 * * 2`). Paid allows 250.
- Next free migration number: 0032 (0031 is `signup_source`).
- `python` is not on this machine's path; `py` (3.14.7) works. N1's and N2's scripts and tests will need `py` locally; CI is the real check.
- The framework (Step 3) says 32 migrations; confirmed.
