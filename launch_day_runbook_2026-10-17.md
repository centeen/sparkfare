# Launch-day runbook: Saturday Oct 17, 2026 (Product Hunt, 12:01 a.m. PT)

Prepared 2026-10-13 from the repo, `launch_go_no_go_2026-10-16.md`, `launch_week_runbook.md`, `launch_posts_draft_2026-10-08.md`
and read-only checks of production. This is the **hour-by-hour sequence**; `launch_week_runbook.md` is the ops reference
(what runs when, what to do when X breaks) and is not repeated here. No secrets are in this file: `$ADMIN_SECRET` is the
Worker secret only the owner holds. Items marked **(unverified)** have not been observed.

**Time conversions (October, daylight time):** 12:01 a.m. PT = **07:01 UTC** = 3:01 a.m. ET. Go/no-go 18:00 ET Oct 16 = **22:00 UTC**.

## 0. Rules for the window
- **Change freeze: Oct 16 18:00 ET to Mon Oct 19.** Nothing merges without the owner's say-so. Auto-deploy ships a merge in
  1 to 2 minutes, so a "small copy fix" goes live immediately. Held drafts: #155, #157, #173 (merge Oct 19 or later).
- **The date does not move.** A failing P0 (deals or Away Mode) means the JFK-only board with a "more airports this week" note.
- **Do not run any manual send** to a real address. Use a `+alias` of your own.
- **Do not turn on `ENABLE_FARE_ROUTING`** or any other flag during launch weekend (it adds a redirect hop to every fare link).

## 1. Friday Oct 16: before the call
| ET | Task | Where |
|---|---|---|
| ~13:00 | Confirm the Cloudflare plan (Workers Free caps at 100,000 requests a day; `/api/*`, `/check`, `/out/*`, `/flight/*`, `/hub` count, static files do not). If Free, decide whether to move to Paid for launch weekend | Cloudflare dashboard (unverified which plan) |
| ~14:00 | Run every check in `launch_go_no_go_2026-10-16.md` and fill its "Oct 16 result" column | that file |
| ~14:30 | Resend dashboard: webhook enabled, subscribed to `email.opened`, `email.bounced`, `email.complained`, recent deliveries 200 | Resend |
| ~15:00 | **Real-phone QA** (about 20 minutes, the eight steps in `go_no_go_scorecard.md`) | your phone |
| ~15:30 | Confirm `ENABLE_PINTEREST` is meant to be on (flagged in the Oct 13 walk) | `wrangler.jsonc` |
| ~16:00 | Decide: the "22 major hubs" homepage line (the 10 newer origins have about 5% of routes priced); DMARC left at `p=none` or `quarantine`. If the line changes, `tests/homepage_hub_count.test.js` changes with it, and that is a merge before 18:00 | `launch_call_record_2026-10-16.md` |
| ~17:00 | Tag check: open `https://sparkfare.com/?utm_source=producthunt&utm_medium=launch&utm_campaign=launch`, sign up with a throwaway address, confirm the signup carries `producthunt_launch` | `launch_posts_draft` links table |
| 18:00 | **Go/no-go call.** Fill `launch_call_record_2026-10-16.md`, paste the decision block into `state_DECISION_LOG.md`, update `ROADMAP.md` Phase 0 | |
| evening | Product Hunt: schedule the listing for 12:01 a.m. PT, paste the first comment, upload the gallery (a `/check` result, one deal card, the "Building history" state) | Product Hunt |

## 2. Friday night to Saturday morning (UTC)
| UTC | What happens by itself | What you do |
|---|---|---|
| 03:17 | JFK fetch is *scheduled*; in practice it has started 7 to 10 hours late for two weeks (about 10:30 to 11:00 UTC) | Nothing. Expect the 07:00 and 08:00 digests to use the previous day's JFK file |
| 07:00 | Early-access digest (Early Bird referral recipients) | |
| **07:01** | **Product Hunt goes live** | Post the maker comment, then post the X / Bluesky line (section 5 of the posts draft, X-tagged link) |
| 08:00 | General digest, bookings reconcile, watchlists, lifecycle emails, health check (emails you only on a problem) | |
| :23 each hour | Hourly multi-origin fetch (about 33 minutes a run, gaps of several hours are normal) | |
| 14:17 | Bluesky and Mastodon daily post runs and **posts publicly** | Decide beforehand: leave it, or `gh workflow disable "Sparkfare Daily Social Post"` so it does not land next to your own launch post |

## 3. Launch-day watch (check every 1 to 2 hours for the first 6, then at the end of the day)
1. **Site up:** `curl -s https://sparkfare.com/api/health`, then load `/`, `/check`, `/away-mode`.
2. **Health check by hand** (shows file ages and the email guard even when healthy):
   `curl -s -X POST -H "Authorization: Bearer $ADMIN_SECRET" https://sparkfare.com/api/check-revenue-health`
   Expect `"healthy": true`, `emailGuard.tripped` false.
3. **Events since launch** (note `wrangler d1 execute` must be `node node_modules/wrangler/bin/wrangler.js ...` on this machine; retry on Cloudflare error 7403):
   `SELECT event_type, count(*) n FROM events WHERE ts > '2026-10-17 07:00:00' GROUP BY event_type ORDER BY n DESC`
4. **Signups by source:** the tags are `producthunt_launch`, `x_launch`. Only signups carry a tag; a click that does not sign up records nothing.
5. **Real-user clicks:** since Oct 7, `outbound_click` stores `meta.ua_class` and, since Oct 13, meter / category / trip-length bucket. Count `ua_class != 'bot'`; treat anonymous raw counts as unreliable.
6. **Cloudflare:** request count against the plan limit, and the error rate.
7. **Resend:** bounces and complaints. The guard trips at 10 bounces or 3 complaints in 7 days below 100 sends, and then **every guarded email is skipped** (it self-clears as the window improves).
8. **Inbox hello@sparkfare.com** and the Product Hunt comments. Reply to every comment in the first hours.

## 4. If something breaks
| Symptom | First move | Fast relief |
|---|---|---|
| Worker error 1101 or a route 5xx | `node node_modules/wrangler/bin/wrangler.js tail --format pretty` while reproducing | Roll back: revert the PR on GitHub (auto-deploys), or `wrangler rollback`. D1 migrations are not rolled back |
| Worker routes failing past a request cap | Cloudflare dashboard shows 429 / limit errors | Move to the Paid plan; static pages keep working meanwhile |
| Digest wrong or unwanted | Check the file's `generated_at` | `"ENABLE_DAILY_DIGEST": "false"` in `wrangler.jsonc` and merge (stops 07:00 and 08:00 runs only) |
| Email guard tripped | Read `emailGuard` in the health JSON, then Resend for the cause | Do not bypass it; it self-clears |
| A published price or claim is wrong | Check `basis_text` and `found_at` on the record | Pause the source workflow; explain in the thread, do not edit quietly |
| Stale data on origin X | `gh run list --limit 15`, find the failed workflow | `gh workflow run daily-fetch.yml` (no inputs) |
| Sign-in broken | Clerk production instance, "Email verification code" under both sign-up and sign-in | |
| A merge is needed during the freeze | Only for a P0 or a wrong claim; owner approves in chat | Merge, then re-run section 3, items 1 and 2 |

## 5. Sunday Oct 18
- **14:00 UTC** Sunday newsletter workflow (GitHub; may start late). It really sends to subscribers.
- Re-run section 3. Compare signup count and `ua_class != 'bot'` clicks with Saturday.
- Do not merge anything yet.

## 6. Monday Oct 19 (freeze ends)
1. **09:00 UTC:** the weekly standup email (first one on the real Monday cron) and the affiliate link-health check.
2. Merge #155 and #157 (wording: "Fare data retrieved", neutral "View fare") and confirm on the live site; #173 only after a verified same-speed run.
3. Re-read numbers in the Oct 20 posts against the live homepage line.

## 7. Tuesday Oct 20: second wave (owner)
Show HN, Reddit (one tailored post per community, read each community's rules that day), Indie Hackers. Tagged links are in the posts draft. Be available for the first few hours. If a post is removed, do not repost elsewhere.
Log every post URL and outcome in `state_DECISION_LOG.md`.

## 8. The two-week clock
`ENABLE_METER_TRACKING` was switched on 2026-10-13. Task D (first revenue readout, `task_d_first_readout_2026-10-13.md`)
unlocks after **Oct 27**, once last month's partner payouts are entered through `POST /admin/payouts`.

## Open decisions to settle before Friday 18:00 ET
1. Leave the 14:17 UTC social post on, or pause it for launch day.
2. Keep or soften "22 major hubs".
3. DMARC `quarantine` now or after launch.
4. Workers Free vs Paid.
5. `ENABLE_PINTEREST` on or off.
6. ~~Which Product Hunt tagline~~ **Decided 2026-10-13 (owner):** `Check if a flight price is good, against its own history.` (57 characters). The site's header tagline is unchanged.
