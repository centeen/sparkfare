# Addendum S: Launch elevation builds (D-062 to D-065)

**For:** Claude Code (Antigravity IDE follows the same file if usage runs out; it never merges). **From:** the Sparkfare Design Council Hub, Sun Nov 1, 2026.
**Authority:** D-062 to D-065 (owner, Nov 1 06:12 Israel). Plans: `claude/consult_launch_week_elevation_2026-10-31.md` (v1), `claude/consult_launch_elevation_v2_wide_2026-10-31.md` (v2). Decision file: `claude/decision_staged_D-062_to_D-065_launch_elevation_2026-11-01.md`.
**Why:** launch is Sat Nov 7. The approved plan adds press, community and media pushes. Code work is small and exists so that each burst lands in the list and can be counted by source. The bigger creative builds (calendar feed, ChatGPT app, game) come after the freeze.
**Lane:** merge train (D-035). Not green-lane: every package touches copy, email, measurement or links.

## 0. Priority (read first)
Addendum S **never displaces** the work already due by Wed Nov 4: M1 acceptance (D-036 hard gate), the route-count fix (live site still says "880 routes" on Oct 31; data held 828 on Oct 16), R1 wording, PR #418 conditions, the M2 and O2 flips. If capacity runs short before Nov 4, cut in this order and say so in the approval pack the moment you see it: S4 reminder part, then S3, then S2. S1 is the last to cut.

## 1. Dates
| Package | Latest | Notes |
|---|---|---|
| S0 read-only report | Mon Nov 2 | Then stop for the owner |
| S1 report-link gate + measurement check | Wed Nov 4 | No copy change |
| S2 `/time-off` heading copy | Wed Nov 4 | Guard read of final string |
| S3 `/check` result alert (G120) | Wed Nov 4, else Nov 9+ | Flag `ENABLE_CHECK_ALERT`, default off |
| S4 confirmations vs email breaker (G121) | Wed Nov 4 | Reminder part flag `ENABLE_CONFIRM_REMINDER`, default off; flips not before Nov 9 |
| S6 sale-fare guide (G118) | Live by Mon Nov 16 | Hub supplies copy by Tue Nov 10 |
| S7 subscribable calendar feed (G126) | Fri Nov 20 | Flag `ENABLE_CALENDAR_FEED`, default off |
| S8 ChatGPT app / Claude connector (G130) | Design doc by Fri Nov 20 | No build until the owner relays Travelpayouts' written yes |
| S9 "Deal or not?" game (G131) | Design doc by Fri Nov 27 | No build until the owner approves after Gate G1 (Nov 20) |
Nov 5 fix-only. No merges Nov 6 18:00 ET to Nov 8.

## 2. Standing rules (unchanged from Addendum M section 2 and the Oct 31 tool-switch file)
One PR per package; owner approval per PR bound to the head commit; copy PRs wait for the Hub's Guard read; new behavior behind a flag, default off, flipped by a separate one-line PR the owner approves; `npm test` and `npm run check:copy` pass; no "book", "secured", "instantly", "the moment", countdowns, "only X left", subscriber or activity counts, price predictions or savings claims; disclosure beside every fare and partner link; no traveler dates, names or emails in URLs, logs, UTM tags, sub-IDs or images; never click fare or partner links on production; never send real emails while testing; the owner creates every secret. Update `docs/handoff/BUILD_STATE.md` at the end of every session. Commit messages start with the package ID (`S3: ...`); branches `s/s3-check-alert` and so on.
**New for S:** put this file in the repo unchanged as `docs/handoff/ADDENDUM_S.md` in the S0 PR (docs only).

## 3. Packages

### S0. Read-only report (by Mon Nov 2). Then stop.
Answer in one report:
1. **Route count:** status of the computed count (J1.5) and every file and line that still prints "880" or "600"; which PR fixes it and whether it lands by Nov 4.
2. **`/check` after a result:** what the page shows (screenshot from staging or local, 375 and 1,440 px). Is there any signup or alert offer? Which source value would a signup from there store?
3. **Email breaker:** what trips it (threshold, window), what it pauses, and whether double opt-in confirmation emails are paused too. Daily send ceiling on the current Resend plan. How many confirmations a surge of 500 signups in one hour would delay.
4. **Measurement (M1):** does `/admin/growth` store and show `utm_source`, `utm_medium` and `utm_campaign` verbatim for values never seen before (for example `utm_source=linkedin`, `press_aaa`, `vfr_ord_krk`, `producthunt`, `bluesky`)? For signups that start on `/check`, `/time-off/<origin>` and the digest archive? List any value that collapses to `direct`.
5. **Report link:** where `/how-it-works` links to `/reports/holiday-2026` and how to hide it until `ENABLE_REPORTS` is on.
6. **`/time-off` national table:** file and line of the heading "standard federal holiday schedule" above a table that lists only the seven default holidays.
7. **Calendar code:** how the current `.ics` export is generated, whether it has stable UIDs, and the effort for a subscribable feed (S7).
8. **Capacity:** an honest estimate of whether S1 to S4 fit by Nov 4 after M1, the route count, R1, #418 and the M2/O2 flips. Say what you would cut.

### S1. Report-link gate and measurement check (by Nov 4)
- The `/how-it-works` link to the Holiday Fare Report renders only when `ENABLE_REPORTS` is on. No other change to that page.
- If S0 item 4 found any source value collapsing to `direct` or being dropped, fix it so first-touch `utm_source`, `utm_medium`, `utm_campaign` are stored verbatim (length-limited, lowercase, characters `[a-z0-9_-]` only; anything else stored as `other`). No personal data in the values.
- Add to `docs/metrics/SOURCE_TAGS.md` the convention the Hub will use in posts: `utm_source` = channel (`producthunt`, `hackernews`, `reddit`, `linkedin`, `bluesky`, `press`, `newsletter`, `community`, `podcast`, `directory`, `founding`), `utm_campaign` = moment (`launch_nov7`, `report_nov11`, `aaa_wave`, `vfr_<corridor>`, `sale_check`), `utm_medium` = `post`, `comment`, `email`, `article`.
- **Acceptance:** with the flag off the link is absent; test signups with three new source values show correctly in `/admin/growth`; tests and copy check pass.

### S2. `/time-off` heading copy (by Nov 4; Guard read)
- Current: "National bridge opportunities for 2027 with the standard federal holiday schedule."
- Proposed (PROPOSED; the Guard decides): "2027 long weekends using the planner's default holidays: New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, the day after Thanksgiving and Christmas. Choose your own holidays on any airport page."
- Same fix wherever the embed (`/time-off/embed`) shows that heading.
- **Acceptance:** before and after screenshots; copy check passes.

### S3. `/check` result alert (G120; flag `ENABLE_CHECK_ALERT`)
- Only if S0 item 2 shows no signup offer. Below a result, one quiet block that reuses the existing alert signup with the origin prefilled. Email field only. No pop-up, modal, scroll trigger or second ask.
- Proposed copy (Guard decides): "Want the next one? At most one fare email a day when a fare from {ORIGIN} beats its usual price." Button: "Create alert". Source stored: `check` plus any first-touch UTM values.
- Double opt-in unchanged; the referral prompt (M2) appears after confirmation as already built.
- **Acceptance:** flag off, nothing changes; flag on in staging, a test signup from a result shows source `check` in `/admin/growth`; 375 px layout keeps a 44 px button; copy check passes.

### S4. Confirmations and the email breaker (G121)
- Double opt-in confirmation emails must never be paused by the email breaker. If they are today (S0 item 3), exempt the transactional confirmation stream and keep the breaker for everything else. Report the effect in numbers.
- Optional, behind `ENABLE_CONFIRM_REMINDER` (default off): one reminder 24 hours after an unconfirmed signup, never more than one, no reminder after 72 hours, stops on unsubscribe or confirm. Proposed copy (Guard decides): subject "Confirm your Sparkfare alerts"; body: "You asked for fare alerts from {ORIGIN}. Confirm here to start getting them. If this wasn't you, ignore this email and we won't write again." It counts against the D-049 lifecycle budget; no flip before Nov 9 and only on the owner's approval.
- **Acceptance:** a test burst in staging (test addresses only) shows confirmations sent while the breaker is tripped; reminder off by default; tests pass.

### S6. Sale-fare guide (G118; after Nov 9)
- A static page `/check/sale-fares` (or the blog, if S0 shows that is simpler) titled along the lines of "Is this sale fare actually good?" for the Black Friday to Travel Tuesday period (Travel Tuesday is Tue Dec 1). It explains how to judge any sale fare against the route's own 30-day history and links to `/check`. The Hub supplies the copy by Tue Nov 10 after a Guard read.
- No predictions, no "cheapest day", no countdown, no list of airline sales, no partner links. Source value `sale_check` on its signup block. Link from `/check` with one line only while the period lasts; remove the link after Dec 2 (config date, no manual step).
- **Acceptance:** live by Mon Nov 16 after the owner approves; copy check passes; the link disappears automatically after Dec 2 in a test with a mocked date.

### S7. Subscribable 2027 long-weekend calendar (G126; flag `ENABLE_CALENDAR_FEED`)
- Feeds at `/time-off/2027.ics` (national, default holidays) and `/time-off/<origin>/2027.ics`. Offer `webcal://` as the subscribe link and `https://` as the fallback, next to the existing `.ics` download.
- One all-day event per long-weekend block (the zero-PTO version of each holiday), stable UIDs, `REFRESH-INTERVAL` one week, no `VALARM` (no notifications). Event description: the PTO options for that block, "Holiday dates follow the US federal calendar (OPM). Many employers do not give every federal holiday.", and a link to `/time-off/<origin>?utm_source=calendar&utm_medium=feed&utm_campaign=2027`. Feed description carries the as-of date.
- No traveler data, no per-subscriber URLs, no tracking pixels. Count feed requests per day in aggregate only (no IPs, no user agents stored).
- **Acceptance:** subscribes and refreshes in Google Calendar, Apple Calendar and Outlook (test accounts); event dates match the page; flag off hides the links and returns 404 for the feed; copy check passes on event text.

### S8. ChatGPT app / Claude connector for `/check` (G130). Design document only.
Write `docs/plans/S8_ai_app_design.md`: an MCP server exposing one read-only tool, `check_international_fare(origin, destination, round_trip_price_usd)`, returning the verdict word, percent versus the 30-day median, observation count, as-of time with zone, the "not a quote for your dates" line, and a link to the Sparkfare route page tagged `utm_source=chatgpt_app` (or `claude_connector`). No Aviasales or `/out` links, no booking, no predictions, no personal data, rate limits. Cover OpenAI's Apps SDK submission requirements and the Claude connector route, privacy-page changes, hosting on the current stack, effort and maintenance. **Do not build or submit** until the owner relays Travelpayouts' written permission to show derived statistics inside a third-party AI surface (owner email, Nov 2).

### S9. "Deal or not?" game (G131). Design document only.
Write `docs/plans/S9_game_design.md`: each round shows two real routes from one hub with their cached fares and as-of time; the player picks the one Sparkfare currently judges a deal; the reveal shows the basis line. No signup to play; a signup block after a round (source `game`). Behavior charter: no streaks, timers, countdowns, leaderboards of people, prizes or fake scarcity; share card without dates. Uses only data already public on route pages. Effort and the data rules. **No build** until the owner approves after Gate G1 (Nov 20).

## 4. Not in this addendum
G132 browser companion (parked to Feb 12; terms question open). All outreach (press, LinkedIn, Reddit, Bluesky, diaspora, podcasts, directories) is the owner's and the Hub's. No paid tools, no new partners or affiliate links, no change to the deal floor (D-021), J1 rules or Travelpayouts tools (clause 2.3.5).

## 5. What to send back
S0 report first, then stop. Then per PR: link, head commit, test and copy-check output, before and after copy, screenshots at 375 and 1,440 px, the acceptance result, and the `BUILD_STATE.md` line you updated. One approval pack the owner can answer in one reply. Do not call anything done that was not checked where its acceptance says.

---

## Paste into Claude Code
```
Addendum S (launch elevation, D-062 to D-065) is in docs/handoff/ADDENDUM_S.md (or attached here). Read it after CLAUDE.md, ADDENDUM_M.md and BUILD_STATE.md.

Priority: Addendum S never displaces M1 acceptance, the route-count fix, R1, PR #418's conditions or the M2/O2 flips, all due Wed Nov 4. If capacity is short, cut S4's reminder part, then S3, then S2, and tell me at once.

Today: do S0 only (read-only report, 8 items), add docs/handoff/ADDENDUM_S.md in a docs-only PR, update BUILD_STATE.md, then stop and post the report with your capacity estimate. No merges, flag changes, migrations, real sends, or clicks on fare or partner links.
```

---

## Supplement (2026-11-01): D-067
Read `docs/handoff/ADDENDUM_S_SUPPLEMENT_D-067.md` too: R-Q1 (read-only, answered; ROADMAP step 193), S-copy A (PR #452; step 194), S-copy B (step 195) and S-copy C (step 196). Same rules as above: one PR each, the owner's per-PR approval, Guard read before merge, nothing displaces M1, R1, #418, the M2/O2 flips or the route-count fix.
