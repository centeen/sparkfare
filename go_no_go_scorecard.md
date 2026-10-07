# Go/no-go scorecard: Saturday Oct 17, 2026 launch (review Oct 16, 18:00 ET)

Draft prepared 2026-10-07 (about 14:00 UTC) by Claude from read-only checks of production, D1 and the repo. The
owner makes the call. Re-run the checks on Oct 16; this file is a snapshot, not a tracker (live tracking is the
Launch Control dashboard). The rule from `ROADMAP.md` Phase 0: the review is evaluated against steps 6, 7, 10 and 1/2
plus a full phone QA pass; **a failing non-P0 step never blocks launch; a failing P0 (step 1 or 2) means launching the
JFK-only board with an honest "more airports this week" note, not slipping the date.**

## Verdict on today's evidence
**No criterion is failing. Nothing here would trigger the JFK-only fallback.** Three things should close before
the review: the Resend webhook subscription (yours), the manual phone pass on signed-in and booking flows (yours,
checklist below), and a decision on how to describe DEN, PHX and LAS (after tomorrow's coverage check).

| # | Criterion | P0? | Status today | Evidence (2026-10-07) |
|---|---|---|---|---|
| 1 | Deals for all origins | P0 | ✅ for the original 12 + TLV; 🟡 for the 3 new origins | Priced routes of 40 per origin: JFK 33, LAX 26, ORD 26, ATL 19, DFW 22, SFO 23, MIA 22, IAD 21, EWR 32, SEA 15, IAH 13, BOS 21, TLV 31; every origin has at least 1 deal. JFK file generated 12:23 UTC today. DEN, PHX, LAS: 0 in the free-tier file until the daily compile lands (it has been landing 12:30 to 16:00 UTC); in the hourly file they have 6, 10 and 7 priced routes, one day of history each, so no deals before about Oct 21. Homepage says "600 routes from 15 major hubs". |
| 2 | Away Mode partner list, works on mobile | P0 | ✅ | `/api/partners` returns 14 live partners, 0 empty blurbs; `/away-mode` 200; no horizontal overflow at 390px. |
| 6 | Analytics events (T0) | no | ✅ | Last 7 days in D1: outbound_click 252, interstitial_view 100, email_open 26, route_promoted 23, deal_suppressed 19, alert_email_sent 7, checklist_email_sent 3, share_click 2. Latest rows are from today. |
| 7 | Email deliverability (T7) | no | 🟡 | Confirmed live: opt-in and unsubscribe, `List-Unsubscribe` headers, signed unsubscribe links on every email, suppression round trip (re-run 2026-10-07: suppressed address skipped, Worker log shows it), SPF fixed, DKIM present, open tracking and the webhook receiving real opens. **Open:** (a) whether the Resend webhook is subscribed to bounces and complaints (Resend dashboard, yours; without it a bounce never suppresses anyone); (b) DMARC is `p=none`. The bounce and complaint path is covered by tests but has never been exercised by a real event. |
| 10 | Route pages: real data or noindex | no | ✅ | `/sitemap-routes.xml` lists 265 URLs; `/flight/JFK/Bali, Indonesia` 200; thin routes return 404, not an indexable empty page. |
| QA | Full phone pass | no | 🟡 | Automated sweep done (below). The signed-in and booking flows need a human on a real phone. |

## Phone QA
**Automated sweep, production, 390x844, 14 pages:** `/`, `/away-mode`, `/check`, `/data/`, `/blog/`, `/terms`, `/disclosure`,
`/privacy`, a route page, a pSEO page, a blog post, `/hub`, `/sign-in`, `/watchlists` (redirects to sign-in when signed out, as designed).
- No page has horizontal overflow; every page has its heading and renders.
- Console errors across the sweep: one 404 (the blog index bug below) and one 401 (`/api/referrals/status` on `/hub` when signed out, expected).
- Site-nav links on the content pages are plain text links about 19px tall (below the 44px target the roadmap used for buttons). They are spaced, not overlapping, and the homepage has the hamburger; flagged, not a blocker.

**Not covered, needs you on a real phone (about 20 minutes):**
1. Sign up with a real email, receive the verification email, click it.
2. Sign in, open Preferences, change origin and trip length, save, reload (this was the B12 bug).
3. Homepage: switch origin to two airports, change the sort, tap "More" on a card, tap "View fare on Aviasales ↗".
4. Signed in: that tap goes to the interstitial with the button visible without scrolling; "Continue to Aviasales" opens Aviasales.
5. Away Mode: open "Customize your trip" and "Complete the trip", tap a partner.
6. `/check`: run a real route, tap "Copy link to this result", open the copied link.
7. Open the daily digest and the post-click email in the phone's real mail app (Gmail and Apple Mail if you have both).
8. Sign out from the nav.

## Found during the sweep (not launch blockers)
- **Blog index price overlays have never worked.** `blog/index.html` fetches `/data/sparkfare_ranked_deals.json` (the file is at `/sparkfare_ranked_deals.json`), so the request 404s and the 48 destination cards keep an empty dark gradient over their photo instead of a price. Cosmetic. Fix options: hide the empty overlay (one CSS line, no behavior change), or point it at the right file, which would start showing "JFK → City · $price" with no "as of" time, against the project's honesty rule. I'd hide it.
- **Analytics baseline looks inflated.** 252 outbound clicks and 100 interstitial views in 7 days against a handful of real users suggests testing, crawlers or bots. Worth a look before reading any launch-week funnel numbers.

## Supporting checks (not in the formal criteria)
| Item | Status |
|---|---|
| Step 12, health monitor | 🟡 now also checks data freshness and the email guard; first real run is 2026-10-08 08:00 UTC; alert path to be observed tomorrow |
| Step 49, `/check` | ✅ live and in the nav and sitemap |
| Referral-positioning copy pass and footer | ✅ live, guarded by `npm test` |
| Manual trigger routes locked behind `ADMIN_SECRET` | ✅ live |
| Daily fetch moved to 03:17 UTC, social post split out | 🟡 merged; the first scheduled run and the first social-post run are unobserved |
| Phase 1 legal track | Seller of Travel risk accepted 2026-10-07; LLC not formed; `privacy.html`, `/terms` and the disclosure wording have had no legal review |

## Before the review: what to re-run on Oct 16
1. Step 1: coverage per origin and file ages (the commands are in this file's evidence column; the health check also reports file ages).
2. Step 2: `/api/partners` count and a phone render of `/away-mode`.
3. Step 6: events in the last 24 hours.
4. Step 7: confirm the webhook subscription in Resend and that open events still arrive.
5. Step 10: sitemap count and one route page.
6. The manual phone pass above, and tomorrow's checks: first daily fetch start time, first health-check email, DEN/PHX/LAS coverage.
