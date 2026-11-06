# Nov 6 go/no-go results sheet (fill in Fri Nov 6, about 14:00 ET; decide at 18:00 ET)

Companion to `docs/launch_nov6_go_no_go_checklist_2026-11-03.md` (the check names and rules) and `launch_go_no_go_2026-10-16.md` (the commands). Drafted 2026-11-04, docs only; **Result cells were first filled Fri Nov 6 about 04:30 to 05:00 ET (08:30 to 09:00 UTC) by Claude Code, read-only, from production** (curl, a real browser, read-only D1 queries, `gh`), with the Resend dashboard read by the owner from screenshots. A blank means not checked. Initials are blank for the owner.

Fill in: **Result** = PASS / FAIL / N/A plus the number or error seen (not just a tick). **Time** = when you ran it (ET). Anything that FAILs gets a line under "Failures".

## Corrections to the 2026-11-03 checklist (trust these, then update that file)

1. **`ENABLE_REPORT_CC_BY` is now `"true"`** (PR #483 merged 2026-11-03 after Travelpayouts' written yes). Part C of the checklist lists it under "must be false": move it to "expected true". It has no visible effect while `ENABLE_REPORTS` is `"false"`, which must stay false through launch.
2. **Sending guard thresholds in the code are** 7-day window, **minimum 200 sends**, bounce rate above 5%, complaint rate above 0.3% (`SENDING_GUARD` in `src/email.js`). The checklist's watch list still quotes "under 100 sends, 10 bounces or 3 complaints". Trust the code.
3. **Destination guides with no "On the ground" section: all 40, not 19.** The Hub's read request (`claude/hub_guard_read_request_2026-11-04.md`) already says so.
4. **Merged and no longer open:** S-copy B and C, Guard A and B (#466, #467), #418, #454. No PRs were open at the Nov 3 check.

## Header

| Field | Value |
|---|---|
| Date and time of the run (ET) | Fri Nov 6, about 04:30 to 05:00 (08:30 to 09:00 UTC) |
| Run by | Claude Code (read-only); Resend dashboard read by the owner |
| `main` commit at the start | `4b662ca8` (#494); #495 open, not merged |
| Latest Cloudflare deploy matches that commit? (dashboard, Deployments) | Not checked. Latest deployment 07:05 UTC was a secret change (`EMAIL_POSTAL_ADDRESS`, then `ADMIN_SECRET` rotation) |
| Any merge since the last check? | #494 only (a test; no site change) |

## Part A: due before the call

| Done | Item | Result / evidence | Initials |
|---|---|---|---|
| [x] | Live pages: `/time-off/embed` shows the Guard line, no "National federal holidays" | PASS. Sub-line: "2027 long weekends, built from seven default holidays (listed below). Choose your own on any airport page."; "National federal holidays" appears 0 times | |
| [x] | `/check` untracked route: no alert card; tracked route: card still shows | PASS in a real browser. JFK to Lisbon (tracked): card shown, heading "Want fare alerts from your home airport?". JFK to Nowhere (untracked): "We don't track Nowhere yet.", card hidden | |
| [x] | S1 test: `post`, `email`, `other` stored, tag `x_s1test`; test rows deleted | PASS. Sent `post`, `email`, `banner`; stored `post`, `email`, `other`; tag `x_s1test`, source `check`. Checked in D1 (not `/admin/growth`). 3 test users and their events deleted | |
| [x] | Hub Guard read 1 (vacancy post) | CONDITIONAL (Hub, Nov 6, not a gate). The quoted "30- to 60-day peril exclusions" is not on the live page; live meta already reads "Understanding unoccupied and vacant definitions, limits some policies set on long absences, inspection clauses, and questions to ask your insurance agent." No change needed | |
| [ ] | Hub Guard read 2 (destination guides) | CONDITIONAL (Hub, Nov 6, not a gate). Real miss: 30 priced guides' meta/og still said "On-the-ground notes". Fix is PR #495 (open, awaiting owner approval at head `fa80a9eb`) | |
| [ ] | Hub Guard read 3 (CC BY wording; may wait to Nov 9 to 10) | CONDITIONAL (Hub, Nov 6). Edit before Nov 11: "The CSV files on this page may be reused under CC BY 4.0. Attribution: Sparkfare (sparkfare.com), as of {date and time} UTC." Waits for Mon Nov 9 to Tue Nov 10 | |
| [x] | Resend webhook subscribed to delivered, bounced, complained, opened; recent deliveries 200 | PASS (owner screenshot). Listening: delivered, opened, plus clicked, bounced, complained; Enabled; all recent events Success, HTTP 200 `{"ok":true}`, 1 attempt | |
| [ ] | Resend limits read: per-second ___ ; daily cap ___ ; expected launch-weekend volume ___ | Free plan: daily cap 100 (12 used at about 10:35 Israel), monthly 3,000 (15 used). Per-second: 10 requests per second per team (Resend docs, read Nov 6; 429 above that). Daily quota is a UTC day, resets 00:00 UTC (02:00 Israel); sent and received both count. Expected volume: owner. Tripwire (D-074): upgrade at 60 of 100 | |
| [x] | Digest footer shows the postal address; `email_blocked_no_postal_address` count in the last 2 days = ___ | PASS on a test digest email (07:14 UTC): footer shows the real postal address. Blocked count: 0 (none ever). The 08:00 UTC digest itself not yet inspected. **Found and fixed today:** the secret held the email address, then briefly the admin secret (one test email; rotated) | |
| [x] | Last merges done by Wed Nov 4 (anything later waits until Nov 9) | PASS. Only #494 (a test, no site change) merged since. #495 is open | |
| [x] | Branch `docs/build-state-nov2` deleted | DONE. Deleted from the remote Nov 6; its only commit was already on `main` (last commit `1d036fc2`) | |
| [ ] | No press pitches Nov 3 to 6 | | |

## Part B: decision table

| # | Check | Priority | Result (PASS / FAIL + number) | Time | Notes |
|---|---|---|---|---|---|
| 1 | Original 12 origins: priced routes per origin ___ (each about 10+); `generated_at` of both ranked-deals files within about 36 h: JFK file ___ , other-origins file ___ | **P0** | PASS. Priced per origin: JFK 31, LAX 24, ORD 26, ATL 19, DFW 21, SFO 22, MIA 23, IAD 20, EWR 30, SEA 15, IAH 13, BOS 19. JFK file 21.8 h old, other-origins file 5.7 h old (both inside 36 h) | | |
| 2 | Away Mode: `/api/partners` count ___ (expect 13), empty blurbs ___ (0), `/away-mode` ___ , `/out/bounce` ___ (302), Petcube absent | **P0** | PASS. `/api/partners` 13, empty blurbs 0, `/away-mode` 200, `/out/bounce` 302 to Bounce, `/out/petcube` 403, Petcube absent | | |
| 1b | 10 newer origins: thin ones show "Building history", no deal badge | gate | PARTIAL. LAS page shows "Building history". One sample only; not each origin | | |
| 2b | No SafetyWing anywhere incl. `/disclosure`; `/out/safetywing` ___ | gate | PASS. Absent from `/away-mode`, `/disclosure`, `/api/partners`. `/out/safetywing` 302 to `https://sparkfare.com/away-mode` (retired slug), not to SafetyWing | | |
| 2c | A tagged signup stores its tag (S1 test) | gate | PASS. Channel, campaign and `utm_medium` stored for tagged test signups (M1 and S1 tests). Checked in D1 | | |
| 2d | Analytics beacon on `/`, `/check`, a blog post, a route page | gate | PASS. Cloudflare `beacon.min.js` loads on `/`, `/check`, a blog post and a route page (real browser) | | |
| 2e | `node scripts/check-referral-copy.js` passes; live spot-check | gate | | | |
| 3 | "880 routes from 22 major hubs": US records in the ranked-deals files = ___ | gate | PASS. 920 records in the two files, 40 are TLV, so 880 US | | |
| 4 | Signup with a `+alias`: email arrives, link works, tag stored, referral prompt shows | gate | PARTIAL. Email arrived, link worked, tag stored, `email_verified` logged (3 tests). Referral prompt not seen | | |
| 5 | `/check` answers with basis; `/og/check/*` image loads | gate | PASS. `/check` 200; `/og/check/JFK/Lisbon%2C%20Portugal.png?p=700` 200 `image/png` 46 KB | | |
| 6 | Events recent: `outbound_click` ___ , `route_promoted` ___ , `alert_email_sent` ___ , `email_open` ___ | gate | PASS. Last 2 days: `outbound_click` 77 (latest 08:36 UTC), `route_promoted` 11, `alert_email_sent` 4 (latest 08:00 UTC), `email_open` 22 | | |
| 7 | Digest in Inbox; both unsubscribe headers; SPF/DKIM/DMARC pass; DMARC `p=quarantine`; breaker not tripped; webhook 200s | gate | PASS. Owner read the headers of the test digest (07:14 UTC) in Gmail "Show original" Nov 6: SPF PASS (IP 23.251.234.60), DKIM PASS (domain sparkfare.com), DMARC PASS; `List-Unsubscribe` is the signed-token link (`/api/unsubscribe?token=...&stream=digest`) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` is present; postal address in the body. DNS: DMARC `p=quarantine`. Not inspected: the 08:00 UTC digest itself (same send path). Breaker not tripped (transactional exempt; far below the 200-send minimum) | | |
| 8 | Sitemap URL count ___ , no TLV or `undefined`; thin route 404; new-origin pSEO page 200 | gate | PASS. `sitemap.xml` 966, `sitemap-routes.xml` 365; no `undefined`, no TLV; thin route 404; DTW and AUS pSEO pages 200 | | |
| 9 | PTO: `/time-off` ___ , `/jfk` ___ , `/phl` ___ , `/tlv` ___ (404) | non-P0 | PASS. `/time-off` 200, `/jfk` 200, `/phl` 200, `/tlv` 404 | | |
| 10 | Pipelines: hourly under about 40 min ___ ; daily fetch within about 30 h ___ ; 07:10 compile ran; social post ran | gate | PARTIAL. All recent runs succeeded, but: hourly run at 01:37 UTC took 1 h 17 min (target about 40) and none since (7 h); daily fetch ran about 10:50 UTC (not 03:17), JFK file 22 h old; compile ran (workflow_run 10:50 UTC); social post ran 21:06 UTC Nov 5 (slot 14:17). GitHub scheduling delay | | |
| 11 | Capacity: Workers Paid confirmed; five cron triggers registered; headroom | gate | PARTIAL. Five crons in `wrangler.jsonc`; Workers Paid not confirmed | | |
| 12 | Phone QA on a real phone over mobile data | gate | PASS. Owner walked the list on a real phone Nov 6 ("everything worked perfectly"). Emulated 375 px pass by Claude Code: no overflow on `/`, `/check`, `/away-mode`, `/time-off/jfk`, a route page. Note: "More" is on 26 of 31 JFK cards (only cards with a clean note), not on the hero | | |
| 13 | Product Hunt "View launch" read as a visitor; scheduled Sat Nov 7 12:01 a.m. PT | gate | PASS. Owner read the listing Nov 6: name, tagline, maker comment, gallery match the site; countdown 23 h at about 09:00 UTC (launch 08:01 UTC); description reworded to the daily-email sentence; primary link set to `https://sparkfare.com/?utm_source=producthunt&utm_medium=post&utm_campaign=launch_nov7` (was `?ref=producthunt`, which the site reads as a referral code); shoutouts added to Cloudflare, Clerk, Resend, Unsplash, Claude; category left as is; video not done | | |
| 14 | One-time launch posts scheduled | gate | | | |
| 15 | Weekly standup still sending (last one: ___ ) | non-P0 | PASS. Last sent Mon Nov 2 09:00 UTC | | |

Flags (re-read `wrangler.jsonc` on `main`; behaviour, not just the flag): all "must be false" flags false: ____ ; `ENABLE_REPORT_CC_BY` true: ____ ; `ENABLE_REPORTS` false: ____

## Failures

| Row | What failed | P0? | Scope cut or fix | Owner |
|---|---|---|---|---|
| | | | | |

## Decision

Rules: a failing P0 (rows 1 or 2) means the JFK-only board with an honest "more airports this week" note. A failing non-P0 never blocks launch. A missed gate cuts scope, not the date.

| Field | Value |
|---|---|
| Outcome (GO / GO with reduced scope / NO-GO for a P0 fix) | |
| Reduced scope, if any | |
| Decided by, and time (ET) | |
| Announcement stays Sat Nov 7, 12:01 a.m. PT (08:01 UTC)? | |
| Show HN / Indie Hackers / Reddit dates set | |

After the call: record the decision as a dated `DECISION` in `state_DECISION_LOG.md` and update `ROADMAP.md` Phase 0 in the same commit; add a `docs/handoff/BUILD_STATE.md` row. No merges or flag flips from Nov 6 18:00 ET until Sunday, except a P0 fix or a flag set to its safe value.
