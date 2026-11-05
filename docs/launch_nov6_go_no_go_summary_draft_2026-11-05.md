# Go/no-go summary: Fri Nov 6, 2026, 18:00 ET (DRAFT, results to be filled in)

Announcement: Sat Nov 7, 12:01 a.m. PT (08:01 UTC). Decision made by: ________ at ____ ET.

## Decision (circle one)
- **GO**
- **GO with reduced scope:** ______________________ (a failing P0 means the JFK-only board with an honest "more airports this week" note)
- **NO-GO for a P0 fix:** ______________________

## State of the code (verified 2026-11-05, local, not production)
- `main` at `7735260`. No open PRs when last checked.
- JS suite 2,124 of 2,124 passed; Python 57 of 57 passed; `check:copy` clean (1,046 files).
- Merged since Nov 2: Guard A/B (#466, #467), #483 (`ENABLE_REPORT_CC_BY` true), #492 (docs).
- Draft #482 (`ENABLE_REPORTS`) stays unmerged until Wed Nov 11.

## P0 checks
| # | Check | Result | Pass? |
|---|---|---|---|
| 1 | Original 12 origins each about 10+ priced routes; ranked-deals `generated_at` within about 36 h | | |
| 2 | Away Mode: `/api/partners` returns the expected count (13 or fewer), 0 empty blurbs, `/away-mode` 200, `/out/bounce` 302, no Petcube | | |

## Gate checks (failures here cut scope, they do not block launch)
| # | Check | Result | Pass? |
|---|---|---|---|
| 1b | 10 newer origins show "Building history", never JFK's board | | |
| 2b | No SafetyWing anywhere, including `/disclosure` | | |
| 2c | Signup source/UTM tag stored (S1: `post`, `email`, `other`) | | |
| 2d | Cloudflare analytics beacon on `/`, `/check`, a blog post, a route page | | |
| 2e | No banned copy (`check-referral-copy.js` plus live spot-check) | | |
| 3 | "880 routes from 22 major hubs" matches the data on the day | | |
| 4 | Signup end to end with a `+alias` | | |
| 5 | `/check` and `/og/check/*` image | | |
| 6 | Analytics events recent (`outbound_click`, `route_promoted`, `alert_email_sent`, `email_open`) | | |
| 7 | Deliverability: Inbox, both unsubscribe headers, SPF/DKIM/DMARC, breaker not tripped, webhook 200s, postal address in footer | | |
| 8 | Route pages and sitemap (no TLV or `undefined`; thin route 404) | | |
| 10 | Pipelines on time (hourly under about 40 min, daily fetch within about 30 h, 07:10 compile, social post) | | |
| 11 | Capacity: Workers Paid confirmed, five crons registered | | |
| 12 | Phone QA on a real phone over mobile data | | |
| 13 | Product Hunt listing reads correctly, scheduled Sat Nov 7 12:01 a.m. PT | | |
| 14 | One-time launch posts scheduled; Show HN / Indie Hackers / Reddit dates set | | |

Non-P0, informational: 9 (PTO planner), 15 (weekly standup).

## Part A open items carried into the call
- Live pages (`/time-off/embed`, `/check`): ____
- S1 `+s1test` signup test and test-row cleanup: ____
- Hub Guard read of the vacancy post and destination guides: ____
- Hub Guard read of the CC BY licence wording (#483), before Nov 11: ____
- Resend webhook events, limits: ____

## Flags
Re-read `wrangler.jsonc` on `main` on Nov 6 against Part C of the checklist: the "must be false" list all false (`ENABLE_REPORTS`, `ENABLE_LONG_LEAVE`, `ENABLE_FARE_ROUTING`, etc.), the "expected true" list as listed. Deviations: ____

## After the call
1. Log a dated `DECISION` in `state_DECISION_LOG.md` and update `ROADMAP.md` Phase 0 in the same commit.
2. Set Show HN / Indie Hackers / Reddit dates (a few days after Nov 7).
3. Add a `BUILD_STATE.md` row.
4. Freeze: no merges or flips Fri 18:00 ET to Sun Nov 8, except a P0 fix or setting a flag to its safe value. No copy or wording PRs until Mon Nov 9.

## Launch weekend watch
Email breaker counts (Sat and Sun evening), signup bursts, daily fetch and 08:00 digest on same-day data, hourly run length, 5xx on route and `/data/` pages. Kill switches: `ENABLE_DAILY_DIGEST` or `ENABLE_PTO_WATCH` to the exact string `"false"`, merge, about 1 to 2 minutes.

Known and accepted: "Search data retrieved" is the fetch time, not the fare's observation time; a shown deal can already be gone from Aviasales (the "Price can differ on Aviasales" note is live).
