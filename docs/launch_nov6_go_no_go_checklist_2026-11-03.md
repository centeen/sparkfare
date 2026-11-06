# Nov 6 final go/no-go checklist (Fri Nov 6, 18:00 ET; announcement Sat Nov 7, 12:01 a.m. PT = 08:01 UTC)

Prepared 2026-11-03 (Claude Code, docs only). It is the short working list for the call; the full commands and the Oct 10 and Oct 13 evidence
stay in `launch_go_no_go_2026-10-16.md` ("the main file"). Nothing here was run: this sandbox cannot reach sparkfare.com, Cloudflare, Resend or
Product Hunt, so every "Result" cell is blank for the owner (or a session with access) to fill in.

**Rules.** The date is the owner's call; a missed gate cuts scope, not the date. A failing non-P0 never blocks launch. A failing P0 (rows 1 or 2)
means the JFK-only board with an honest "more airports this week" note. Three outcomes: **GO**, **GO with reduced scope** (say which), **NO-GO for
a P0 fix**. Merge freeze: Nov 6 18:00 ET to Nov 8, only a P0 fix or a flag set to its safe value. Cloudflare deploys `main` on every merge.

## Status as of 2026-11-06 (Claude Code, read-only checks; owner's screenshots, phone test and Product Hunt read)

Both P0 rows pass as of 10:09 UTC. Merged today: #494 (llms.txt test), #495 (30 guides' meta text, Hub Read 2), #496 and #497 (results sheet), #498 (BUILD_STATE). Open: #499 (launch-post UTM links, docs). Still owner or Hub: row 14 (post scheduling, second-wave dates), the Hub's Read 3 (CC BY wording, Mon Nov 9 to 10), the decision. Row detail and evidence: `docs/launch_nov6_results_sheet_2026-11-04.md`. Found and fixed today: `EMAIL_POSTAL_ADDRESS` held the email address (then briefly the admin secret, rotated); now the real postal address.

## Status as of 2026-11-04

Merged and no longer open: S-copy B and C, Guard A and B (#466, #467), #418, #454, and #483 (CC BY flag). No other PRs were open at the Nov 3 check; draft #482 (`ENABLE_REPORTS` for Nov 11) stays a draft.

## Corrections to the main file (its flag list is stale; trust `wrangler.jsonc` on `main`)

- `ENABLE_LONG_LEAVE` is **`"false"`** (set back off 2026-10-15, D-006). The main file's "ON (2026-10-13)" line and its `30+ days` / `/api/long-leave` checks no longer apply.
- Partner count is **13 live or fewer** (SafetyWing off since 2026-10-13; Petcube hidden again by migration 0030, D-032). Read the count from `/api/partners`, do not expect 14.
- The main file's "same-speed free tier" and PH tagline lines are from October; re-read the listing as a visitor would instead.
- Five cron triggers now (`30 3`, `0 8`, `30 9`, `0 9 * * 2`, `30 * * * *`): confirm the account is on Workers Paid (the free plan allows 5 per account and has a 100,000 requests a day cap).

## Part A: due before the call (Tue to Thu)

| Done | Item | Owner | Deadline |
|---|---|---|---|
| [x] | Live pages: `/time-off/embed` shows the Guard line, no "National federal holidays"; `/check` on an untracked route shows no alert card, a tracked route still does | owner | Wed Nov 4 |
| [x] | S1 live test: three `+s1test` aliases with `utm_medium` `post`, `email`, `junk` store `post`, `email`, `other` and tag `x_s1test`; delete the test rows (child rows first) | owner | Wed Nov 4 |
| [x] | Hub Guard read of the live vacancy post and all 40 destination guides (none has an "On the ground" section now; see `claude/hub_guard_read_request_2026-11-04.md`) | Hub | Wed Nov 4 |
| | **Result (Hub, Nov 6, not a launch gate):** vacancy post CONDITIONAL, no change needed (quoted text not on the live page); guides CONDITIONAL, fixed in #495 (30 priced guides' meta/og, live, 40 of 40 checked); CC BY wording CONDITIONAL, edit due Mon Nov 9 to 10 | | |
| [x] | Resend: webhook enabled and subscribed to `email.delivered`, bounced, complained (and `email.opened`); recent deliveries 200; read Settings, Usage for the per-second limit and daily cap | owner | Wed Nov 4 |
| [x] | First digest footer shows the postal address; no `email_blocked_no_postal_address` events | owner | after the next 07:00 or 08:00 UTC send |
| [ ] | Travelpayouts CC BY: if no reply by Wed Nov 4, send `docs/travelpayouts_cc_by_followup_draft_2026-11-02.md`. **Update 2026-11-04: the written yes arrived Nov 3 and PR #483 (flips `ENABLE_REPORT_CC_BY` to `"true"`) is merged, so the follow-up is not needed.** Still open: the Hub's Guard read of the licence wording before `ENABLE_REPORTS` flips Nov 11 | owner / Hub | Nov 9 to 10 |
| [x] | Last merges done by **Wed Nov 4**; anything unmerged by Thu Nov 5 18:00 ET waits until Nov 9 | all | Nov 4 / Nov 5 |
| [x] | Housekeeping: delete the stray remote branch `docs/build-state-nov2` | owner | any time |
| [ ] | No press pitches Nov 3 to 6 (US election); the embargo preview goes Mon Nov 9; `ENABLE_REPORTS` stays `"false"` through launch | owner | standing |

## Part B: the decision table (run Fri Nov 6, about 14:00 ET; fill in, then decide at 18:00)

Commands for each check are in the main file; the check name is in the first column.

| # | Check | Priority | Pass means | Result |
|---|---|---|---|---|
| 1 | Original 12 origins (JFK LAX ORD ATL DFW SFO MIA IAD EWR SEA IAH BOS), main file Check 1 | **P0** | each about 10 or more priced routes; both ranked-deals files' `generated_at` within about 36 h. Oct 16 baseline: all 12 at 17 or more of 40 | PASS (re-run 10:09 UTC). Priced: JFK 31, LAX 24, ORD 26, ATL 19, DFW 21, SFO 22, MIA 23, IAD 20, EWR 31, SEA 15, IAH 14, BOS 19. Other-origins file 0.1 h old; JFK file 23.3 h old (daily fetch due about 10:50 UTC) |
| 1b | 10 newer origins, Check 1b | gate | present in the file; selecting a thin one shows "Building history", never JFK's board, no deal badge | PARTIAL. LAS sample shows "Building history"; not each origin |
| 2 | Away Mode, Check 2 | **P0** | `/api/partners` returns 13 (or the count you expect), 0 empty blurbs, `/away-mode` 200, `/out/bounce` 302; no Petcube | PASS. 13 partners, 0 empty blurbs, `/away-mode` 200, `/out/bounce` 302 to Bounce, `/out/petcube` 403 |
| 2b | No SafetyWing anywhere (Check 2b), including `/disclosure` | gate | `/out/safetywing` 302 to `/away-mode`; not in `/api/partners`, blog posts or emails | PASS. Absent from `/away-mode`, `/disclosure`, `/api/partners`; `/out/safetywing` 302 to `/away-mode` |
| 2c | Launch-source tags stored with a signup (Check 2c; S1 adds `utm_medium`) | gate | a tagged signup stores its tag | PASS. Channel, campaign and `utm_medium` stored (M1 and S1 tests, D1) |
| 2d | Cloudflare analytics beacon present on the main page types | gate | beacon on `/`, `/check`, a blog post, a route page | PASS. Loads on `/`, `/check`, a blog post, a route page (real browser) |
| 2e | No banned copy: "real-time", "live prices", insurance-sale copy, "book*", "secure", urgency words | gate | `node scripts/check-referral-copy.js` passes; spot-check live pages | PASS on the repo (`check-referral-copy.js` passes, 1,046 files). Live spot-check not done |
| 3 | Count claim: "880 routes from 22 major hubs" | gate | 880 US records in the ranked-deals files (TLV excluded) on the day; Oct 16 data held 828 before, so re-count | PASS. 920 records, 40 TLV, so 880 US |
| 4 | Signup end to end with a `+alias` (not a real subscriber) | gate | verification email arrives; link works; tag stored; referral prompt shows (names the 3-referral watchlist tier) | PARTIAL. Email arrived, link worked, tag stored, `email_verified` logged (3 tests). Referral prompt not seen |
| 5 | `/check` and its share image | gate | real route answers with basis; `/og/check/*` image loads (`ENABLE_SHARE_IMAGE` is on) | PASS. `/check` 200; `/og/check/JFK/Lisbon%2C%20Portugal.png?p=700` 200 `image/png` |
| 6 | Analytics events, Check 6 | gate | `outbound_click`, `route_promoted`, `alert_email_sent` recent; `email_open` after a digest | PASS. Last 2 days: `outbound_click` 77, `route_promoted` 11, `alert_email_sent` 4, `email_open` 22 |
| 7 | Email deliverability, Check 7 | gate | digest in Inbox with both unsubscribe headers and SPF, DKIM, DMARC pass; DMARC still `p=quarantine`; breaker not tripped; webhook 200s | PASS. Test digest headers read by owner: SPF, DKIM, DMARC pass; signed `List-Unsubscribe` and one-click POST present; DMARC `p=quarantine`. The 08:00 UTC digest not inspected |
| 8 | Route pages, Check 10 | gate | sitemap a few hundred URLs, no TLV or `undefined`; thin route 404; new-origin pSEO page 200 | PASS. `sitemap.xml` 966 and `sitemap-routes.xml` 365 URLs, no TLV or `undefined`; thin route 404; DTW and AUS pSEO pages 200 |
| 9 | PTO planner, Check 11 | non-P0 | `/time-off` 200, `/jfk` 200, `/phl` 200, `/tlv` 404; fares flag off (8 "Fares appear here", 0 "No fare seen yet") | PASS. `/time-off` 200, `/jfk` 200, `/phl` 200, `/tlv` 404 |
| 10 | Pipelines on time, Check 12 | gate | recent runs `success`; hourly under about 40 min; daily fetch within about 30 h; 07:10 compile ran; `daily-social-post` ran | PARTIAL. All recent runs success, but the 01:37 UTC hourly run took 1 h 17 min and the next started 09:30 UTC; daily fetch starts about 10:50 UTC (not 03:17); social post ran 21:06 UTC Nov 5. GitHub scheduling delay |
| 11 | Capacity | gate | Workers Paid confirmed in the dashboard; five cron triggers registered; request headroom for a spike | PASS on allowances. Dashboard (Oct 13 to Nov 13): 38.87k of 10M requests, 226.54k of 30M CPU ms, 1.23k of 6k build minutes, $0.00 billable; plan name not shown. Five crons in `wrangler.jsonc` |
| 12 | Phone QA on a real phone over mobile data (list in the main file) | gate | no awkward step; re-do if the site changed since Oct 16 | PASS. Owner on a real phone ("everything worked perfectly"); emulated 375 px pass: no overflow on five key pages |
| 13 | Product Hunt: open "View launch" as a visitor; images, links, first comment, scheduled for Sat Nov 7 12:01 a.m. PT | gate | reads correctly; links go where the copy says | PASS. Name, tagline, maker comment, gallery match; countdown consistent with 08:01 UTC; description reworded; primary link `?utm_source=producthunt&utm_medium=post&utm_campaign=launch_nov7`; shoutouts added; category as is; no video |
| 14 | One-time launch posts (X, Bluesky, then later Show HN, Indie Hackers, Reddit) scheduled; later dates set at this call | gate | owner confirms | OPEN (owner). Launch-day X and Bluesky post for 08:01 UTC and the second-wave dates not yet confirmed |
| 15 | Step 12 (revenue health monitor and weekly standup) still sending; step 49 `/check` live | non-P0 | last weekly standup arrived (Mondays 09:00 UTC) | PASS. Last weekly standup Mon Nov 2 09:00 UTC |

## Part C: flags, read from `wrangler.jsonc` on `main` as of 2026-11-03 (re-read on Nov 6; observe behavior, not the flag alone)

**Re-read 2026-11-06 on `main` (`614be998` plus #498): all 26 "must be false" flags are `"false"`, all 23 "expected true" flags are `"true"`, `RETENTION_DRY_RUN` is `"true"`, `PINTEREST_ENV` is `"sandbox"`.** (Flag values only; behaviour was checked for the rows above.)

**Must be `"false"` at launch:** `ENABLE_REPORTS`, `ENABLE_T5B_ADS`, `ENABLE_X_BROADCASTER`, `ENABLE_T7B_PUSH`, `ENABLE_PTO_FARES`,
`ENABLE_PTO_DIGEST_BLOCK`, `ENABLE_TRIP_SELF_REPORT`, `ENABLE_FARE_ROUTING`, `ENABLE_LONG_LEAVE`, `ENABLE_LEAVE_BY_PLAN`, `ENABLE_RULE_WATCHER`,
`ENABLE_PASSPORT_CHECK`, `ENABLE_PLAN_REMINDERS`, `ENABLE_HOME_CARD`, `ENABLE_SIGNUP_FREQUENCY`, `ENABLE_SIGNED_PREFS`, `ENABLE_TRIP_STREAM_V2`,
`ENABLE_LIFECYCLE_V2`, `ENABLE_CARE_EMAIL`, `ENABLE_EMAIL_CLICK_RECORDING`, `ENABLE_WELCOME_EMAIL`, `ENABLE_LOCAL_MORNING_SEND`, `ENABLE_RETENTION_JOBS`,
`ENABLE_R2_SERVING`, `ENABLE_CURATED_SERVING`, `ENABLE_SUNDAY_NEWSLETTER`. (`RETENTION_DRY_RUN` is `"true"`.) All were `"false"` in the file today.

**Expected `"true"`:** `ENABLE_REPORT_CC_BY` (set 2026-11-03, #483; no visible effect while `ENABLE_REPORTS` is false), `ENABLE_DAILY_DIGEST`, `ENABLE_EMAIL_V2`, `ENABLE_EMAIL_CHECKLIST_V2`, `ENABLE_DIGEST_SKIP_UNCHANGED`, `ENABLE_DIGEST_ARCHIVE` (and `_WRITE`),
`ENABLE_PRICE_CHECK`, `ENABLE_SHARE_IMAGE`, `ENABLE_T3_REFERRALS`, `ENABLE_REFERRAL_PROMPT`, `ENABLE_PLUS_WAITLIST`, `ENABLE_ORIGIN_REQUESTS`, `ENABLE_LEAVE_READY`,
`ENABLE_T2B_SEQUENCE`, `ENABLE_PTO_CALENDAR`, `ENABLE_PTO_WATCH`, `ENABLE_METER_TRACKING`, `ENABLE_WEEKLY_STANDUP`, `ENABLE_LANDING_COUNTER`, `ENABLE_DATA_ALERTS`,
`ENABLE_ROW_ALERT_CARD`, `ENABLE_PINTEREST` (`PINTEREST_ENV` is `"sandbox"`, admin-only, no public surface).

## Part D: after the call

1. Write the decision, who made it, the time and any reduced scope as a dated `DECISION` in `state_DECISION_LOG.md`, and update `ROADMAP.md` Phase 0, in the same commit.
2. Set the Show HN, Indie Hackers and Reddit dates (a few days after Nov 7).
3. Add a `BUILD_STATE.md` row.

## Launch weekend watch list (Nov 7 to 8)

- **Email breaker:** `SENDING_GUARD` in `src/email.js` (7-day window): below 200 sends the guard does not trip on rates; from 200 sends, a bounce rate above 5% or a complaint rate above 0.3% pauses all guarded email. Check counts Sat and Sun evening (Check 7 query).
- **Signup abuse:** bursts from one source; real verification emails still sending.
- **Data freshness:** daily fetch started, 07:10 compile ran, 08:00 digest used same-day data; the 08:00 health email goes to hello@sparkfare.com if a file is stale.
- **Hourly run length** creeping toward the 60 min timeout; **route and `/data/` pages** not 5xx under load.
- **A wrong public claim:** suspend the relevant flag (kill switches: `ENABLE_DAILY_DIGEST` or `ENABLE_PTO_WATCH` to the exact string `"false"`, merge, about 1 to 2 minutes) and review `dealQuality`.
- **Known and accepted:** "Search data retrieved" is the fetch time, not the fare's observation time; a shown deal can already be gone from Aviasales (R1a added "Price can differ on Aviasales").
- No copy or wording PRs merge between the call and Mon Nov 9.
