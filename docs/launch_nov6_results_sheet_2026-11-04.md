# Nov 6 go/no-go results sheet (fill in Fri Nov 6, about 14:00 ET; decide at 18:00 ET)

Companion to `docs/launch_nov6_go_no_go_checklist_2026-11-03.md` (the check names and rules) and `launch_go_no_go_2026-10-16.md` (the commands). Drafted 2026-11-04, docs only; **every Result, Time and Initials cell is blank.** Nothing here was run: the drafting sandbox cannot reach sparkfare.com, Cloudflare or Resend.

Fill in: **Result** = PASS / FAIL / N/A plus the number or error seen (not just a tick). **Time** = when you ran it (ET). Anything that FAILs gets a line under "Failures".

## Corrections to the 2026-11-03 checklist (trust these, then update that file)

1. **`ENABLE_REPORT_CC_BY` is now `"true"`** (PR #483 merged 2026-11-03 after Travelpayouts' written yes). Part C of the checklist lists it under "must be false": move it to "expected true". It has no visible effect while `ENABLE_REPORTS` is `"false"`, which must stay false through launch.
2. **Sending guard thresholds in the code are** 7-day window, **minimum 200 sends**, bounce rate above 5%, complaint rate above 0.3% (`SENDING_GUARD` in `src/email.js`). The checklist's watch list still quotes "under 100 sends, 10 bounces or 3 complaints". Trust the code.
3. **Destination guides with no "On the ground" section: all 40, not 19.** The Hub's read request (`claude/hub_guard_read_request_2026-11-04.md`) already says so.
4. **Merged and no longer open:** S-copy B and C, Guard A and B (#466, #467), #418, #454. No PRs were open at the Nov 3 check.

## Header

| Field | Value |
|---|---|
| Date and time of the run (ET) | |
| Run by | |
| `main` commit at the start | |
| Latest Cloudflare deploy matches that commit? (dashboard, Deployments) | |
| Any merge since the last check? | |

## Part A: due before the call

| Done | Item | Result / evidence | Initials |
|---|---|---|---|
| [ ] | Live pages: `/time-off/embed` shows the Guard line, no "National federal holidays" | | |
| [ ] | `/check` untracked route: no alert card; tracked route: card still shows | | |
| [ ] | S1 test: `post`, `email`, `other` stored, tag `x_s1test`; test rows deleted | | |
| [ ] | Hub Guard read 1 (vacancy post) | PASS / CONDITIONAL / FAIL: | |
| [ ] | Hub Guard read 2 (destination guides) | PASS / CONDITIONAL / FAIL: | |
| [ ] | Hub Guard read 3 (CC BY wording; may wait to Nov 9 to 10) | PASS / CONDITIONAL / FAIL: | |
| [ ] | Resend webhook subscribed to delivered, bounced, complained, opened; recent deliveries 200 | | |
| [ ] | Resend limits read: per-second ___ ; daily cap ___ ; expected launch-weekend volume ___ | | |
| [ ] | Digest footer shows the postal address; `email_blocked_no_postal_address` count in the last 2 days = ___ | | |
| [ ] | Last merges done by Wed Nov 4 (anything later waits until Nov 9) | | |
| [ ] | Branch `docs/build-state-nov2` deleted | | |
| [ ] | No press pitches Nov 3 to 6 | | |

## Part B: decision table

| # | Check | Priority | Result (PASS / FAIL + number) | Time | Notes |
|---|---|---|---|---|---|
| 1 | Original 12 origins: priced routes per origin ___ (each about 10+); `generated_at` of both ranked-deals files within about 36 h: JFK file ___ , other-origins file ___ | **P0** | | | |
| 2 | Away Mode: `/api/partners` count ___ (expect 13), empty blurbs ___ (0), `/away-mode` ___ , `/out/bounce` ___ (302), Petcube absent | **P0** | | | |
| 1b | 10 newer origins: thin ones show "Building history", no deal badge | gate | | | |
| 2b | No SafetyWing anywhere incl. `/disclosure`; `/out/safetywing` ___ | gate | | | |
| 2c | A tagged signup stores its tag (S1 test) | gate | | | |
| 2d | Analytics beacon on `/`, `/check`, a blog post, a route page | gate | | | |
| 2e | `node scripts/check-referral-copy.js` passes; live spot-check | gate | | | |
| 3 | "880 routes from 22 major hubs": US records in the ranked-deals files = ___ | gate | | | |
| 4 | Signup with a `+alias`: email arrives, link works, tag stored, referral prompt shows | gate | | | |
| 5 | `/check` answers with basis; `/og/check/*` image loads | gate | | | |
| 6 | Events recent: `outbound_click` ___ , `route_promoted` ___ , `alert_email_sent` ___ , `email_open` ___ | gate | | | |
| 7 | Digest in Inbox; both unsubscribe headers; SPF/DKIM/DMARC pass; DMARC `p=quarantine`; breaker not tripped; webhook 200s | gate | | | |
| 8 | Sitemap URL count ___ , no TLV or `undefined`; thin route 404; new-origin pSEO page 200 | gate | | | |
| 9 | PTO: `/time-off` ___ , `/jfk` ___ , `/phl` ___ , `/tlv` ___ (404) | non-P0 | | | |
| 10 | Pipelines: hourly under about 40 min ___ ; daily fetch within about 30 h ___ ; 07:10 compile ran; social post ran | gate | | | |
| 11 | Capacity: Workers Paid confirmed; five cron triggers registered; headroom | gate | | | |
| 12 | Phone QA on a real phone over mobile data | gate | | | |
| 13 | Product Hunt "View launch" read as a visitor; scheduled Sat Nov 7 12:01 a.m. PT | gate | | | |
| 14 | One-time launch posts scheduled | gate | | | |
| 15 | Weekly standup still sending (last one: ___ ) | non-P0 | | | |

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
