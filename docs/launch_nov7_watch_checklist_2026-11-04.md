# Nov 7 launch watch checklist (Fri Nov 6 evening to Mon Nov 9 morning)

Drafted 2026-11-04, docs only; nothing here was run (the drafting sandbox cannot reach sparkfare.com, Cloudflare or Resend). A time-ordered plan on top of `launch_week_runbook.md` (daily routine, break/fix, rollbacks) and the "Launch weekend watch list" in `docs/launch_nov6_go_no_go_checklist_2026-11-03.md`. Fill in the Seen column as you go.

**Announcement: Sat Nov 7, 12:01 a.m. PT = 08:01 UTC = 03:01 a.m. ET** (US standard time since Nov 1).

## Rules for the weekend
- **Merge freeze Nov 6 18:00 ET to Nov 8.** Only a P0 fix or a flag set to its safe value. Merging deploys `main` in about 1 to 2 minutes; wait for each deploy before the next merge.
- **Never click fare or partner links on production, and never email real subscribers, to test.** Use your own `+alias`.
- **Do not bypass the email sending guard.** Find the cause first.
- On Windows use `node node_modules/wrangler/bin/wrangler.js`, not `npx wrangler`. `$ADMIN_SECRET` is the Worker admin secret you hold.

## Two corrections to `launch_week_runbook.md` (not edited yet)
1. **Launch time.** Line 23 says the announcement is 07:01 UTC and lands "one minute after the 07:00 early digest". On standard time, 12:01 a.m. PT is **08:01 UTC**. The Nov 3 checklist lists five crons (`30 3`, `0 8`, `30 9`, `0 9 * * 2`, `30 *`) and no `0 7`, so the general digest at 08:00 UTC lands **one minute before** the announcement. Confirm the registered crons in the dashboard (Worker, Settings, Triggers).
2. **Guard thresholds.** Section 3 quotes "10 bounces or 3 complaints below 100 sends, or 5% / 0.3% at 100+". The code (`SENDING_GUARD`, `src/email.js`) never trips below **200 sends** in the 7-day window; from 200 it trips above 5% bounce or 0.3% complaint rate. Event names are `email_bounce` and `email_complaint`.

## Fri Nov 6, after the go decision
| Done | Item | Seen |
|---|---|---|
| [ ] | Go/no-go decision recorded (`state_DECISION_LOG.md`, `ROADMAP.md` Phase 0), scope cuts noted | |
| [ ] | `main` commit ___ matches the latest Cloudflare deploy; no PR left mid-merge | |
| [ ] | Product Hunt scheduled for Sat Nov 7, 12:01 a.m. PT; first comment and links read as a visitor | |
| [ ] | Run the health check once: `curl -s -X POST -H "Authorization: Bearer $ADMIN_SECRET" https://sparkfare.com/api/check-revenue-health` (healthy true, file ages under limits, `emailGuard.tripped` false) | |
| [ ] | Baseline snapshot, so Saturday has something to compare to: users ___, signups last 24 h ___, Workers requests last 24 h ___, sends last 7 days ___ | |
| [ ] | Phone and notifications set so a hello@sparkfare.com alert reaches you overnight | |

## Sat Nov 7: launch day
| When (ET) | What to check | Seen |
|---|---|---|
| 03:00 (08:00 UTC) | The general digest ran: events `alert_email_sent` recent; `daily_alert_deliveries` has today's rows; no error in the health email | |
| 03:01 | Announcement live on Product Hunt (visible as a visitor); X and Bluesky posts out | |
| about 03:30 | `https://sparkfare.com/api/health`; homepage, `/check` and one route page load; no 5xx | |
| +1 h, +3 h, +6 h | Run the **pulse** below each time and write the numbers here | |
| 09:17 (14:17 UTC) | Daily Bluesky/Mastodon post ran (`gh run list --workflow daily-social-post.yml --limit 2`) and did not clash with the launch post | |
| evening | Resend dashboard: bounce and complaint rate for the day; guard counts (query below) | |
| evening | Cloudflare dashboard: Worker request count against the plan; error rate; D1 rows written | |

### The pulse (about 3 minutes)
1. **Site up:** `curl -s https://sparkfare.com/api/health`; load `/` and `/check`.
2. **Events since launch** (counts only):
```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "SELECT event_type, COUNT(*) n FROM events WHERE ts > '2026-11-07 08:01:00' GROUP BY event_type ORDER BY n DESC"
```
3. **Signups and where they came from:** `/admin/growth` (admin secret, counts only). Check the tags you posted with (`utm_source`) show up; an untagged link reads `direct`.
4. **Email guard counts:**
```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "SELECT event_type, COUNT(*) n FROM events WHERE event_type IN ('alert_email_sent','email_bounce','email_complaint') AND ts > datetime('now','-7 day') GROUP BY event_type"
```
A missing row means zero.
5. **Verification emails still sending:** one signup with a `+alias`, read the email, delete the test rows after. Do this once, not every pulse.

| Pulse | Time | Site | Signups | Top event types | Bounces / complaints | Notes |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

## Sun Nov 8
| Done | Item | Seen |
|---|---|---|
| [ ] | Morning routine from the runbook, section 2 (health check, workflows, site, inbox, Resend, events, Cloudflare) | |
| [ ] | 03:17 UTC fetch and the 08:00 UTC digest ran; `daily-fetch` started near its slot; ranked-deals files' `generated_at` within about 36 h | |
| [ ] | Hourly run length well under the 60 minute timeout (`gh run list --workflow hourly-multi-origin-fetch.yml --limit 5`) | |
| [ ] | The Sunday newsletter flag `ENABLE_SUNDAY_NEWSLETTER` is `"false"`, so nothing should send; confirm none did | |
| [ ] | Evening: same pulse once; guard counts | |

## Mon Nov 9 morning
| Done | Item | Seen |
|---|---|---|
| [ ] | Weekend summary: signups ___, confirmed ___, `/check` runs ___, outbound clicks (bots excluded) ___, bounces ___, complaints ___ | |
| [ ] | Weekly standup email arrives after 09:00 UTC (cron `0 9 * * 2`; Cloudflare counts 1 as Sunday, so 2 is Monday, fixed 2026-10-13) | |
| [ ] | Freeze is over: held PRs may merge one at a time (embargo press preview, copy PRs, #482 stays a draft until Nov 11) | |
| [ ] | Set the Show HN, Indie Hackers and Reddit dates; add a `BUILD_STATE.md` row with what happened | |

## What to do if something goes wrong
| Symptom | First move | Safe switch / action |
|---|---|---|
| Site 5xx or Cloudflare 1101 | `wrangler tail --format pretty` while reproducing | Roll back the deploy (revert the PR, or dashboard Deployments, or `wrangler rollback`). D1 migrations are not rolled back |
| Email guard tripped (health email, or `emailGuard.tripped`) | Read the counts and the Resend dashboard for the cause | Do not bypass; it clears itself as the 7-day window improves. Pause optional sends if you must |
| Wrong or stale deal reported | Check the file's `generated_at` and the route's `basis_text` | `ENABLE_DAILY_DIGEST` to the exact string `"false"` stops the digest; review `dealQuality` |
| Signup abuse (bursts from one source) | Look at `signup` events by source and time | Rate-limit or disable the form at the edge; do not delete real signups |
| Data file stale | `gh run list` for the owning workflow | Safe to re-run by hand: `gh workflow run daily-fetch.yml` |
| Request count near the Workers limit | Cloudflare dashboard, Workers | Confirm Workers Paid is active; static pages and JSON files do not count |
| Press or a partner asks about the CC BY report | It is not live: `ENABLE_REPORTS` stays `"false"` until Nov 11 | Do not flip it during the freeze |

Known and accepted: "Search data retrieved" is the fetch time, not each fare's own observation time; a shown deal can already be gone from Aviasales ("Price can differ on Aviasales" is on the card); the ten newest airports show "Building history" and DEN, PHX and LAS are thin. Treat anonymous `outbound_click` and any `/go/` click as unreliable; signups, `check_run` and `email_open` are the better launch signals (runbook section 6).
