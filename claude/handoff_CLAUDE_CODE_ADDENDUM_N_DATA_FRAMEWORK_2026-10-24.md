# Addendum N: Data Framework v1 build (Oct 24, 2026)

**For:** Claude Code, and Antigravity IDE when Claude usage runs out. Both tools follow this file, the same rules and the same progress log (`docs/handoff/BUILD_STATE.md`, created under Addendum M).

**Why.** On Oct 24 the owner approved Sparkfare Data Framework v1 (D-038) and chose to build the core and bulk of it before the Nov 7 launch (D-039, option B). Today the fare history is trimmed to 30 days on every run, all fare data lives in git, nothing validates pipeline output before it is published, and there is no backup beyond Cloudflare's 7-day recovery. This addendum fixes those, adds launch-grade channel measurement, and consolidates the three fare histories into one, without changing anything a visitor sees before launch.

**Read first, in order:**
1. `docs/data/DATA_FRAMEWORK.md` (create it in N0 from the project file `claude/data_framework_v1_2026-10-24.md`, committed unchanged). Section 5 is the standard; sections 3 and 4 are the evidence.
2. `CLAUDE.md` and `ROADMAP.md`.
3. Addendum M (`docs/handoff/ADDENDUM_M.md`) section 3: the cross-tool conventions apply here unchanged.

**Decisions this addendum carries:**
| Decision | What |
|---|---|
| D-036 | Launch stays Sat Nov 7. Hard gates at the Nov 6 go/no-go: J1 merged, route count matches data, M1 source tagging works. **Nothing in N may put a hard gate at risk; if it does, stop and tell the owner** |
| D-038 | Data Framework v1 is the standing data strategy |
| D-039 | Option B: build D0 and D2 before Nov 4. **Implementation rule:** everything that changes what the board, emails or reports serve is built behind a flag, default off, run in shadow, and flipped no earlier than Mon Nov 9 after five clean daily shadow diffs and a Hub read |
| D-040 | Raw fare data private, stored in Cloudflare R2 |
| D-042 | Retention values in framework section 5.4 |
| Owner fact (Oct 24) | Account is on Workers Paid ($5 a month). Confirm in N0 |

## 1. Order, gates and dates

Dates are the latest a package should merge, not the earliest (D-035 pull-forward applies). Windows follow D-034: Sun to Thu evenings, all day Fri and Sat. Israel clocks go back Sun Oct 25.

| Order | Package | Framework item | Target merge | Flag | Can be cut? |
|---|---|---|---|---|---|
| 0 | **N0** read-only plan and owner prerequisites | all | Sun Oct 25 (stop after it) | — | No |
| 1 | **N1** raw archive to R2 plus backfill | D0.1, DR-01 | Mon Oct 26 | — | **Never** |
| 2 | **N6** stop serving raw and history files | D0.6, DR-06 | Mon Oct 26 | — | **Never** |
| 3 | **N2** run manifest and validation gate | D0.2, DR-09, 10, 13 | Tue Oct 27 | — | **Never** |
| 4 | **N3** D1 backups and restore drill | D0.3, DR-05 | Wed Oct 28 | — | **Never** |
| 5 | **N4** capacity: indexes, batched sends, load test | D0.4, DR-26 | Thu Oct 29 | — | No |
| 6 | **N5** channel attribution and landing counter | D0.5, DR-18 | Fri Oct 30 | — | **Never** (launch data arrives once) |
| 7 | **N7** schema reconciliation and CI drift check | D0.7, DR-04 | Fri Oct 30 | — | No |
| 8 | **N8** same-day SLO alerts and runbook | D0.8, DR-24 | Sat Oct 31 | — | No |
| 9 | **N9** curated store `fare_daily` plus full backfill | D2, DR-01, 03 | Sat Oct 31 | — | Defer to Nov 21 if behind |
| 10 | **N10** one ranking job in shadow, daily diff | D2, DR-03, 12 | Sun Nov 1 | `ENABLE_CURATED_SERVING` | Defer to Nov 21 if behind |
| 11 | **N11** metrics layer and auto-written metrics file | D2, DR-17, 19 | Mon Nov 2 | — | Defer |
| 12 | **N12** tracking plan (event registry) | D2, DR-16 | Mon Nov 2 | — | Defer |
| 13 | **N13** retention and deletion jobs (dark) | D2, DR-22 | Tue Nov 3 | `ENABLE_RETENTION_JOBS` | Defer first |
| 14 | **N14** serve from R2 and stop committing data | D2, DR-02 | Wed Nov 4 (built dark) | `ENABLE_R2_SERVING` | Defer |

**Priority against other work (Hub recommendation, owner may reorder):** D-036 hard gates first (M1 acceptance, items 117 to 121). Then N1, N6, N2, N3, N5. Then K-B and K-C per their plan. Then N4, N7, N8. Then N9 to N14.

**Cut order if Checkpoint 2 (Sat Oct 31) shows a slip:** defer N13, then N12, then N11, then N14, then N10 and N9, to the Nov 21 to Dec 10 window. Never cut N1, N2, N3, N5 or N6. Say so in the approval pack the moment you see the risk.

**Calendar rules unchanged:** last feature merge Wed Nov 4; Thu Nov 5 fix-only; freeze Nov 6 18:00 ET to Nov 8; no flag flips before Mon Nov 9.

**After launch (planned, not in this addendum's merges):**
- Nov 9 at the earliest: flip `ENABLE_CURATED_SERVING`, then `ENABLE_R2_SERVING`, each a one-line PR after five clean shadow diffs and the Hub's read.
- Seven clean days after the R2 flip: N14b stops the workflows committing data files to git (a separate PR).
- Dec 1: flip `ENABLE_RETENTION_JOBS` after the Hub's Guard read of the privacy text.
- Dec 12 to Mar 31 (phase D3, a later addendum): data dictionary, Python regression tests, watchdog, quarantine file, monthly calibration pack, year-over-year report groundwork.

## 2. Standing rules (Addendum M section 2 applies, plus these)
- One PR per package; owner approval through the merge train (D-035). **No N package is green-lane eligible.**
- **Additive before launch.** Before Nov 9, no N package may change a byte that a visitor, subscriber or email receives, except N5's tagged-link behavior and the privacy-page text after its Guard read. Prove it in each PR: the serving files and rendered pages are identical before and after (diff attached).
- **Fail closed.** Any check that fails keeps the last good data in place, records why and alerts. Nothing silently skips.
- **Never rewrite raw.** Raw objects in R2 are write-once. A correction is a new object.
- **Secrets.** The owner creates every token and pastes it into GitHub or Cloudflare himself. Never run an interactive secret command through a tool call (`CLAUDE.md` lesson, Sep 13). Never print, log or commit a token value. Tokens are scoped to the minimum listed in N0.
- **Privacy.** Raw fare objects contain no personal data, keep it so. No IP address, fingerprint, email or traveler date in R2, logs, manifests, metrics or the landing counter. Backups contain personal data: private bucket, scoped token, retention per section 5.4.
- **Licence.** No new public file of raw prices or full histories. Published figures stay derived statistics (Sep 23 written OK). No change to Travelpayouts tools (clause 2.3.5).
- **Ranking rules do not change.** D-021 (deal floor: at least 15% below the median and at least 10 distinct observation days, median over distinct days, today excluded) and the Step 65 "cheapest of the day wins" rule are reproduced exactly; any difference the shadow diff finds is a bug in N10, never a reason to change the rule.
- **Tests.** Every N package adds tests: JS through `npm test`; Python through `pytest` in a new `tests/python/` folder run by `pr-tests.yml`. Golden files live in `tests/fixtures/data/`.
- **Progress log.** Add rows N0 to N14 to `docs/handoff/BUILD_STATE.md`; update it at the end of every session, whichever tool you are.

## 3. Working across Claude Code and Antigravity
Same as Addendum M section 3, with these names:
- `docs/handoff/ADDENDUM_N.md`: this file, committed unchanged in N0. Amendments are appended at the top with a date.
- Branches `n/n1-raw-archive`, `n/n2-validation-gate`, and so on. Commit messages start with the package ID: `N2: add feed contract and fail-closed publish`.
- Start-of-session prompt:
```
You are continuing Sparkfare Addendum N (data framework). Read, in order: CLAUDE.md, docs/data/DATA_FRAMEWORK.md, docs/handoff/ADDENDUM_N.md, docs/handoff/BUILD_STATE.md, then the open n/* pull requests. Do not start anything the owner has not approved. Pick up the "next step" in BUILD_STATE.md for the lowest-numbered unfinished N package that is not blocked. Follow section 2's rules. Before you stop, update BUILD_STATE.md and push.
```

## 4. Owner prerequisites (N0 lists them with exact clicks; nothing below is done by a tool)
1. **R2:** enable R2 on the Cloudflare account (it may ask for a payment method; the free tier covers this use) and create two private buckets: `sparkfare-raw` and `sparkfare-backups`. No public access, no custom domain.
2. **Cloudflare API token for GitHub Actions:** account-scoped to this account only, with D1 Edit and Workers R2 Storage Edit and nothing else. Save as GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. **Confirm Workers Paid** in the dashboard (owner reports done Oct 24).
4. After N5's Guard read: approve the privacy-page line about the landing counter.
5. Launch links: use the UTM table in N5 for every Product Hunt, Show HN, Reddit, Indie Hackers, directory and press link.

## 5. Packages

### N0. Read-only plan (by Sun Oct 25). Stop after it.
Create `docs/data/DATA_FRAMEWORK.md` and `docs/handoff/ADDENDUM_N.md`; add N rows to `BUILD_STATE.md`. Write `docs/handoff/addendum_N_plan_2026-10-25.md` answering:
1. **Production schema vs migrations.** Read-only dump of `sqlite_master` from production D1 (use `--file` or the Node path per `CLAUDE.md`'s Windows note). List every table and column that exists in production but not in `migrations/`, and the reverse; list every `CREATE TABLE IF NOT EXISTS` in `src/`; state whether `npm run migrate` would fail today and on which file. Read-only: change nothing.
2. **Data consumers.** For every data file in the repo root and `sparkfare_hourly_snapshots/`: who writes it, who reads it (page, Worker, email, workflow, script). The Hub's reading: pages and the Worker read only `sparkfare_ranked_deals.json`, `sparkfare_ranked_deals_other_origins.json`, `sparkfare_hourly_ranked_deals.json`, `sparkfare_pto_window_prices.json`, `sparkfare_destinations.json`, `sparkfare_images.json` and `content/destination_lines.json`. Confirm or correct, including the social broadcaster, newsletter and digest (item 121).
3. **Exposure (item 124).** From your machine, request one snapshot file and `sparkfare_hourly_price_history.json` on `https://sparkfare.com/`. Report the status codes only; do not save the bodies.
4. **Deploys.** Does every push to `main`, including the bot's data commits, trigger a Cloudflare deploy? How many deploys a day? Did the Oct 17 auto-deploy failure (R-010 item 3) get fixed? If data commits deploy, say whether they deploy during the Nov 6 to 8 freeze.
5. **Run reality.** From the Actions API: last 7 days of runs per data workflow, with start time, duration and result. Confirm or correct the Hub's arithmetic (920 calls × 2 s ≥ 31 minutes per multi-origin run; 3 to 7 snapshots a day).
6. **History depth recoverable.** Oldest date recoverable for each route from (a) the 248 snapshots, (b) git history of the three history files (a bounded `git fetch --depth` is fine). This sets N9's backfill start.
7. **Tools.** Confirm on the vendors' current docs, with links: `wrangler d1 export` options and whether it blocks the database during export; R2 upload from Actions (wrangler or S3-compatible); Resend's batch send endpoint and its limits; Cloudflare Workers Paid included amounts. Quote, don't recall.
8. **Load.** Whether N fits the windows to Nov 4 beside M1, K-B, K-C and items 117 to 122, and exactly what you would defer per section 1's cut order.
9. **Owner prerequisites.** Exact dashboard steps for section 4, items 1 and 2.

### N1. Raw archive to R2 plus backfill (by Mon Oct 26)
- Every data workflow (daily fetch, multi-origin fetch, PTO window fetch) uploads, after its fetch step and before ranking, the full fetch output as `raw/fares/<pipeline>/date=YYYY-MM-DD/run=<UTC timestamp>.json.gz` to `sparkfare-raw`, with a sidecar `.manifest.json` (see N2 for fields; N1 writes the subset it has). Upload failure fails the job loudly but never blocks today's existing commit path until N14.
- One-off backfill script `scripts/data/backfill_raw_from_snapshots.py`: uploads all 248+ existing snapshots under `raw/fares/multi_origin/date=…/run=…json.gz` with `backfill: true` in the manifest, and the git-history versions of the three history files (from N0 item 6) under `raw/history_files/…`. Idempotent: re-running uploads nothing new.
- **Acceptance:** two consecutive scheduled runs land objects in R2 with correct keys; the backfill count equals the snapshot count; a test proves a key is never overwritten; repo serving files byte-identical to a run without N1.

### N6. Stop serving raw and history files (by Mon Oct 26)
- Add to `.assetsignore`: `sparkfare_hourly_snapshots/`, `sparkfare_price_history.json`, `sparkfare_hourly_price_history.json`, `sparkfare_price_history_other_origins.json`, `sparkfare_flight_prices.json`, `sparkfare_hourly_flight_prices.json`, `sparkfare_flight_prices_other_origins.json`, `dummy_*.json`, plus any file N0 item 2 shows nothing public reads. Keep every file in N0's consumer list.
- Add `tests/asset_allowlist.test.js`: fails if a `*.json` at the root or under a data folder is deployable without being on an explicit allowlist in `scripts/public-assets.json`. New data files must be added on purpose.
- **Acceptance:** after deploy, the N0 item 3 URLs return 404; the board for JFK, LAX and TLV, `/check`, `/time-off/JFK`, a route page and `/api/deals?origin=JFK` render the same as before (screenshots and JSON diff attached).

### N2. Run manifest and validation gate (by Tue Oct 27)
- `schemas/ranked_deals.schema.json` and `schemas/fetch_store.schema.json` (JSON Schema), with `schema_version` added to every serving file.
- `scripts/data/validate_feed.py` runs after ranking and before commit. Checks: schema; origin in the 23-origin set; destination in `sparkfare_destinations.json`; price an integer above 0 and at or below a ceiling in `config/data_quality.json` (start at 10,000 USD); departure after the existing departure buffer; return after departure; currency USD; no double-prefixed keys; one record per route; priced routes at least 80% of the median of the last 7 manifests for that pipeline; failed calls at most 5% of calls. Thresholds live in `config/data_quality.json`, not in code.
- **Fail closed:** on failure the workflow does not commit or publish the new serving files (yesterday's stay live), writes the manifest with `status: "blocked"` and the failing checks, uploads raw anyway, and fails the job so GitHub's failure email reaches the owner. A record-level failure under 1% is quarantined into `raw/quarantine/date=…/run=….json` with a reason code and the rest publishes.
- **Manifest** (`manifest.json` beside each raw object): pipeline, run id, started and finished at, origins, calls made, ok, empty, failed (with route keys), priced routes, deal count, quarantined count, check results, status, schema version, input hash (sha256 of the raw object), code commit.
- `checkDataFreshness` also reads the newest manifest per pipeline (R2 binding `RAW` in `wrangler.jsonc`, read-only use) and reports manifest age and status.
- **Acceptance:** golden-file tests for each check (one passing fixture, one failing fixture per check); a forced failure in a branch run leaves the serving files unchanged and produces a blocked manifest; normal runs publish identical files to today.

### N3. D1 backups and restore drill (by Wed Oct 28)
- Workflow `d1-backup.yml`, daily at 02:10 UTC (clear of the 03:17, 03:30, 07:00 and 08:00 jobs): `wrangler d1 export sparkfare-db --remote`, gzip, upload to `sparkfare-backups` as `d1/daily/YYYY-MM-DD.sql.gz`; on the 1st of each month also `d1/monthly/YYYY-MM.sql.gz`. Lifecycle: keep 14 daily and 12 monthly (R2 lifecycle rule or a pruning step).
- Monthly restore drill, same workflow on the 2nd: import the newest backup into a scratch database `sparkfare-restore-drill`, compare row counts per table with production's counts at export time, record pass or fail in `docs/data/restore_drills.md` and in the Monday standup, then empty the scratch database.
- Runbook `docs/data/RUNBOOK.md` section "Restore D1": point-in-time recovery first (30 days on Workers Paid), backup import second, with exact commands.
- **Acceptance:** one real export lands in R2; one drill passes; the export never prints table contents to the Actions log.

### N4. Capacity (by Thu Oct 29)
- Migration: indexes `events(ts)`, `events(event_type, ts)`, `users(verified_email, is_subscribed)`, `trips(user_id)`; and any index N0 shows a hot query needs. Verify with `EXPLAIN QUERY PLAN` on the standup, growth and revenue queries.
- Daily digest and other bulk sends use Resend's batch endpoint (per N0 item 7) in chunks, keeping per-recipient idempotency in `daily_alert_deliveries` exactly as today.
- Load test (mocked Resend, local D1) with 2,500 synthetic verified users across 23 origins: the 07:00 and 08:00 runs finish inside the Workers Paid limits with no duplicate send; report wall time and CPU.
- **Acceptance:** query plans use the new indexes; load test report attached; no change to email content.

### N5. Channel attribution and landing counter (by Fri Oct 30)
- Migration: `users.signup_channel`, `users.signup_campaign`, `users.signup_referrer_class` (first-touch, set once, never overwritten, like `signup_source`). `signup_source` keeps meaning the surface (home, check, pto…). M1's acceptance must still pass unchanged.
- Channel rule: `utm_source` if present (cleaned as today), else referrer class from `document.referrer` (`search`, `social`, `email`, `other_site`), else `direct`. Self-referrals are `direct`.
- Landing counter: `utm.js` sends one `POST /api/landing` per browser session (sessionStorage flag, nothing stored server-side about the browser) with channel, campaign and a page class (home, route, check, pto, report, other). The Worker drops bot user agents (`botClass.js`) and upserts `landings_daily(date, channel, campaign, page_class, count)`. No IP, no user agent, no id stored.
- `/admin/growth` adds a "By channel" table: landings, signups, confirmed, landing-to-signup %, confirm %, last 7 and 28 days, with the bot-exclusion caveat.
- Launch UTM table, committed as `docs/data/utm_conventions.md` and given to the owner: `producthunt`, `hackernews`, `reddit`, `indiehackers`, `bluesky`, `mastodon`, `x`, `press`, `newsletter`, `directory-<name>`; `utm_campaign=launch2026`; `utm_content` names the post or placement. Lower case, no dates, no personal data.
- Privacy line for the Hub's Guard read (draft): "We count visits that arrive from a link, by where the link was posted, as daily totals. We do not store your IP address or any identifier for this count."
- **Acceptance:** a test landing with and without UTM through each page class increments the right row; a signup after it stores the right channel and surface; bot UA is not counted; `/admin/growth` shows the table to admins only; M1 acceptance re-run passes.

### N7. Schema reconciliation and CI drift check (by Fri Oct 30)
- From N0 item 1: one migration `0032_reconcile.sql` (or the next free number) that creates every production-only table and column idempotently, and bookkeeping rows so `wrangler d1 migrations apply --remote` will not re-run migrations whose effects already exist. Show the owner the exact SQL before it runs against production; it runs only through `npm run migrate` after approval.
- `schema/schema.snapshot.sql`: the expected schema. CI job applies all migrations to a fresh local D1 and fails if the result differs from the snapshot.
- Runtime `CREATE TABLE IF NOT EXISTS` statements stay for now (removing them is D3); add a test listing them so new ones cannot be added without a migration.
- **Acceptance:** `npm run migrate` against production is a no-op after the reconcile migration; CI fails on a deliberate drift in a test branch.

### N8. Same-day SLO alerts and runbook (by Sat Oct 31)
- A Worker cron check at 09:30 UTC (after the 08:00 digest; reuse the existing crons if the account limit binds) evaluates: served-file freshness (30 h), newest manifest status and age per pipeline (12 h for multi-origin), last backup age (26 h), last restore drill result, D1 size and daily rows-read and written against the plan, and the alert-worthy checks already in `checkDataFreshness`.
- On any breach: one email to the owner address used by the standup, subject `Sparkfare data alert: <check>`, body listing each breach, its value, threshold and the runbook section. No breach, no email. Same breach on consecutive days: one email a day at most.
- `docs/data/RUNBOOK.md`: one section per alert: what it means, first command to run, how to fall back.
- **Acceptance:** each check has a test that forces a breach; a dry run on staging sends one email listing two forced breaches.

### N9. Curated store and full backfill (by Sat Oct 31)
- Migration: `fare_daily(route_key, origin, destination, obs_date, min_price, airline, departure_at, return_at, n_obs, first_seen_at, last_run_id, PRIMARY KEY(route_key, obs_date))` and `route_verdict(route_key, verdict_date, median_price, distinct_days, pct_vs_median, verdict, rule_version, PRIMARY KEY(route_key, verdict_date))`.
- `scripts/data/curate.py`: from each raw run, upsert one row per route and day, keeping the cheapest price of the day (Step 65). One route key format for every origin including JFK (`<ORIGIN>:<display name>`), so JFK has one history, not two.
- Backfill from R2 raw (N1) from the oldest date N0 item 6 found. Report rows per route and the new history depth.
- Writes go through `wrangler d1 execute --remote --file` from Actions with the N0 token, batched.
- **Acceptance:** re-running curate on the same raw is a no-op (idempotent); row count equals distinct route-days in raw; JFK daily and multi-origin observations merge with the cheapest kept; nothing reads these tables yet.

### N10. One ranking job, in shadow (by Sun Nov 1)
- `scripts/data/rank_curated.py` computes verdicts for all origins from `fare_daily` using D-021 exactly (shared constants imported from one module, also used by the old script) and writes shadow serving files with the same names and shapes as today's to `serving-shadow/` in R2, plus `route_verdict` rows.
- Daily shadow diff after each run: per origin, records added or missing, verdict changes, price differences, `pct_below` differences above 0.1 point, and the counts shown on the site. Written to `docs/data/shadow_diffs/` as a short markdown summary (counts only, no raw prices) and summarized in the Monday standup.
- Flag `ENABLE_CURATED_SERVING` (default `"false"`): when on, the Worker and pages read the shadow files instead of the git files. Do not flip it.
- **Acceptance:** golden tests show identical verdicts to the current script on fixture histories; the first five daily diffs are attached to the PR or the approval pack; every difference is explained (expected because the old script used a 30-day trimmed history, or a bug fixed).

### N11. Metrics layer (by Mon Nov 2)
- `src/metrics/definitions.js`: every KPI once (id, label, formula as SQL or function, filters including bot exclusion, unit, dimension, owner decision it serves, minimum sample). Start with: landings, signups, confirmed, confirm rate, landing-to-signup by channel, engaged subscribers (opened in 45 days), outbound clicks by meter and surface (human, tracked era), partner clicks per 100 signups by trip-length bucket (D-004), payouts by meter and tier, data-quality SLO attainment, data incidents.
- Daily cron writes `metrics_daily(date, metric_id, dimension, value, n)`. `/admin/growth`, `/admin/revenue` and the standup read definitions or `metrics_daily` instead of their own SQL; their outputs must not change (test with fixtures).
- Weekly workflow writes `docs/metrics/state_METRICS_auto_YYYY-MM-DD.md` (counts only, with as-of and n), which the Hub copies into the project's `state_METRICS.md` (item 125).
- Gates registry `docs/data/gates.md`: G1 Nov 20, G2 Dec 6, Dec 11 (D-004), Feb 12; metric id, minimum sample, rule.
- **Acceptance:** admin pages and standup show identical numbers before and after on a fixture database; the auto metrics file generates in a test run.

### N12. Tracking plan (by Mon Nov 2)
- `src/events/registry.js`: every event name in use (N0 finds them; the Hub counted about 47), with required fields and a version. `logEvent` accepts only registered names; an unregistered name is logged once as `unregistered_event` with the name in meta, never dropped silently. A test fails if code calls `logEvent` with a name missing from the registry.
- Migration: `events.ua_class` and `events.schema_version` columns, backfilled from meta; queries move from `LIKE` on meta to the column.
- **Acceptance:** all current events register; the standup's bot exclusion gives identical counts using the column.

### N13. Retention and deletion jobs, dark (by Tue Nov 3)
- Monthly job behind `ENABLE_RETENTION_JOBS` (default `"false"`), per section 5.4: events older than 13 months rolled into `events_monthly_agg` then deleted; delivery-log rows 90 days after the last send for that user or trip; personal fields of users 30 days after unsubscribe, sunset or a deletion request, keeping the suppression entry and consent record; trip rows keep counts, user link removed.
- Dry-run mode writes what it would delete (counts by table) to the standup; the first real run waits for the flag flip after the Hub's Guard read of the privacy text (planned Dec 1).
- Draft `/privacy` retention paragraph for the Hub's Guard read.
- **Acceptance:** dry-run counts on a fixture database match hand-computed expectations; with the flag off nothing is deleted.

### N14. Serve from R2, dark (by Wed Nov 4)
- Add the serving file paths to `run_worker_first`; behind `ENABLE_R2_SERVING` (default `"false"`) the Worker serves them from R2 (latest validated version, `cache-control: no-store` as today), else from assets exactly as today. Keep the last 30 serving versions in R2 for rollback.
- The workflows publish validated serving files to R2 in parallel with today's git commit (both paths live; git stays the source until the flip).
- N14b (after Nov 9, separate PR): stop committing data files and snapshots to git once R2 serving has run clean for 7 days; leave existing git history untouched (no history rewrite, no force-push).
- **Acceptance:** with the flag off, responses are byte-identical to today; with the flag on in a preview environment, the board, `/check`, route pages, digest preview and `/api/deals` render identically from R2; rollback is one flag flip.

## 6. What the owner and the Hub do in parallel (awareness, not your tasks)
- Owner: section 4 prerequisites; UTM links for every launch post (N5 table); approval batches.
- Hub: Guard reads of N5's privacy line and N13's retention paragraph; reads the shadow diffs before any flip; drafts the licence register (DR-23) and vendor register (DR-15) in the project by Nov 15; refreshes the ledger by Oct 27; seats the CDO for data-affecting consults (D-041).

## 7. Reply format
- **After N0:** the plan path, answers 1 to 9, the PR order with M, K and J and dates, what you would defer, the owner prerequisites as click steps. Then stop.
- **After each PR:** link, branch, files, framework items closed, tests added, acceptance result, the before and after diff proving nothing visible changed (or the approved change), and the `BUILD_STATE.md` line updated.

## 8. Out of scope
Changing ranking rules or thresholds; any new public data file or download; data licensing, API access or resale; third-party analytics, cookies or fingerprinting; paid tools beyond Workers Paid; new partners or links; flipping any flag before Nov 9; Away Mode Wave 1 flags (D-016); deleting or rewriting git history; any change to Travelpayouts tools.
